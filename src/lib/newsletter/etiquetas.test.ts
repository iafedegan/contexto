import test from "node:test";
import assert from "node:assert/strict";
import { MAX_ETIQUETAS_POR_SUSCRIPTOR, agregarEtiqueta, claveEtiqueta, limpiarEtiqueta, quitarEtiqueta, sanitizarEtiquetas } from "@/lib/newsletter/etiquetas";

test("el nombre se limpia: espacios, saltos de línea, caracteres de control y largo", () => {
  assert.equal(limpiarEtiqueta("  Ganaderos   de Antioquia \n"), "Ganaderos de Antioquia");
  assert.equal(limpiarEtiqueta("Con\u0000control\u007f"), "Con control");
  assert.equal(limpiarEtiqueta("x".repeat(100)).length, 40);
  assert.equal(limpiarEtiqueta("   "), "");
  assert.equal(limpiarEtiqueta(42), "");
  assert.equal(limpiarEtiqueta(null), "");
});

test("«Aliados», «aliados» y « Alíados » son la misma etiqueta", () => {
  assert.equal(claveEtiqueta("Aliados"), claveEtiqueta(" aliados "));
  assert.equal(claveEtiqueta("Alíados"), claveEtiqueta("ALIADOS"));
  assert.notEqual(claveEtiqueta("Aliados"), claveEtiqueta("Aliado"));
});

test("una lista válida no repite etiquetas (ni por mayúsculas o tildes) y tiene un máximo", () => {
  assert.deepEqual(sanitizarEtiquetas(["Aliados", "aliados", " ALÍADOS ", "Prensa", "", 7, null]), ["Aliados", "Prensa"]);
  assert.deepEqual(sanitizarEtiquetas("Aliados"), []);
  assert.equal(sanitizarEtiquetas(Array.from({ length: 60 }, (_, i) => `etiqueta ${i}`)).length, MAX_ETIQUETAS_POR_SUSCRIPTOR);
});

test("poner una etiqueta no duplica, respeta el máximo y avisa si cambió", () => {
  assert.deepEqual(agregarEtiqueta([], " Aliados "), { etiquetas: ["Aliados"], cambio: true, lleno: false });
  assert.deepEqual(agregarEtiqueta(["Aliados"], "aliados"), { etiquetas: ["Aliados"], cambio: false, lleno: false });
  assert.deepEqual(agregarEtiqueta(["Aliados"], "   "), { etiquetas: ["Aliados"], cambio: false, lleno: false });
  const llena = Array.from({ length: MAX_ETIQUETAS_POR_SUSCRIPTOR }, (_, i) => `e${i}`);
  assert.deepEqual(agregarEtiqueta(llena, "otra"), { etiquetas: llena, cambio: false, lleno: true });
});

test("quitar una etiqueta ignora mayúsculas y tildes", () => {
  assert.deepEqual(quitarEtiqueta(["Aliados", "Prensa"], "aliados"), { etiquetas: ["Prensa"], cambio: true });
  assert.deepEqual(quitarEtiqueta(["Prensa"], "Aliados"), { etiquetas: ["Prensa"], cambio: false });
});
