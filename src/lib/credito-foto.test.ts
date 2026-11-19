import test from "node:test";
import assert from "node:assert/strict";
import { creditoFotoValido } from "./credito-foto";

test("créditos válidos", () => {
  for (const t of ["Foto: Ana Ruiz / El Tiempo", "Cortesía: Fedegán", "Archivo CONtexto Ganadero", "Archivo FEDEGÁN", "Imagen generada con inteligencia artificial (Google Gemini) para CONtexto Ganadero.", "Ganado en el Llano. Foto: Nombre Apellido / CONtexto Ganadero"]) assert.equal(creditoFotoValido(t), true, t);
});
test("créditos que no sirven", () => {
  for (const t of ["", "  ", "Foto:", "Foto: ", "Cortesía:", "una vaca", "Archivo", null, undefined]) assert.equal(creditoFotoValido(t as string), false, String(t));
  assert.equal(creditoFotoValido("x".repeat(301)), false);
});
