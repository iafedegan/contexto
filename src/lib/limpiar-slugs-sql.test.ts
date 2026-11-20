import test, { before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { prepararBd } from "@/test-utils/bd-memoria";

let bd: typeof import("@/db");
let esq: typeof import("@/db/schema");

before(async () => {
  await prepararBd();
  bd = await import("@/db");
  esq = await import("@/db/schema");
});

const nota = async (slug: string, legacyPath: string | null, categoriaId: string | null) =>
  (await bd.db.insert(esq.articles).values({ slug, title: slug, excerpt: "x", body: "<p>x</p>", status: "borrador", legacyPath, categoryId: categoriaId }).returning({ id: esq.articles.id }))[0].id;

test("el SQL de limpieza quita el sufijo al azar, respeta choques y deja redirecciones 301", async () => {
  const [col] = await bd.db.insert(esq.categories).values({ slug: "opinion", name: "Opinión" }).returning({ id: esq.categories.id });
  // Una columna con sufijo cuya dirección limpia está libre, y otra nota «normal» que ocupa una dirección limpia.
  const a = await nota("fedegan-5-0-la-vision-de-un-gremio-mwp9bxru", "/columna/fedegan-5-0-la-vision-de-un-gremio-mwp9bxru", col.id);
  await nota("tema-repetido", null, null);
  const b = await nota("tema-repetido-mwp9bxru", null, null);
  await nota("titulo-normal-2026", null, null);
  const archivo = readFileSync("scripts/limpiar-slugs.sql", "utf8");
  await bd.db.execute(sql.raw(archivo));
  const fila = async (id: string) => (await bd.db.execute(sql`select slug, legacy_path from articles where id = ${id}`) as unknown as { rows?: { slug: string; legacy_path: string | null }[] }).rows?.[0] ?? (await bd.db.execute(sql`select slug, legacy_path from articles where id = ${id}`) as unknown as { slug: string; legacy_path: string | null }[])[0];
  const ra = await fila(a);
  assert.equal(ra.slug, "fedegan-5-0-la-vision-de-un-gremio");
  assert.equal(ra.legacy_path, "/columna/fedegan-5-0-la-vision-de-un-gremio");
  assert.equal((await fila(b)).slug, "tema-repetido-2", "si la limpia está tomada, número corto");
  const redir = (await bd.db.execute(sql`select from_path, to_path, status_code from redirects order by from_path`)) as unknown as { rows?: { from_path: string; to_path: string; status_code: number }[] };
  const filas = redir.rows ?? (redir as unknown as { from_path: string; to_path: string; status_code: number }[]);
  const columna = filas.find((r) => r.from_path === "/columna/fedegan-5-0-la-vision-de-un-gremio-mwp9bxru");
  assert.equal(columna?.to_path, "/columna/fedegan-5-0-la-vision-de-un-gremio");
  assert.equal(columna?.status_code, 301);
  // Repetirlo no cambia nada.
  await bd.db.execute(sql.raw(archivo));
  assert.equal((await fila(a)).slug, "fedegan-5-0-la-vision-de-un-gremio");
});
