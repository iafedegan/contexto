import test from "node:test";
import assert from "node:assert/strict";
import { etapaDeNota } from "./tablero-notas";

const base = { imagenPendiente: false, paraEditor: false };

test("un borrador está con el redactor", () => {
  assert.equal(etapaDeNota({ ...base, estado: "borrador" }), "redactor");
});

test("una nota en revisión o enviada a un editor está con el editor", () => {
  assert.equal(etapaDeNota({ ...base, estado: "en_revision" }), "editor");
  assert.equal(etapaDeNota({ ...base, estado: "borrador", paraEditor: true }), "editor");
});

test("una imagen pedida y pendiente deja la nota con el diseñador, esté en borrador o en revisión", () => {
  assert.equal(etapaDeNota({ ...base, estado: "borrador", imagenPendiente: true }), "disenador");
  assert.equal(etapaDeNota({ ...base, estado: "en_revision", imagenPendiente: true }), "disenador");
});

test("las notas programadas y publicadas se quedan en su columna aunque tengan un pedido pendiente", () => {
  assert.equal(etapaDeNota({ ...base, estado: "programado", imagenPendiente: true }), "programadas");
  assert.equal(etapaDeNota({ ...base, estado: "publicado", imagenPendiente: true }), "publicadas");
});
