import test, { before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { prepararBd } from "@/test-utils/bd-memoria";

let limpieza: typeof import("@/lib/media-limpieza");
let storage: typeof import("@/lib/media-storage");
let bd: typeof import("@/db");
let schema: typeof import("@/db/schema");

const BASE = "https://proyecto.supabase.co";
const publica = (n: string) => `${BASE}/storage/v1/object/public/media/${n}`;
const dias = (n: number) => new Date(Date.now() - n * 24 * 3600_000).toISOString();
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, ...new Array(52).fill(0)]);

before(async () => {
  await prepararBd();
  limpieza = await import("@/lib/media-limpieza");
  storage = await import("@/lib/media-storage");
  bd = await import("@/db");
  schema = await import("@/db/schema");
});

beforeEach(async () => {
  process.env.SUPABASE_URL = BASE;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "clave-de-servicio-de-prueba";
  await bd.db.delete(schema.articles);
  await bd.db.delete(schema.siteSettings);
});

// Storage simulado: lista fija de objetos y registro de lo que se borra.
function simularStorage(objetos: { name: string; created_at: string }[]) {
  const borrados: string[] = [];
  const m = mock.method(globalThis, "fetch", async (entrada: unknown, init?: RequestInit) => {
    const url = String(entrada instanceof URL ? entrada.href : entrada);
    if (url.includes("/object/list/")) return new Response(JSON.stringify(objetos.map((o) => ({ id: `id-${o.name}`, ...o }))), { status: 200 });
    if (init?.method === "DELETE") {
      borrados.push(decodeURIComponent(url.split("/object/media/")[1]));
      return new Response("{}", { status: 200 });
    }
    return new Response("{}", { status: 404 });
  });
  return { borrados, restaurar: () => m.mock.restore() };
}

test("borra los archivos sin uso con más de 7 días y conserva los citados y los recientes", async () => {
  await bd.db.insert(schema.articles).values([
    { slug: "con-portada", title: "a", excerpt: "e", body: "<p>x</p>", coverImageUrl: publica("portada.png"), status: "publicado", publishedAt: new Date() },
    { slug: "con-foto", title: "b", excerpt: "e", body: `<p><img src="${publica("en-cuerpo.jpg")}"></p>`, status: "borrador" },
  ]);
  await bd.db.insert(schema.siteSettings).values({ key: "popup", value: { mediaUrl: publica("popup.webp") } });
  const s = simularStorage([
    { name: "portada.png", created_at: dias(30) },
    { name: "en-cuerpo.jpg", created_at: dias(30) },
    { name: "popup.webp", created_at: dias(30) },
    { name: "huerfana.png", created_at: dias(30) },
    { name: "subida-de-ayer.png", created_at: dias(1) },
  ]);
  try {
    const r = await limpieza.limpiarMediaHuerfana();
    assert.deepEqual(s.borrados, ["huerfana.png"]);
    assert.equal(r.borrados, 1);
    assert.equal(r.revisados, 5);
  } finally {
    s.restaurar();
  }
});

test("al borrar una nota, sus imágenes quedan sin uso y la limpieza las retira", async () => {
  const [nota] = await bd.db.insert(schema.articles).values({ slug: "se-borra", title: "a", excerpt: "e", body: "<p>x</p>", coverImageUrl: publica("de-la-nota.png"), status: "publicado", publishedAt: new Date() }).returning({ id: schema.articles.id });
  const s = simularStorage([{ name: "de-la-nota.png", created_at: dias(10) }]);
  try {
    assert.equal((await limpieza.limpiarMediaHuerfana()).borrados, 0, "mientras la nota exista, se conserva");
    await bd.db.delete(schema.articles).where((await import("drizzle-orm")).eq(schema.articles.id, nota.id));
    assert.equal((await limpieza.limpiarMediaHuerfana()).borrados, 1);
    assert.deepEqual(s.borrados, ["de-la-nota.png"]);
  } finally {
    s.restaurar();
  }
});

test("si no se encuentra ninguna referencia pero hay muchos archivos, no se borra nada", async () => {
  const s = simularStorage(Array.from({ length: 30 }, (_, i) => ({ name: `f${i}.png`, created_at: dias(40) })));
  try {
    const r = await limpieza.limpiarMediaHuerfana();
    assert.equal(r.borrados, 0);
    assert.match(r.omitida ?? "", /ninguna referencia/);
    assert.deepEqual(s.borrados, []);
  } finally {
    s.restaurar();
  }
});

test("una ejecución no borra más de 200 archivos", async () => {
  await bd.db.insert(schema.siteSettings).values({ key: "algo", value: { x: publica("protegida.png") } });
  const s = simularStorage([...Array.from({ length: 250 }, (_, i) => ({ name: `o${i}.png`, created_at: dias(40) })), { name: "protegida.png", created_at: dias(40) }]);
  try {
    const r = await limpieza.limpiarMediaHuerfana();
    assert.equal(r.borrados, 200);
    assert.ok(!s.borrados.includes("protegida.png"));
  } finally {
    s.restaurar();
  }
});

test("sin Supabase configurado la limpieza se omite sin fallar", async () => {
  delete process.env.SUPABASE_URL;
  const r = await limpieza.limpiarMediaHuerfana();
  assert.equal(r.borrados, 0);
  assert.ok(r.omitida);
});

test("inspeccionarMedia lee solo los primeros bytes, el tipo servido y el tamaño real", async () => {
  const m = mock.method(globalThis, "fetch", async () => new Response(PNG, { status: 206, headers: { "content-type": "image/png", "content-range": "bytes 0-63/1234567" } }));
  try {
    const r = await storage.inspeccionarMedia("abc.png");
    assert.ok(r.ok);
    if (r.ok) assert.deepEqual({ mime: r.tipo?.mime, contentType: r.contentType, bytes: r.bytes }, { mime: "image/png", contentType: "image/png", bytes: 1234567 });
  } finally {
    m.mock.restore();
  }
});

test("inspeccionarMedia no se bloquea si el servidor ignora Range y envía el archivo entero", async () => {
  const grande = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(PNG);
      for (let i = 0; i < 100; i++) c.enqueue(new Uint8Array(65536));
      c.close();
    },
  });
  const m = mock.method(globalThis, "fetch", async () => new Response(grande, { status: 200, headers: { "content-type": "image/png", "content-length": "6553664" } }));
  try {
    const r = await storage.inspeccionarMedia("abc.png");
    assert.ok(r.ok && r.tipo?.mime === "image/png" && r.bytes === 6553664);
  } finally {
    m.mock.restore();
  }
});

test("un archivo que no es imagen ni video se reconoce como tal", async () => {
  const m = mock.method(globalThis, "fetch", async () => new Response("<html><script>alert(1)</script></html>".padEnd(64, " "), { status: 200, headers: { "content-type": "text/html" } }));
  try {
    const r = await storage.inspeccionarMedia("falso.png");
    assert.ok(r.ok && r.tipo === null);
  } finally {
    m.mock.restore();
  }
});
