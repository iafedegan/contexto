import test from "node:test";
import assert from "node:assert/strict";
import { formatoDeSeccion } from "@/lib/formato-seccion";

test("TV, Radio y Especiales tienen su formato, también sus subsecciones del sitio anterior", () => {
  assert.equal(formatoDeSeccion("tv"), "tv");
  assert.equal(formatoDeSeccion("video", "tv"), "tv");
  assert.equal(formatoDeSeccion("radio"), "radio");
  assert.equal(formatoDeSeccion("audio", "radio"), "radio");
  assert.equal(formatoDeSeccion("especiales"), "especiales");
  assert.equal(formatoDeSeccion("galeria", "especiales"), "especiales");
});

test("una subsección nueva hereda el formato de su madre; el resto usa la cuadrícula de la plantilla", () => {
  assert.equal(formatoDeSeccion("entrevistas-en-video", "tv"), "tv");
  assert.equal(formatoDeSeccion("colombia"), null);
  assert.equal(formatoDeSeccion("regiones", null), null);
  assert.equal(formatoDeSeccion("caribe", "regiones"), null);
});
