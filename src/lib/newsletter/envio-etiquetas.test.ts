import test, { before } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { prepararBd } from "@/test-utils/bd-memoria";

/** Una edición dirigida a una etiqueta solo se envía a quienes la llevan (y que además están activos). */

type Envio = typeof import("@/lib/newsletter/envio");
let envio: Envio;
let db: typeof import("@/db").db;
let ed: typeof import("@/db/schema").newsletterEditions;

before(async () => {
  // Sin clave del proveedor y en «development», el envío se SIMULA: cuenta como entregado pero no sale ningún correo.
  (process.env as Record<string, string>).NODE_ENV = "development";
  await prepararBd();
  envio = await import("@/lib/newsletter/envio");
  ({ db } = await import("@/db"));
  const schema = await import("@/db/schema");
  ed = schema.newsletterEditions;
  await db.insert(schema.articles).values({ slug: "nota-de-prueba", title: "Nota de prueba", excerpt: "Resumen", body: "<p>Cuerpo</p>", status: "publicado", publishedAt: new Date(Date.now() - 86_400_000) });
  await db.insert(schema.newsletterSubscribers).values([
    { email: "a@x.co", confirmed: true, tags: ["Aliados"] },
    { email: "b@x.co", confirmed: true, tags: [] },
    { email: "c@x.co", confirmed: true, tags: ["Prensa", "Aliados"] },
    { email: "d@x.co", confirmed: false, tags: ["Aliados"] },
    { email: "e@x.co", confirmed: true, unsubscribedAt: new Date(), tags: ["Aliados"] },
  ]);
});

const crear = async (audience: unknown) =>
  (await db.insert(ed).values({ subject: "Edición", articleSlugs: ["nota-de-prueba"], items: [{ t: "n", slug: "nota-de-prueba" }], status: "programada", scheduledFor: new Date(Date.now() - 60_000), audience: audience as never }).returning())[0];

test("la edición dirigida a «Aliados» llega solo a quienes la llevan y están activos", async () => {
  const e = await crear({ etiquetas: ["Aliados"] });
  await envio.procesarBoletinesProgramados({ forzar: true });
  const f = (await db.select().from(ed).where(eq(ed.id, e.id)))[0];
  assert.equal(f.status, "enviada");
  assert.equal(f.total, 2, "a y c; d no confirmó y e se dio de baja");
  assert.equal(f.delivered, 2);
});

test("una etiqueta que nadie lleva deja la edición en borrador en vez de enviarla a todos", async () => {
  const e = await crear({ etiquetas: ["Inexistente"] });
  const r = await envio.procesarBoletinesProgramados({ forzar: true });
  assert.equal(r[0].ok, false);
  const f = (await db.select().from(ed).where(eq(ed.id, e.id)))[0];
  assert.equal(f.status, "borrador");
});
