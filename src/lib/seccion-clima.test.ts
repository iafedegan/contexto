import test, { before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { asc, eq, isNull, sql } from "drizzle-orm";
import { prepararBd } from "@/test-utils/bd-memoria";

let bd: typeof import("@/db");
let esquema: typeof import("@/db/schema");

// Las sentencias de la migración, como las pega alguien en el SQL Editor.
const sentencias = readFileSync("drizzle/0038_seccion_clima.sql", "utf8").split("--> statement-breakpoint");
const aplicar = async () => {
  for (const s of sentencias) await bd.db.execute(sql.raw(s));
};

// Notas de prueba: [dirección, título, resumen, etiquetas, ¿debe entrar a Clima?].
const NOTAS: Array<[string, string, string, string[], boolean]> = [
  ["lluvias", "Las lluvias dejan pérdidas en fincas del Cesar", "Ganaderos reportan potreros anegados.", [], true],
  ["sequia", "Ganaderos piden ayudas por la sequía", "El hato pierde peso.", [], true],
  ["el-nino", "El Niño llegaría en diciembre, advierte el gremio", "Recomiendan guardar forraje.", [], true],
  ["etiqueta", "Recomendaciones para el manejo de praderas", "Cómo rotar potreros.", ["clima", "praderas"], true],
  ["climatico", "El cambio climático obliga a repensar la ganadería", "Un estudio lo confirma.", [], true],
  ["nino", "El niño que ordeña veinte vacas antes de ir a la escuela", "Una historia del campo.", [], false],
  ["climatizado", "Estrenan frigorífico climatizado en Montería", "Inversión privada.", [], false],
  ["precio", "El precio del novillo gordo sube 4 % en Medellín", "Subastas con buena oferta.", ["precios"], false],
];

before(async () => {
  await prepararBd();
  bd = await import("@/db");
  esquema = await import("@/db/schema");
  const { categories, articles } = esquema;
  await bd.db.insert(categories).values([
    { slug: "ganaderia", name: "Ganadería", sortOrder: 1 },
    { slug: "tendencias", name: "Tendencias", sortOrder: 2 },
    { slug: "opinion", name: "Opinión", sortOrder: 3 },
  ]);
  const [ganaderia] = await bd.db.select({ id: categories.id }).from(categories).where(eq(categories.slug, "ganaderia"));
  await bd.db.insert(articles).values(
    NOTAS.map(([slug, title, excerpt, tags]) => ({ slug, title, excerpt, body: "<p>Texto.</p>", tags, categoryId: ganaderia.id, secciones: ["region-caribe"] })),
  );
  await aplicar();
});

test("crea Clima como sección principal justo después de Tendencias y corre a las que seguían", async () => {
  const { categories } = esquema;
  const filas = await bd.db.select({ slug: categories.slug }).from(categories).where(isNull(categories.parentId)).orderBy(asc(categories.sortOrder));
  assert.deepEqual(filas.map((f) => f.slug), ["ganaderia", "tendencias", "clima", "opinion"]);
});

test("suma a Clima las notas de clima sin sacarlas de su sección ni borrar sus otras secciones", async () => {
  const { categories, articles } = esquema;
  const [ganaderia] = await bd.db.select({ id: categories.id }).from(categories).where(eq(categories.slug, "ganaderia"));
  const filas = await bd.db.select({ slug: articles.slug, secciones: articles.secciones, categoryId: articles.categoryId }).from(articles);
  for (const [slug, , , , entra] of NOTAS) {
    const f = filas.find((x) => x.slug === slug)!;
    assert.equal(f.secciones.includes("clima"), entra, `${slug}: ${entra ? "debía entrar a Clima" : "no debía entrar a Clima"}`);
    assert.equal(f.categoryId, ganaderia.id, `${slug}: cambió de sección principal`);
    assert.ok(f.secciones.includes("region-caribe"), `${slug}: perdió sus otras secciones`);
  }
});

test("la página de Clima lista esas notas (por `secciones`, igual que el sitio)", async () => {
  const { enCategorias } = await import("@/lib/content");
  const { categories, articles } = esquema;
  const [clima] = await bd.db.select({ id: categories.id }).from(categories).where(eq(categories.slug, "clima"));
  const filas = await bd.db.select({ slug: articles.slug }).from(articles).where(enCategorias([clima.id], ["clima"]));
  assert.deepEqual(filas.map((f) => f.slug).sort(), NOTAS.filter((n) => n[4]).map((n) => n[0]).sort());
});

test("correrla otra vez no duplica la sección ni la marca de las notas", async () => {
  await aplicar();
  const { categories, articles } = esquema;
  const climas = await bd.db.select({ id: categories.id }).from(categories).where(eq(categories.slug, "clima"));
  assert.equal(climas.length, 1);
  const filas = await bd.db.select({ secciones: articles.secciones }).from(articles);
  for (const f of filas) assert.ok(f.secciones.filter((s) => s === "clima").length <= 1);
  const orden = await bd.db.select({ slug: categories.slug }).from(categories).where(isNull(categories.parentId)).orderBy(asc(categories.sortOrder));
  assert.deepEqual(orden.map((f) => f.slug), ["ganaderia", "tendencias", "clima", "opinion"]);
});
