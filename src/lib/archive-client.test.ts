import test, { before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { prepararBd } from "@/test-utils/bd-memoria";

let cliente: typeof import("@/lib/archive-client");
let bd: typeof import("@/db");
let schema: typeof import("@/db/schema");

before(async () => {
  await prepararBd();
  cliente = await import("@/lib/archive-client");
  bd = await import("@/db");
  schema = await import("@/db/schema");
});

// Origen simulado: páginas por cursor, y registro de las URLs que se le pidieron.
type Pagina = { items: unknown[]; nextCursor: string | null };
function simularOrigen(paginas: Record<string, Pagina>, opciones: { estado?: number; cuerpoError?: string } = {}) {
  const pedidas: URL[] = [];
  const m = mock.method(globalThis, "fetch", async (entrada: unknown) => {
    const url = new URL(String(entrada instanceof URL ? entrada.href : entrada));
    pedidas.push(url);
    if (opciones.estado) return new Response(opciones.cuerpoError ?? "", { status: opciones.estado });
    const pagina = paginas[url.searchParams.get("cursor") ?? "inicio"];
    return new Response(JSON.stringify(pagina ?? { items: [], nextCursor: null }), { status: 200, headers: { "content-type": "application/json" } });
  });
  return { pedidas, restaurar: () => m.mock.restore() };
}
const item = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `a${n}`,
  url: `https://www.contextoganadero.com/nota-${n}`,
  title: `Nota ${n}`,
  summary: `Resumen ${n}`,
  category: "mercado",
  publishedAt: "2024-05-01T10:00:00Z",
  ...extra,
});
const ids = async () => (await bd.db.select({ id: schema.archiveIndex.externalId }).from(schema.archiveIndex)).map((r) => r.id).sort();

beforeEach(async () => {
  process.env.ARCHIVE_API_BASE_URL = "https://origen.example.com/api/v2";
  delete process.env.OPENAI_API_KEY;
  await bd.db.delete(schema.archiveIndex);
  await bd.db.delete(schema.siteSettings);
  await bd.db.delete(schema.rateLimits); // libera el candado de la sincronización entre pruebas
});

test("la URL conserva la ruta de la base (antes «/articles» la descartaba) y la sincronización recorre todas las páginas", async () => {
  const origen = simularOrigen({ inicio: { items: [item(1), item(2)], nextCursor: "p2" }, p2: { items: [item(3)], nextCursor: null } });
  try {
    const r = await cliente.syncArchiveIndex({ full: true });
    assert.equal(origen.pedidas[0].pathname, "/api/v2/articles");
    assert.equal(origen.pedidas[1].searchParams.get("cursor"), "p2");
    assert.deepEqual({ scanned: r.scanned, upserted: r.upserted, completa: r.completa, tipo: r.tipo }, { scanned: 3, upserted: 3, completa: true, tipo: "completa" });
    assert.deepEqual(await ids(), ["a1", "a2", "a3"]);
  } finally {
    origen.restaurar();
  }
});

test("un registro inválido se descarta y se cuenta, sin abortar la sincronización", async () => {
  const origen = simularOrigen({
    inicio: {
      items: [
        item(1),
        item(2, { publishedAt: "esto-no-es-una-fecha" }), // fecha ilegible: se guarda sin fecha
        item(3, { url: "javascript:alert(1)" }), // esquema peligroso
        item(4, { url: "http://www.contextoganadero.com/nota-4" }), // no es https
        item(5, { title: "" }),
        null,
        "texto suelto",
      ],
      nextCursor: null,
    },
  });
  try {
    const r = await cliente.syncArchiveIndex({ full: true });
    assert.equal(r.invalid, 5);
    assert.deepEqual(await ids(), ["a1", "a2"]);
    const [dos] = await bd.db.select().from(schema.archiveIndex).where(eq(schema.archiveIndex.externalId, "a2"));
    assert.equal(dos.publishedAt, null);
  } finally {
    origen.restaurar();
  }
});

test("el cursor se guarda y la siguiente ejecución sigue donde quedó", async () => {
  const paginas = {
    inicio: { items: [item(1)], nextCursor: "p2" },
    p2: { items: [item(2)], nextCursor: "p3" },
    p3: { items: [item(3)], nextCursor: null },
  };
  const origen = simularOrigen(paginas);
  try {
    const a = await cliente.syncArchiveIndex({ full: true, presupuestoMs: -1 }); // sin tiempo: solo una página
    assert.equal(a.completa, false);
    assert.deepEqual(await ids(), ["a1"]);
    const b = await cliente.syncArchiveIndex({ full: true, presupuestoMs: -1 });
    assert.equal(b.completa, false);
    assert.equal(origen.pedidas[1].searchParams.get("cursor"), "p2", "la segunda ejecución empieza en la página 2, no en la 1");
    const c = await cliente.syncArchiveIndex({ full: true, presupuestoMs: -1 });
    assert.equal(c.completa, true);
    assert.equal(origen.pedidas.length, 3, "cada página se pidió una sola vez");
    assert.deepEqual(await ids(), ["a1", "a2", "a3"]);
  } finally {
    origen.restaurar();
  }
});

test("lo que ya no está en el origen se retira al cerrar una pasada completa; lo que sigue, no", async () => {
  const origen1 = simularOrigen({ inicio: { items: [item(1), item(2), item(3)], nextCursor: null } });
  try {
    await cliente.syncArchiveIndex({ full: true });
  } finally {
    origen1.restaurar();
  }
  const origen2 = simularOrigen({ inicio: { items: [item(1), item(3)], nextCursor: null } });
  try {
    const r = await cliente.syncArchiveIndex({ full: true });
    assert.equal(r.removed, 1);
    assert.equal(r.skipped, 2, "las dos que no cambiaron se dejan tal cual");
    assert.deepEqual(await ids(), ["a1", "a3"]);
  } finally {
    origen2.restaurar();
  }
});

test("si de golpe faltan demasiadas, no se borra nada y se avisa (posible fallo del origen)", async () => {
  const filas = Array.from({ length: 200 }, (_, i) => item(i + 1));
  const origen1 = simularOrigen({ inicio: { items: filas, nextCursor: null } });
  try {
    await cliente.syncArchiveIndex({ full: true });
  } finally {
    origen1.restaurar();
  }
  const log = console.warn;
  console.warn = () => {};
  const origen2 = simularOrigen({ inicio: { items: [item(1)], nextCursor: null } }); // el origen «responde» casi vacío
  try {
    const r = await cliente.syncArchiveIndex({ full: true });
    assert.equal(r.removed, 0);
    assert.equal(r.removedSuspicious, 199);
    assert.equal((await ids()).length, 200);
  } finally {
    console.warn = log;
    origen2.restaurar();
  }
});

test("un error de la API no devuelve el cuerpo de la respuesta ajena", async () => {
  const origen = simularOrigen({}, { estado: 403, cuerpoError: "<html>SECRETO-DEL-ORIGEN</html>" });
  try {
    await assert.rejects(() => cliente.syncArchiveIndex({ full: true }), (e: Error) => {
      assert.match(e.message, /archive API 403/);
      assert.ok(!e.message.includes("SECRETO-DEL-ORIGEN"));
      return true;
    });
  } finally {
    origen.restaurar();
  }
});

test("una caída momentánea del origen (5xx) se reintenta y la pasada termina", async () => {
  let intentos = 0;
  const m = mock.method(globalThis, "fetch", async () => {
    intentos++;
    if (intentos === 1) return new Response("", { status: 503 });
    return new Response(JSON.stringify({ items: [item(1)], nextCursor: null }), { status: 200 });
  });
  try {
    const r = await cliente.syncArchiveIndex({ full: true });
    assert.equal(r.completa, true);
    assert.equal(intentos, 2);
  } finally {
    m.mock.restore();
  }
});

test("los embeddings se piden en lote, no uno por uno", async () => {
  process.env.OPENAI_API_KEY = "clave-de-prueba";
  const peticiones: number[] = [];
  const vec = Array.from({ length: schema.EMBEDDING_DIMENSIONS }, (_, i) => (i === 0 ? 1 : 0));
  const m = mock.method(globalThis, "fetch", async (entrada: unknown, init?: RequestInit) => {
    const url = String(entrada instanceof URL ? entrada.href : entrada);
    if (url.includes("openai.com")) {
      const input = (JSON.parse(String(init?.body)) as { input: string[] }).input;
      peticiones.push(input.length);
      return new Response(JSON.stringify({ data: input.map((_, index) => ({ index, embedding: vec })) }), { status: 200 });
    }
    return new Response(JSON.stringify({ items: Array.from({ length: 40 }, (_, i) => item(i + 1)), nextCursor: null }), { status: 200 });
  });
  try {
    const r = await cliente.syncArchiveIndex({ full: true });
    assert.equal(r.upserted, 40);
    assert.deepEqual(peticiones, [32, 8], "40 artículos = 2 peticiones, no 40");
    const [fila] = await bd.db.select({ n: sql<number>`count(*) filter (where embedding is not null)::int` }).from(schema.archiveIndex);
    assert.equal(fila.n, 40);
  } finally {
    m.mock.restore();
    delete process.env.OPENAI_API_KEY;
  }
});

test("dos ejecuciones simultáneas no se pisan: la segunda avisa que está ocupada", async () => {
  const origen = simularOrigen({ inicio: { items: [item(1)], nextCursor: null } });
  try {
    const [a, b] = await Promise.all([cliente.syncArchiveIndex({ full: true }), cliente.syncArchiveIndex({ full: true })]);
    assert.equal([a, b].filter((r) => r.ocupada).length, 1);
    assert.equal([a, b].filter((r) => r.completa).length, 1);
  } finally {
    origen.restaurar();
  }
});
