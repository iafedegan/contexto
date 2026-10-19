import test, { before } from "node:test";
import assert from "node:assert/strict";
import { prepararBd } from "@/test-utils/bd-memoria";

before(prepararBd);

test("la base marca cada nota con la región y el departamento que menciona, también al editarla", async () => {
  const { db, schema } = await import("@/db");
  const { eq } = await import("drizzle-orm");
  const { articles } = schema;
  const base = { excerpt: "", body: "<p>x</p>", status: "publicado" as const, publishedAt: new Date() };
  await db.insert(articles).values([
    { ...base, slug: "z-monteria", title: "Feria ganadera en Montería" },
    { ...base, slug: "z-nada", title: "Precio del bono de carbono" },
  ]);
  const zonas = async (slug: string) => (await db.select({ z: articles.zonas }).from(articles).where(eq(articles.slug, slug)))[0].z;
  const z = await zonas("z-monteria");
  assert.ok(z.includes("region-caribe") && z.includes("depto-cordoba"));
  assert.deepEqual(await zonas("z-nada"), []);
  await db.update(articles).set({ title: "Subasta en Villavicencio" }).where(eq(articles.slug, "z-nada"));
  const z2 = await zonas("z-nada");
  assert.ok(z2.includes("region-orinoquia") && z2.includes("depto-meta"));
});
