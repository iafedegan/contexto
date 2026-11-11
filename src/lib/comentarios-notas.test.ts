import test, { before } from "node:test";
import assert from "node:assert/strict";
import { prepararBd } from "@/test-utils/bd-memoria";

let comentarios: typeof import("@/lib/comentarios-notas");
let propiedad: typeof import("@/lib/propiedad-notas");
let bd: typeof import("@/db");
let schema: typeof import("@/db/schema");
let redactor: string;
let editor: string;
let otro: string;
let admin: string;

before(async () => {
  await prepararBd();
  comentarios = await import("@/lib/comentarios-notas");
  propiedad = await import("@/lib/propiedad-notas");
  bd = await import("@/db");
  schema = await import("@/db/schema");
  const crear = async (email: string, role: "redactor" | "editor" | "administrador") => (await bd.db.insert(schema.users).values({ email, name: email.split("@")[0], role, passwordHash: "x" }).returning({ id: schema.users.id }))[0].id;
  redactor = await crear("redactora@example.com", "redactor");
  editor = await crear("editora@example.com", "editor");
  otro = await crear("otra@example.com", "redactor");
  admin = await crear("admin@example.com", "administrador");
});

async function nota(slug: string, estado: "borrador" | "en_revision", creadaPor: string) {
  const [n] = await bd.db.insert(schema.articles).values({ slug, title: "t", excerpt: "e", body: "<p>x</p>", status: estado, createdBy: creadaPor }).returning({ id: schema.articles.id });
  return n.id;
}

test("un comentario cuenta como nuevo para la otra persona y no para quien lo escribió", async () => {
  const id = await nota("nota-comentada", "en_revision", redactor);
  await comentarios.agregarComentario(id, editor, "Falta la fuente del segundo párrafo");
  assert.equal((await comentarios.contarSinLeer(redactor, [id])).get(id), 1);
  assert.equal((await comentarios.contarSinLeer(editor, [id])).get(id) ?? 0, 0);
  assert.equal((await comentarios.totalSinLeer({ id: redactor, role: "redactor" })), 1);
});

test("leer los comentarios apaga el aviso y uno nuevo lo vuelve a encender", async () => {
  const id = await nota("nota-leida", "en_revision", redactor);
  await comentarios.agregarComentario(id, editor, "Primero");
  await comentarios.marcarLeidos(id, redactor);
  assert.equal((await comentarios.contarSinLeer(redactor, [id])).get(id) ?? 0, 0);
  await new Promise((r) => setTimeout(r, 20));
  await comentarios.agregarComentario(id, editor, "Segundo");
  assert.equal((await comentarios.contarSinLeer(redactor, [id])).get(id), 1);
  const lista = await comentarios.listarComentarios(id, redactor);
  assert.deepEqual(lista.map((c) => c.texto), ["Primero", "Segundo"]);
  assert.equal(lista[0].mio, false);
});

test("cada persona ve solo lo que tiene a cargo, lo que debe revisar o su imagen por hacer; el administrador, todo", async () => {
  const propia = await nota("vis-propia", "borrador", redactor);
  const enRevisionAjena = await nota("vis-revision-ajena", "en_revision", otro);
  const borradorAjeno = await nota("vis-borrador-ajeno", "borrador", otro);
  const puede = (id: string, uid: string, role: string) => propiedad.puedeVerNota({ id: uid, role }, id);
  // El redactor ve la suya y no las de otra persona.
  assert.equal(await puede(propia, redactor, "redactor"), true);
  assert.equal(await puede(enRevisionAjena, redactor, "redactor"), false);
  // El editor ve las que están en revisión, pero no el borrador ajeno.
  assert.equal(await puede(enRevisionAjena, editor, "editor"), true);
  assert.equal(await puede(borradorAjeno, editor, "editor"), false);
  // El administrador, todas.
  assert.equal(await puede(borradorAjeno, admin, "administrador"), true);
});
