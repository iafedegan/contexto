import test, { before } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { prepararBd } from "@/test-utils/bd-memoria";

let content: typeof import("@/lib/content");
let bd: typeof import("@/db");
let articles: typeof import("@/db/schema").articles;

before(async () => {
  await prepararBd();
  content = await import("@/lib/content");
  bd = await import("@/db");
  articles = (await import("@/db/schema")).articles;
});

const ayer = new Date(Date.now() - 86_400_000);
const nota = (slug: string, extra: Partial<typeof articles.$inferInsert> = {}): typeof articles.$inferInsert => ({ slug, title: slug, excerpt: "e", body: "<p>b</p>", status: "publicado", publishedAt: ayer, ...extra });
// Lecturas de una nota un día (0 = hoy, 8 = hace ocho días), en hora de Colombia.
async function lecturas(slug: string, haceDias: number, n: number) {
  await bd.db.execute(sql`insert into article_views_daily (article_id, day, views)
    select id, (now() at time zone 'America/Bogota')::date - ${haceDias}::int, ${n}::int from articles where slug = ${slug}`);
}

test("Más leídas ordena por lecturas reales de la última semana, de cualquier fecha de publicación", async () => {
  const vieja = new Date(Date.now() - 400 * 86_400_000);
  await bd.db.insert(articles).values([
    nota("tranquila"),
    nota("popular"),
    nota("clasico-que-vuelve", { publishedAt: vieja }),
    nota("fue-popular-hace-un-mes"),
    nota("sin-lecturas"),
    nota("borrador-con-lecturas", { status: "borrador", publishedAt: null }),
  ]);
  await lecturas("tranquila", 0, 3);
  await lecturas("popular", 1, 40);
  await lecturas("popular", 3, 10);
  await lecturas("clasico-que-vuelve", 2, 25);
  await lecturas("fue-popular-hace-un-mes", 8, 500); // fuera de la ventana de 7 días
  await lecturas("borrador-con-lecturas", 0, 999); // no está publicado

  const lista = await content.leerMasLeidas(5);
  assert.deepEqual(lista.map((a) => a.slug), ["popular", "clasico-que-vuelve", "tranquila"]);
});

test("no se rellena con notas que nadie ha leído: hay menos de las pedidas", async () => {
  const lista = await content.leerMasLeidas(5);
  assert.equal(lista.length, 3);
  assert.ok(!lista.some((a) => a.slug === "sin-lecturas" || a.slug === "fue-popular-hace-un-mes"));
});

test("el límite se respeta y empata por el total histórico", async () => {
  await bd.db.insert(articles).values([nota("empate-a", { views: 5 }), nota("empate-b", { views: 90 })]);
  await lecturas("empate-a", 0, 60);
  await lecturas("empate-b", 0, 60);
  const [primera, segunda] = await content.leerMasLeidas(2);
  assert.equal(primera.slug, "empate-b", "con las mismas lecturas de la semana gana la de más lecturas históricas");
  assert.equal(segunda.slug, "empate-a");
  assert.equal((await content.leerMasLeidas(1)).length, 1);
});

test("sin ninguna lectura la lista queda vacía (el bloque no se pinta)", async () => {
  await bd.db.execute(sql`delete from article_views_daily`);
  assert.deepEqual(await content.leerMasLeidas(5), []);
});
