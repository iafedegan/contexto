import test, { before } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { prepararBd } from "@/test-utils/bd-memoria";

let bd: typeof import("@/db");
let esq: typeof import("@/db/schema");
let ops: typeof import("@/lib/article-ops");

before(async () => {
  await prepararBd();
  bd = await import("@/db");
  esq = await import("@/db/schema");
  ops = await import("@/lib/article-ops");
});

const nota = async (slug: string, status: "publicado" | "borrador", legacyPath: string | null = null, categoryId: string | null = null) =>
  (await bd.db.insert(esq.articles).values({ slug, title: slug, excerpt: "x", body: "<p>x</p>", status, legacyPath, categoryId, publishedAt: status === "publicado" ? new Date() : null }).returning({ id: esq.articles.id }))[0].id;
const slugDe = async (id: string) => (await bd.db.select({ s: esq.articles.slug, l: esq.articles.legacyPath }).from(esq.articles).where(eq(esq.articles.id, id)))[0];

test("la columna publicada se queda con la dirección limpia aunque un borrador la ocupara, y deja la 301", async () => {
  const [op] = await bd.db.insert(esq.categories).values({ slug: "opinion", name: "Opinión" }).returning({ id: esq.categories.id });
  const borrador = await nota("fedegan-5-0-la-vision-de-un-gremio", "borrador");
  const columna = await nota("fedegan-5-0-la-vision-de-un-gremio-mwp9bxru", "publicado", "/columna/fedegan-5-0-la-vision-de-un-gremio-mwp9bxru", op.id);
  const cambios = await ops.limpiarSufijosDeDirecciones();
  assert.deepEqual(cambios, [{ desde: "/columna/fedegan-5-0-la-vision-de-un-gremio-mwp9bxru", hasta: "/columna/fedegan-5-0-la-vision-de-un-gremio" }]);
  assert.equal((await slugDe(columna)).s, "fedegan-5-0-la-vision-de-un-gremio");
  assert.equal((await slugDe(columna)).l, "/columna/fedegan-5-0-la-vision-de-un-gremio");
  assert.equal((await slugDe(borrador)).s, "fedegan-5-0-la-vision-de-un-gremio-2", "el borrador cede la dirección");
  const [r] = await bd.db.select().from(esq.redirects).where(eq(esq.redirects.fromPath, "/columna/fedegan-5-0-la-vision-de-un-gremio-mwp9bxru"));
  assert.equal(r?.toPath, "/columna/fedegan-5-0-la-vision-de-un-gremio");
  assert.equal(r?.statusCode, 301);
  assert.deepEqual(await ops.limpiarSufijosDeDirecciones(), [], "repetirlo no cambia nada");
});

test("si la dirección limpia es de otra nota publicada, la nueva lleva número corto", async () => {
  await nota("tema-repetido", "publicado");
  const otra = await nota("tema-repetido-mx1a2b3c", "publicado");
  await ops.limpiarSufijosDeDirecciones();
  assert.equal((await slugDe(otra)).s, "tema-repetido-2");
});
