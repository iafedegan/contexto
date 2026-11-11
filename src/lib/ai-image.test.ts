import test from "node:test";
import assert from "node:assert/strict";
import { altDeEscena, creditoImagenIA, MAX_ALT, PREFIJO_IMAGEN_IA } from "./ai-image";

test("el texto alternativo de una portada con IA lleva el prefijo y no pasa de 125 caracteres", () => {
  const escena = "De espaldas en primer plano, un ganadero colombiano con sombrero de paja y botas de caucho vigila con determinación a su hato de ganado cebú y brahman disperso en un potrero abierto de la sabana, bajo un cielo denso y encapotado que anticipa la tormenta.";
  const alt = altDeEscena(escena);
  assert.ok(alt.startsWith(PREFIJO_IMAGEN_IA));
  assert.ok(alt.length <= MAX_ALT, `mide ${alt.length}`);
  assert.ok(alt.endsWith("…"), "se recortó por palabras");
});

test("una escena corta entra completa, solo su primera frase", () => {
  assert.equal(altDeEscena("Un corral al amanecer. Con vacas."), `${PREFIJO_IMAGEN_IA} Un corral al amanecer.`);
});

test("el crédito nombra a la IA y al modelo", () => {
  assert.match(creditoImagenIA(true), /Nano Banana Pro/);
  assert.match(creditoImagenIA(false), /Google Gemini/);
  assert.doesNotMatch(creditoImagenIA(false), /Nano Banana/);
});
