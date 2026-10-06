import test, { before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { prepararBd } from "@/test-utils/bd-memoria";

process.env.AUTH_SECRET = "secreto-de-prueba-del-asistente";
delete process.env.ASSISTANT_SESSION_SECRET;

let b: typeof import("@/lib/budget");
let bd: typeof import("@/db");
let schema: typeof import("@/db/schema");

before(async () => {
  await prepararBd();
  b = await import("@/lib/budget");
  bd = await import("@/db");
  schema = await import("@/db/schema");
});

// Límites de la prueba, guardados como los guardaría un administrador.
async function limites(v: { presupuestoMensualUsd: number; topePorSesion: number }) {
  await bd.db.delete(schema.siteSettings);
  await bd.db.insert(schema.siteSettings).values({ key: b.LIMITES_KEY, value: { ...v, topeBorradoresDia: 20 } });
}

beforeEach(async () => {
  await bd.db.delete(schema.assistantQueries);
});

test("la sesión del asistente la emite el servidor: sin cookie se crea una, con cookie válida se reconoce", () => {
  const a = b.sesionAsistente(undefined);
  assert.equal(a.nueva, true);
  assert.match(a.valor, /^[0-9a-f-]{36}\.[\w-]{22}$/);
  const de = b.sesionAsistente(a.valor);
  assert.deepEqual({ id: de.id, nueva: de.nueva }, { id: a.id, nueva: false });
});

test("una cookie manipulada o inventada no sirve: se emite una sesión nueva", () => {
  const a = b.sesionAsistente(undefined);
  const [id, firma] = a.valor.split(".");
  for (const falsa of [`${id}.${firma.slice(0, -1)}X`, `${crypto.randomUUID()}.${firma}`, id, "", "cualquier-cosa", `${id}.`]) {
    const r = b.sesionAsistente(falsa);
    assert.equal(r.nueva, true, `«${falsa}» no debe reconocerse`);
    assert.notEqual(r.id, id);
  }
});

test("una cookie firmada con otra clave deja de valer", () => {
  const a = b.sesionAsistente(undefined);
  process.env.ASSISTANT_SESSION_SECRET = "otra-clave";
  assert.equal(b.sesionAsistente(a.valor).nueva, true);
  delete process.env.ASSISTANT_SESSION_SECRET;
});

test("el presupuesto se aparta de forma atómica: con varias consultas a la vez nunca se sobrepasa", async () => {
  await limites({ presupuestoMensualUsd: 0.05, topePorSesion: 100 }); // caben 2 reservas de 0,02
  const reservas = await Promise.all(Array.from({ length: 6 }, (_, i) => b.reservarGeneracion(`s${i}`, "pregunta")));
  assert.equal(reservas.filter((r) => r.ok).length, 2, "solo caben dos reservas");
  assert.deepEqual([...new Set(reservas.filter((r) => !r.ok).map((r) => (r.ok ? "" : r.reason)))], ["presupuesto_mensual"]);
});

test("el tope por sesión también se respeta", async () => {
  await limites({ presupuestoMensualUsd: 100, topePorSesion: 2 });
  const r1 = await b.reservarGeneracion("misma", "p1");
  const r2 = await b.reservarGeneracion("misma", "p2");
  const r3 = await b.reservarGeneracion("misma", "p3");
  assert.deepEqual([r1.ok, r2.ok, r3.ok], [true, true, false]);
  assert.equal(r3.ok ? "" : r3.reason, "limite_sesion");
  assert.equal((await b.reservarGeneracion("otra", "p")).ok, true, "otra sesión no se ve afectada");
});

test("liquidar ajusta la reserva al coste real y deja las fuentes citadas", async () => {
  await limites({ presupuestoMensualUsd: 100, topePorSesion: 100 });
  const r = await b.reservarGeneracion("s", "¿precio del novillo?");
  assert.ok(r.ok);
  if (!r.ok) return;
  const [reservada] = await bd.db.select().from(schema.assistantQueries).where(eq(schema.assistantQueries.id, r.id));
  assert.equal(Number(reservada.costUsd), b.RESERVA_USD, "mientras se genera, cuenta la reserva");
  await b.liquidarGeneracion(r.id, { mode: "generativo", cited: [{ title: "Nota", url: "/articulo/x", kind: "articulo" }], answered: true, inputTokens: 1000, outputTokens: 200 });
  const [final] = await bd.db.select().from(schema.assistantQueries).where(eq(schema.assistantQueries.id, r.id));
  assert.equal(final.answered, true);
  assert.equal(final.citedSources.length, 1);
  assert.ok(Math.abs(Number(final.costUsd) - (b.estimateCostUsd(1000, 200) + b.COSTO_EMBEDDING_USD)) < 1e-6);
  assert.ok(Number(final.costUsd) < b.RESERVA_USD);
});

test("un valor no numérico en el entorno no desactiva los topes (NaN)", async () => {
  await bd.db.delete(schema.siteSettings);
  process.env.ASSISTANT_MONTHLY_BUDGET_USD = "mucho";
  process.env.ASSISTANT_SESSION_QUERY_LIMIT = "";
  try {
    const l = await b.getLimites();
    assert.equal(l.presupuestoMensualUsd, 150);
    assert.equal(l.topePorSesion, 15);
  } finally {
    delete process.env.ASSISTANT_MONTHLY_BUDGET_USD;
    delete process.env.ASSISTANT_SESSION_QUERY_LIMIT;
  }
});
