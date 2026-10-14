import test, { before } from "node:test";
import assert from "node:assert/strict";
import { prepararBd } from "@/test-utils/bd-memoria";

let content: typeof import("@/lib/content");
let bd: typeof import("@/db");
let schema: typeof import("@/db/schema");

before(async () => {
  await prepararBd();
  content = await import("@/lib/content");
  bd = await import("@/db");
  schema = await import("@/db/schema");
});

test("una nota aparece en su categoría principal y también en las secciones adicionales que se le guardaron", async () => {
  const { db } = bd;
  const { articles, categories } = schema;
  const [colombia] = await db.insert(categories).values({ slug: "colombia", name: "Colombia" }).returning();
  const [regiones, gremialidad] = await db
    .insert(categories)
    .values([{ slug: "regiones", name: "Regiones", parentId: colombia.id }, { slug: "gremialidad", name: "Gremialidad", parentId: colombia.id }])
    .returning();
  const base = { excerpt: "e", body: "<p>b</p>", status: "publicado" as const, publishedAt: new Date(Date.now() - 86_400_000) };
  await db.insert(articles).values([
    { ...base, slug: "solo-regiones", title: "a", categoryId: regiones.id, secciones: ["regiones", "colombia"] },
    { ...base, slug: "regiones-y-gremialidad", title: "b", categoryId: regiones.id, secciones: ["regiones", "gremialidad", "colombia"] },
    { ...base, slug: "solo-gremialidad", title: "c", categoryId: gremialidad.id, secciones: ["gremialidad"] },
    { ...base, slug: "sin-secciones", title: "d", categoryId: null },
  ]);

  const slugsDe = async (ids: string[], slugs: string[]) =>
    (await db.select({ slug: articles.slug }).from(articles).where(content.enCategorias(ids, slugs))).map((r) => r.slug).sort();

  // Gremialidad: la suya y la que está en Regiones pero también se marcó en Gremialidad.
  assert.deepEqual(await slugsDe([gremialidad.id], ["gremialidad"]), ["regiones-y-gremialidad", "solo-gremialidad"]);
  // Regiones: no incluye la que solo es de Gremialidad.
  assert.deepEqual(await slugsDe([regiones.id], ["regiones"]), ["regiones-y-gremialidad", "solo-regiones"]);
  // Colombia (padre con sus hijas): las tres, sin repetir ninguna.
  assert.deepEqual(await slugsDe([colombia.id, regiones.id, gremialidad.id], ["colombia", "regiones", "gremialidad"]), ["regiones-y-gremialidad", "solo-gremialidad", "solo-regiones"]);
  // Sin categorías ni secciones no devuelve nada (y no falla).
  assert.deepEqual(await slugsDe([], []), []);
});
