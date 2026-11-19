import { test } from "node:test";
import assert from "node:assert/strict";
import { palabrasCambiadas, papelEnNota } from "./actividad-reglas";

test("palabras cambiadas: cuenta lo agregado y lo quitado, no lo que solo se movió", () => {
  assert.equal(palabrasCambiadas("<p>el ganado sube</p>", "<p>el ganado sube</p>"), 0);
  assert.equal(palabrasCambiadas("<p>a b c</p><p>d e</p>", "<p>d e</p><p>a b c</p>"), 0);
  assert.equal(palabrasCambiadas("<p>el ganado sube</p>", "<p>el ganado baja mucho</p>"), 3);
});

test("papel en una nota enviada: intervino, revisó o sin abrir", () => {
  assert.equal(papelEnNota({ recibio: false, reviso: true, palabras: 100 }), null);
  assert.equal(papelEnNota({ recibio: true, reviso: true, palabras: 40 }), "intervino");
  assert.equal(papelEnNota({ recibio: true, reviso: true, palabras: 3 }), "reviso");
  assert.equal(papelEnNota({ recibio: true, reviso: false, palabras: 0 }), "sin-abrir");
});
