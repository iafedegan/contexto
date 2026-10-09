import test from "node:test";
import assert from "node:assert/strict";
import { homeStyleImageBox, sanitizeHomeStyle } from "@/lib/home-style";

test("sin medidas ni porcentaje la imagen no lleva estilo propio", () => {
  assert.deepEqual(homeStyleImageBox(null), { css: undefined, alto: false });
  assert.deepEqual(homeStyleImageBox({ imageScale: 100 }), { css: undefined, alto: false });
});

test("el porcentaje de siempre sigue funcionando", () => {
  assert.deepEqual(homeStyleImageBox({ imageScale: 70 }), { css: { width: "70%", marginInline: "auto" }, alto: false });
});

test("solo el ancho en px conserva la proporción: no fija la altura", () => {
  const { css, alto } = homeStyleImageBox({ imageWidth: 480 });
  assert.equal(css?.width, "480px");
  assert.equal(css?.maxWidth, "100%");
  assert.equal(css?.height, undefined);
  assert.equal(alto, false);
});

test("solo el alto en px fija la altura y ocupa el ancho de la tarjeta", () => {
  const { css, alto } = homeStyleImageBox({ imageHeight: 320 });
  assert.equal(css?.height, "320px");
  assert.equal(css?.aspectRatio, "auto");
  assert.equal(css?.width, undefined);
  assert.equal(alto, true);
});

test("las medidas en px mandan sobre el porcentaje", () => {
  const { css } = homeStyleImageBox({ imageScale: 50, imageWidth: 600, imageHeight: 300 });
  assert.equal(css?.width, "600px");
  assert.equal(css?.height, "300px");
});

test("ancho y alto se acotan al guardar y lo que no es número se descarta", () => {
  assert.deepEqual(sanitizeHomeStyle({ imageWidth: 99999, imageHeight: 5 }), { imageWidth: 2000, imageHeight: 40 });
  assert.equal(sanitizeHomeStyle({ imageWidth: "600", imageHeight: null }), null);
  assert.deepEqual(sanitizeHomeStyle({ imageWidth: 640.4 }), { imageWidth: 640 });
});

test("la posición del texto sobre la foto solo admite las esquinas de arriba; lo demás se descarta", () => {
  assert.deepEqual(sanitizeHomeStyle({ textPos: "arriba-izq" }), { textPos: "arriba-izq" });
  assert.deepEqual(sanitizeHomeStyle({ textPos: "arriba-der" }), { textPos: "arriba-der" });
  assert.equal(sanitizeHomeStyle({ textPos: "abajo" }), null);
  assert.equal(sanitizeHomeStyle({ textPos: "<script>" }), null);
});
