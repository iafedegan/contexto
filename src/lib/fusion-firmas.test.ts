import test, { before } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { prepararBd } from "@/test-utils/bd-memoria";

let bd: typeof import("@/db");
let esq: typeof import("@/db/schema");
let ua: typeof import("@/lib/user-authors");

before(async () => {
  await prepararBd();
  bd = await import("@/db");
  esq = await import("@/db/schema");
  ua = await import("@/lib/user-authors");
});

test("dos firmas «Pedro Fonseca» (la de la cuenta y la suelta) quedan en una, con todas las notas y la dirección vieja redirigida", async () => {
  const [u] = await bd.db.insert(esq.users).values({ email: "pfonseca@x.co", name: "Pedro Fonseca", role: "redactor", passwordHash: "x" }).returning({ id: esq.users.id });
  const [deCuenta] = await bd.db.insert(esq.authors).values({ slug: "pfonseca", name: "Pedro Fonseca", userId: u.id }).returning({ id: esq.authors.id });
  const [suelta] = await bd.db.insert(esq.authors).values({ slug: "pedro-fonseca", name: "Pedro Fonseca", avatarUrl: "https://x/foto.jpg" }).returning({ id: esq.authors.id });
  const [nueva] = await bd.db.insert(esq.articles).values({ slug: "nueva", title: "Nueva", excerpt: "x", body: "x", authorId: deCuenta.id }).returning({ id: esq.articles.id });
  const [vieja] = await bd.db.insert(esq.articles).values({ slug: "vieja", title: "Vieja", excerpt: "x", body: "x", authorId: suelta.id }).returning({ id: esq.articles.id });

  assert.equal(await ua.fusionarFirmasRepetidas(), 1);
  const firmas = await bd.db.select().from(esq.authors).where(eq(esq.authors.name, "Pedro Fonseca"));
  assert.equal(firmas.length, 1);
  assert.equal(firmas[0].slug, "pedro-fonseca");
  assert.equal(firmas[0].userId, u.id);
  for (const id of [nueva.id, vieja.id]) {
    const [a] = await bd.db.select({ autor: esq.articles.authorId }).from(esq.articles).where(eq(esq.articles.id, id));
    assert.equal(a.autor, suelta.id);
  }
  const [r] = await bd.db.select().from(esq.redirects).where(eq(esq.redirects.fromPath, "/autor/pfonseca"));
  assert.equal(r?.toPath, "/autor/pedro-fonseca");
  assert.equal(await ua.fusionarFirmasRepetidas(), 0, "repetirlo no cambia nada");
});
