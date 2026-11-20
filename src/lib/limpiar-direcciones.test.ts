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

const nota = async (slug: string, status: "publicado" | "borrador", legacyPath: string | null = null, categoryId: string | null = null, createdAt?: Date) =>
  (await bd.db.insert(esq.articles).values({ slug, title: slug, excerpt: "x", body: "<p>x</p>", status, legacyPath, categoryId, publishedAt: status === "publicado" ? (createdAt ?? new Date()) : null, ...(createdAt ? { createdAt } : {}) }).returning({ id: esq.articles.id }))[0].id;
// Fecha de creación que corresponde a un sufijo (el sufijo era Date.now() en base 36 al crear la nota).
const creadaCon = (sufijo: string) => new Date(parseInt(sufijo, 36) + 500);
const slugDe = async (id: string) => (await bd.db.select({ s: esq.articles.slug, l: esq.articles.legacyPath }).from(esq.articles).where(eq(esq.articles.id, id)))[0];

test("la columna publicada se queda con la dirección limpia aunque un borrador la ocupara, y deja la 301", async () => {
  const [op] = await bd.db.insert(esq.categories).values({ slug: "opinion", name: "Opinión" }).returning({ id: esq.categories.id });
  const borrador = await nota("fedegan-5-0-la-vision-de-un-gremio", "borrador");
  const columna = await nota("fedegan-5-0-la-vision-de-un-gremio-mwp9bxru", "publicado", "/columna/fedegan-5-0-la-vision-de-un-gremio-mwp9bxru", op.id, creadaCon("mwp9bxru"));
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
  const otra = await nota("tema-repetido-mx1a2b3c", "publicado", null, null, creadaCon("mx1a2b3c"));
  await ops.limpiarSufijosDeDirecciones();
  assert.equal((await slugDe(otra)).s, "tema-repetido-2");
});

test("una palabra final con forma de sufijo («-monteria», «-lafaurie») NO se recorta", async () => {
  const a = await nota("las-brigadas-llegaron-a-monteria", "publicado", "/regiones/las-brigadas-llegaron-a-monteria", null, new Date("2012-11-23"));
  const b = await nota("adjudicado-a-dedo-lafaurie", "publicado", null, null, new Date("2016-12-06"));
  await ops.limpiarSufijosDeDirecciones();
  assert.equal((await slugDe(a)).s, "las-brigadas-llegaron-a-monteria");
  assert.equal((await slugDe(b)).s, "adjudicado-a-dedo-lafaurie");
});

test("lo que se recortó por error vuelve a su dirección original y se borran sus redirecciones", async () => {
  // Así quedó una nota tras el error: sin «-medellin» y con la dirección original redirigiendo a la recortada.
  const a = await nota("feria-de-ganado-en", "publicado", "/regiones/feria-de-ganado-en", null, new Date("2015-03-02"));
  await bd.db.insert(esq.redirects).values([
    { fromPath: "/regiones/feria-de-ganado-en-medellin", toPath: "/regiones/feria-de-ganado-en", statusCode: 301 },
    { fromPath: "/articulo/feria-de-ganado-en-medellin", toPath: "/regiones/feria-de-ganado-en", statusCode: 301 },
  ]);
  const hechas = await ops.restaurarDireccionesRecortadas();
  assert.deepEqual(hechas, [{ desde: "/regiones/feria-de-ganado-en", hasta: "/regiones/feria-de-ganado-en-medellin" }]);
  assert.equal((await slugDe(a)).s, "feria-de-ganado-en-medellin");
  assert.equal((await slugDe(a)).l, "/regiones/feria-de-ganado-en-medellin");
  const quedan = await bd.db.select().from(esq.redirects).where(eq(esq.redirects.toPath, "/regiones/feria-de-ganado-en"));
  assert.equal(quedan.length, 0);
  // La limpieza CORRECTA de la columna de FEDEGÁN 5.0 no se deshace.
  const [col] = await bd.db.select().from(esq.redirects).where(eq(esq.redirects.fromPath, "/columna/fedegan-5-0-la-vision-de-un-gremio-mwp9bxru"));
  assert.equal(col?.toPath, "/columna/fedegan-5-0-la-vision-de-un-gremio");
  assert.deepEqual(await ops.restaurarDireccionesRecortadas(), [], "repetirlo no cambia nada");
});
