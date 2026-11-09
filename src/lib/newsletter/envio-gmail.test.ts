import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { asc, eq } from "drizzle-orm";
import { prepararBd } from "@/test-utils/bd-memoria";

/**
 * Envío del boletín con Gmail (que manda de uno en uno): si Google corta a mitad de una tanda, al reintentar se debe continuar
 * justo después del último correo entregado, sin repetirlo a quien ya lo recibió.
 */

type Envio = typeof import("@/lib/newsletter/envio");
let envio: Envio;
let db: typeof import("@/db").db;
let ed: typeof import("@/db/schema").newsletterEditions;
let subs: typeof import("@/db/schema").newsletterSubscribers;

const fetchReal = globalThis.fetch;
const respuesta = (status: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });

let llamadas = 0; // envíos que Gmail ha recibido (aceptados o rechazados)
let corteEn = -1; // índice (0 = el primero) del envío que Google rechaza por el tope diario; -1 = ninguno
let aceptados: string[] = []; // destinatarios a quienes Gmail aceptó el correo

before(async () => {
  await prepararBd();
  delete process.env.RESEND_API_KEY;
  // Fuera de «development» el enlace de baja se firma de verdad y exige este secreto.
  process.env.AUTH_SECRET ??= "secreto-de-prueba-para-firmar-enlaces-de-baja";
  process.env.GMAIL_CLIENT_ID = "123-abc.apps.googleusercontent.com";
  process.env.GMAIL_CLIENT_SECRET = "GOCSPX-secreto-de-prueba-123456";
  process.env.GMAIL_REFRESH_TOKEN = "1//token-de-prueba-0123456789abcdef";

  envio = await import("@/lib/newsletter/envio");
  ({ db } = await import("@/db"));
  const schema = await import("@/db/schema");
  ed = schema.newsletterEditions;
  subs = schema.newsletterSubscribers;

  await db.insert(schema.articles).values({ slug: "nota-de-prueba", title: "Nota de prueba", excerpt: "Resumen de la nota de prueba", body: "<p>Cuerpo</p>", status: "publicado", publishedAt: new Date(Date.now() - 86_400_000) });
  await db.insert(schema.siteSettings).values({ key: "newsletter_settings", value: { fromName: "CONtexto Ganadero", fromEmail: "info@contextoganadero.com" } });
  await db.insert(subs).values(["a", "b", "c", "d", "e"].map((x) => ({ email: `${x}@lectores.co`, confirmed: true })));

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u === "https://oauth2.googleapis.com/token") return respuesta(200, { access_token: "ya29.prueba" });
    if (u.startsWith("https://gmail.googleapis.com/")) {
      const i = llamadas++;
      if (i === corteEn) return respuesta(429, { error: { message: "Daily Limit Exceeded" } });
      const mime = Buffer.from(JSON.parse(String(init?.body)).raw, "base64url").toString("utf8");
      aceptados.push(/^To: <([^>]+)>/m.exec(mime)![1]);
      return respuesta(200, { id: "m" });
    }
    return fetchReal(url as never, init);
  }) as typeof fetch;
});

after(() => {
  globalThis.fetch = fetchReal;
});

const leer = async (id: string) => (await db.select().from(ed).where(eq(ed.id, id)))[0];

test("si Google corta por el tope diario a mitad de una tanda, al reintentar se continúa tras el último entregado y nadie recibe el boletín dos veces", async () => {
  const [e] = await db.insert(ed).values({ subject: "Edición de prueba", articleSlugs: ["nota-de-prueba"], items: [{ t: "n", slug: "nota-de-prueba" }] }).returning();
  const orden = await db.select({ id: subs.id, email: subs.email }).from(subs).orderBy(asc(subs.id));
  assert.equal(orden.length, 5);

  // 1.ª pasada: Google acepta 3 correos y rechaza el 4.º.
  llamadas = 0;
  corteEn = 3;
  aceptados = [];
  const r1 = await envio.enviarTanda(e.id, { origen: "navegador", tiempoMs: 20_000 });
  assert.equal(r1.ok, false);
  assert.equal(r1.done, false);
  assert.equal(r1.delivered, 3, "se informa lo realmente entregado");
  assert.match(r1.message ?? "", /límite de envíos/);
  const a = await leer(e.id);
  assert.equal(a.status, "enviando");
  assert.equal(a.delivered, 3);
  assert.equal(a.cursor, orden[2].id, "el cursor queda en el último entregado, no al principio de la tanda");
  assert.equal(a.failed, 1, "un solo intento fallido (el rechazado)");
  assert.deepEqual(aceptados, orden.slice(0, 3).map((s) => s.email));

  // 2.ª pasada (otro día, con el límite repuesto): termina con los dos que faltaban.
  corteEn = -1;
  const r2 = await envio.enviarTanda(e.id, { origen: "navegador", tiempoMs: 20_000 });
  assert.equal(r2.ok, true);
  assert.equal(r2.done, true);
  assert.equal(r2.delivered, 5);
  assert.deepEqual([...aceptados].sort(), orden.map((s) => s.email).sort(), "cada lector, exactamente una vez");
  const b = await leer(e.id);
  assert.equal(b.status, "enviada");
  assert.equal(b.delivered, 5);
});

test("un envío sin cortes entrega a todos, en orden, y avanza el cursor hasta el último", async () => {
  const [e] = await db.insert(ed).values({ subject: "Otra edición", articleSlugs: ["nota-de-prueba"], items: [{ t: "n", slug: "nota-de-prueba" }] }).returning();
  const orden = await db.select({ id: subs.id, email: subs.email }).from(subs).orderBy(asc(subs.id));
  llamadas = 0;
  corteEn = -1;
  aceptados = [];
  const r = await envio.enviarTanda(e.id, { origen: "navegador", tiempoMs: 20_000 });
  assert.deepEqual([r.ok, r.done, r.delivered], [true, true, 5]);
  assert.deepEqual(aceptados, orden.map((s) => s.email));
  assert.equal((await leer(e.id)).failed, 0);
});
