import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Cada acción del panel que recibe el id de una nota debe comprobar que es de la persona (los administradores, todas). Se verifica
 * en el código: es la única forma de que no se olvide una acción nueva sin que nadie lo note.
 */
const actions = readFileSync("src/app/panel/(app)/articulos/actions.ts", "utf8");

test("toda acción sobre una nota comprueba que sea de la persona", () => {
  for (const nombre of ["submitForReview", "publishArticle", "scheduleArticle", "unpublishArticle", "setArticleFlag", "deleteArticle"]) {
    const i = actions.indexOf(`export async function ${nombre}(`);
    assert.ok(i >= 0, `no existe ${nombre}`);
    const cuerpo = actions.slice(i, actions.indexOf("\n}\n", i));
    assert.match(cuerpo, /esNotaPropia|exigirNotaPropia/, `${nombre} no comprueba que la nota sea de la persona`);
  }
});

test("guardar y autoguardar una nota existente también lo comprueban", () => {
  assert.match(actions, /if \(id\) \{\s*await exigirNotaPropia\(user, id\)/);
  assert.match(actions, /if \(input\.id\) await exigirNotaPropia\(user, input\.id\)/);
});

test("al abrir una nota por su dirección se comprueba la propiedad", () => {
  const pagina = readFileSync("src/app/panel/(app)/articulos/[id]/page.tsx", "utf8");
  assert.match(pagina, /esNotaPropia\(/);
});
