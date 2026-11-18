import test, { before } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { prepararBd } from "@/test-utils/bd-memoria";

let bd: typeof import("@/db");
let esquema: typeof import("@/db/schema");
let asig: typeof import("@/lib/notas-asignadas");

before(async () => {
  await prepararBd();
  bd = await import("@/db");
  esquema = await import("@/db/schema");
  asig = await import("@/lib/notas-asignadas");
});

async function escenario() {
  const t = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const [autor] = await bd.db.insert(esquema.users).values({ name: "Autora Envía", email: `a-${t}@ej.com`, role: "redactor" }).returning({ id: esquema.users.id });
  const [editor] = await bd.db.insert(esquema.users).values({ name: "Editor Recibe", email: `e-${t}@ej.com`, role: "editor" }).returning({ id: esquema.users.id });
  const [nota] = await bd.db.insert(esquema.articles).values({ slug: `dev-${t}`, title: "Nota asignada", excerpt: "R.", body: "<p>T.</p>", status: "en_revision" }).returning({ id: esquema.articles.id });
  await asig.registrarAsignacion({ articleId: nota.id, editorId: editor.id, porId: autor.id, mensaje: "Revísala", fecha: new Date().toISOString() });
  return { autor: autor.id, editor: editor.id, nota: nota.id };
}

test("el editor devuelve la nota a quien se la envió: cambia la asignación y vuelve a borrador", async () => {
  const e = await escenario();
  const ajeno = await asig.devolverAsignacion(e.nota, e.autor, "redactor", "x");
  assert.equal(ajeno.ok, false, "quien no la recibió no puede devolverla");
  const r = await asig.devolverAsignacion(e.nota, e.editor, "editor", "Corregida");
  assert.equal(r.ok, true);
  const envio = await asig.asignacionDe(e.nota);
  assert.equal(envio?.editorId, e.autor);
  assert.equal(envio?.porId, e.editor);
  const [n] = await bd.db.select({ s: esquema.articles.status }).from(esquema.articles).where(eq(esquema.articles.id, e.nota));
  assert.equal(n.s, "borrador");
});

test("quitar de mis pendientes: solo quien la recibió", async () => {
  const e = await escenario();
  assert.equal((await asig.soltarAsignacion(e.nota, e.autor, "redactor")).ok, false);
  assert.equal((await asig.soltarAsignacion(e.nota, e.editor, "editor")).ok, true);
  assert.equal(await asig.asignacionDe(e.nota), null);
});
