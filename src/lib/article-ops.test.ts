import test, { before } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { prepararBd } from "@/test-utils/bd-memoria";

let ops: typeof import("@/lib/article-ops");
let bd: typeof import("@/db");
let schema: typeof import("@/db/schema");
let editorId: string;

before(async () => {
  await prepararBd();
  ops = await import("@/lib/article-ops");
  bd = await import("@/db");
  schema = await import("@/db/schema");
  const [u] = await bd.db.insert(schema.users).values({ email: "editor@example.com", name: "Editora", role: "editor", passwordHash: "x" }).returning({ id: schema.users.id });
  editorId = u.id;
});

// Inserta un borrador de IA pendiente.
async function borrador(titulo: string) {
  const [d] = await bd.db
    .insert(schema.agentDrafts)
    .values({ source: "comunicado", sourceRef: "ref", modelVersion: "test", title: titulo, excerpt: "resumen", body: "<p>cuerpo <script>alert(1)</script></p>" })
    .returning({ id: schema.agentDrafts.id });
  return d.id;
}

test("aprobar un borrador crea UNA nota en borrador, firmada por quien aprueba y con el cuerpo saneado", async () => {
  const id = await borrador("Precio del novillo sube");
  const articleId = await ops.aprobarBorradorCore(editorId, id);
  const [nota] = await bd.db.select().from(schema.articles).where(eq(schema.articles.id, articleId));
  assert.equal(nota.status, "borrador", "aprobar nunca publica");
  assert.equal(nota.createdBy, editorId);
  assert.ok(nota.authorId, "tiene firma humana");
  assert.ok(!nota.body.includes("<script"), "el cuerpo se sanea");
  const [d] = await bd.db.select().from(schema.agentDrafts).where(eq(schema.agentDrafts.id, id));
  assert.equal(d.status, "aprobado");
  assert.equal(d.approvedBy, editorId);
  assert.equal(d.publishedArticleId, articleId);
});

test("aprobar dos veces a la vez crea una sola nota; la segunda falla sin dejar nada a medias", async () => {
  const id = await borrador("Subasta de Medellín");
  const resultados = await Promise.allSettled([ops.aprobarBorradorCore(editorId, id), ops.aprobarBorradorCore(editorId, id), ops.aprobarBorradorCore(editorId, id)]);
  assert.equal(resultados.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(resultados.filter((r) => r.status === "rejected").length, 2);
  const notas = await bd.db.select().from(schema.articles).where(eq(schema.articles.originDraftId, id));
  assert.equal(notas.length, 1);
});

test("un borrador ya aprobado o rechazado no se puede aprobar", async () => {
  const id = await borrador("Otro borrador");
  await bd.db.update(schema.agentDrafts).set({ status: "rechazado" }).where(eq(schema.agentDrafts.id, id));
  await assert.rejects(() => ops.aprobarBorradorCore(editorId, id), /no disponible/i);
});

test("dos borradores con el mismo título no chocan en el slug", async () => {
  const a = await ops.aprobarBorradorCore(editorId, await borrador("Título repetido"));
  const b = await ops.aprobarBorradorCore(editorId, await borrador("Título repetido"));
  const filas = await bd.db.select({ slug: schema.articles.slug }).from(schema.articles).where(eq(schema.articles.id, a));
  const filasB = await bd.db.select({ slug: schema.articles.slug }).from(schema.articles).where(eq(schema.articles.id, b));
  assert.notEqual(filas[0].slug, filasB[0].slug);
});

test("enviar a revisión solo vale para notas en borrador o revisión: una publicada no se retira del sitio (H-04)", async () => {
  const [pub] = await bd.db.insert(schema.articles).values({ slug: "ya-publicada", title: "a", excerpt: "e", body: "<p>x</p>", status: "publicado", publishedAt: new Date() }).returning({ id: schema.articles.id });
  await assert.rejects(() => ops.enviarARevisionCore(pub.id), /borrador/);
  assert.equal((await bd.db.select({ s: schema.articles.status }).from(schema.articles).where(eq(schema.articles.id, pub.id)))[0].s, "publicado");
  const [bor] = await bd.db.insert(schema.articles).values({ slug: "borrador-a-revision", title: "a", excerpt: "e", body: "<p>x</p>", status: "borrador" }).returning({ id: schema.articles.id });
  await ops.enviarARevisionCore(bor.id);
  assert.equal((await bd.db.select({ s: schema.articles.status }).from(schema.articles).where(eq(schema.articles.id, bor.id)))[0].s, "en_revision");
});

test("programar exige una fecha futura y válida", async () => {
  const [n] = await bd.db.insert(schema.articles).values({ slug: "a-programar", title: "a", excerpt: "e", body: "<p>x</p>", status: "borrador" }).returning({ id: schema.articles.id });
  await assert.rejects(() => ops.programarCore(n.id, new Date(Date.now() - 60_000).toISOString()), /futura/);
  await assert.rejects(() => ops.programarCore(n.id, "no es una fecha"), /futura/);
  await ops.programarCore(n.id, new Date(Date.now() + 3600_000).toISOString());
  assert.equal((await bd.db.select({ s: schema.articles.status }).from(schema.articles).where(eq(schema.articles.id, n.id)))[0].s, "programado");
});

test("los distintivos avisan si la nota ya no existe", async () => {
  assert.equal(await ops.distintivosCore("00000000-0000-0000-0000-000000000000", { isLive: true }), false);
});

test("cada acción del panel que cambia el estado de una nota exige poder publicar y delega en la misma máquina de estados", async () => {
  const { readFileSync } = await import("node:fs");
  const codigo = readFileSync("src/app/panel/(app)/articulos/actions.ts", "utf8");
  for (const [accion, nucleo] of [["publishArticle", "publicarCore"], ["scheduleArticle", "programarCore"], ["unpublishArticle", "archivarCore"]] as const) {
    const cuerpo = codigo.match(new RegExp(`export async function ${accion}\\([^)]*\\)[^{]*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? "";
    assert.match(cuerpo, /await requirePublicador\(\)/, `${accion} debe exigir el permiso y el rol de publicación`);
    assert.ok(cuerpo.includes(nucleo), `${accion} debe delegar en ${nucleo}`);
  }
  for (const accion of ["deleteArticle", "setArticleFlag"]) {
    const cuerpo = codigo.match(new RegExp(`export async function ${accion}\\([^)]*\\)[^{]*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? "";
    assert.match(cuerpo, /await requirePublicador\(\)/, `${accion} debe exigir el permiso y el rol de publicación`);
  }
});
