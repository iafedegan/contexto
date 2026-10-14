import test, { before } from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { prepararBd } from "@/test-utils/bd-memoria";

type Envio = typeof import("@/lib/newsletter/envio");
let envio: Envio;
let db: typeof import("@/db").db;
let ed: typeof import("@/db/schema").newsletterEditions;
let subs: typeof import("@/db/schema").newsletterSubscribers;

const ayer = new Date(Date.now() - 86_400_000);
const hace = (min: number) => new Date(Date.now() - min * 60_000);
const dentro = (min: number) => new Date(Date.now() + min * 60_000);

before(async () => {
  // Sin clave del proveedor y en «development», el envío se SIMULA: cuenta como entregado pero no sale ningún correo.
  (process.env as Record<string, string>).NODE_ENV = "development";
  await prepararBd();
  envio = await import("@/lib/newsletter/envio");
  ({ db } = await import("@/db"));
  const schema = await import("@/db/schema");
  ed = schema.newsletterEditions;
  subs = schema.newsletterSubscribers;
  await db.insert(schema.articles).values({ slug: "nota-de-prueba", title: "Nota de prueba", excerpt: "Resumen de la nota de prueba", body: "<p>Cuerpo</p>", status: "publicado", publishedAt: ayer });
  await db.insert(subs).values([
    { email: "a@x.co", confirmed: true, city: "Bogotá" },
    { email: "b@x.co", confirmed: true, city: "Bogotá" },
    { email: "c@x.co", confirmed: true, city: "Medellín" },
    { email: "d@x.co", confirmed: false, city: "Bogotá" },
  ]);
});

const crear = async (extra: Partial<typeof ed.$inferInsert> = {}) =>
  (await db.insert(ed).values({ subject: "Edición de prueba", articleSlugs: ["nota-de-prueba"], items: [{ t: "n", slug: "nota-de-prueba" }], status: "programada", scheduledFor: hace(1), ...extra }).returning())[0];
const leer = async (id: string) => (await db.select().from(ed).where(eq(ed.id, id)))[0];

test("una edición programada que ya llegó a su hora se envía a todos los confirmados", async () => {
  const e = await crear();
  const r = await envio.procesarBoletinesProgramados({ forzar: true });
  assert.deepEqual(r.map((x) => [x.id, x.done, x.delivered]), [[e.id, true, 3]]);
  const f = await leer(e.id);
  assert.equal(f.status, "enviada");
  assert.equal(f.total, 3);
  assert.equal(f.delivered, 3);
  assert.ok(f.issue && f.sentAt && f.startedAt);
});

test("la que todavía no llega a su hora no se toca", async () => {
  const e = await crear({ scheduledFor: dentro(30) });
  assert.deepEqual(await envio.procesarBoletinesProgramados({ forzar: true }), []);
  assert.equal((await leer(e.id)).status, "programada");
});

test("con un público por ciudad, solo lo reciben quienes cumplen el filtro", async () => {
  const e = await crear({ audience: { ciudades: ["bogota"] } });
  await envio.procesarBoletinesProgramados({ forzar: true });
  const f = await leer(e.id);
  assert.equal(f.status, "enviada");
  assert.equal(f.total, 2, "Bogotá: dos confirmados (el pendiente no cuenta)");
  assert.equal(f.delivered, 2);
});

test("si nadie cumple el filtro, la edición vuelve a borrador en vez de quedar atascada", async () => {
  const e = await crear({ audience: { ciudades: ["cali"] } });
  const r = await envio.procesarBoletinesProgramados({ forzar: true });
  assert.equal(r[0].ok, false);
  const f = await leer(e.id);
  assert.equal(f.status, "borrador");
  assert.equal(f.scheduledFor, null);
});

test("un envío programado en curso no se duplica: solo se retoma si lleva rato sin avanzar, y sigue desde su cursor", async () => {
  // Primera tanda ya hecha (a, b) por otra pasada que sigue activa hace un momento.
  const [a, b] = (await db.select({ id: subs.id, email: subs.email }).from(subs).where(eq(subs.confirmed, true))).sort((x, y) => (x.id < y.id ? -1 : 1));
  const e = await crear({ status: "enviando", startedAt: new Date(), total: 3, delivered: 2, cursor: b.id, issue: 99 });
  void a;
  // Actividad reciente (hace 10 s): otra pasada la está enviando.
  await db.execute(sql`update newsletter_editions set updated_at = now() - interval '10 seconds' where id = ${e.id}`);
  assert.deepEqual(await envio.procesarBoletinesProgramados({ forzar: true }), [], "no se toca mientras alguien la envía");
  assert.equal((await leer(e.id)).delivered, 2);
  // Abandonada hace 5 minutos: se retoma y manda solo lo que faltaba.
  await db.execute(sql`update newsletter_editions set updated_at = now() - interval '5 minutes' where id = ${e.id}`);
  const r = await envio.procesarBoletinesProgramados({ forzar: true });
  assert.equal(r.length, 1);
  const f = await leer(e.id);
  assert.equal(f.status, "enviada");
  assert.equal(f.delivered, 3, "2 de antes + el que faltaba, sin repetir");
});

test("desde el panel no se puede enviar a mano una edición programada ni una que la programación está enviando", async () => {
  const e = await crear({ scheduledFor: dentro(60) });
  const r = await envio.enviarTanda(e.id, { origen: "navegador", tiempoMs: 5_000 });
  assert.equal(r.ok, false);
  assert.match(r.message ?? "", /programada/);
  assert.equal((await leer(e.id)).status, "programada");
  const en = await crear({ status: "enviando", startedAt: hace(1), total: 3 });
  const r2 = await envio.enviarTanda(en.id, { origen: "navegador", tiempoMs: 5_000 });
  assert.equal(r2.ok, false);
  assert.match(r2.message ?? "", /programación/);
});

test("un borrador no se envía por la vía de la programación", async () => {
  const e = await crear({ status: "borrador", scheduledFor: null });
  const r = await envio.enviarTanda(e.id, { origen: "programacion", tiempoMs: 5_000 });
  assert.equal(r.ok, false);
  assert.equal((await leer(e.id)).status, "borrador");
});

test("dos disparadores a la vez sobre la misma edición vencida no la envían dos veces", async () => {
  const e = await crear();
  const [x, y] = await Promise.all([envio.procesarBoletinesProgramados({ forzar: true }), envio.procesarBoletinesProgramados({ forzar: true })]);
  const entregados = [...x, ...y].filter((r) => r.id === e.id).reduce((t, r) => t + (r.ok && r.done ? r.delivered : 0), 0);
  assert.equal(entregados, 3, "una sola pasada la completó");
  const f = await leer(e.id);
  assert.equal(f.status, "enviada");
  assert.equal(f.delivered, 3);
});
