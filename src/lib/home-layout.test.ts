import test from "node:test";
import assert from "node:assert/strict";
import { anchaEnCelular, splitHomeSlots } from "@/lib/home-layout";

// Qué notas ocupan el ancho completo en la rejilla de dos columnas del celular.
const anchas = (total: number) => Array.from({ length: total }, (_, i) => anchaEnCelular(i, total));

test("en el celular la primera nota ocupa el ancho y el resto va de a dos", () => {
  assert.deepEqual(anchas(1), [true]);
  assert.deepEqual(anchas(3), [true, false, false]);
  assert.deepEqual(anchas(5), [true, false, false, false, false]);
});

test("si tras la primera queda un número impar de notas, la última también ocupa el ancho (no queda una tarjeta sola)", () => {
  assert.deepEqual(anchas(2), [true, true]);
  assert.deepEqual(anchas(4), [true, false, false, true]);
  assert.deepEqual(anchas(6), [true, false, false, false, false, true]);
});

test("las filas de a dos siempre quedan completas", () => {
  for (let total = 1; total <= 14; total++) {
    const medias = anchas(total).filter((ancha) => !ancha).length;
    assert.equal(medias % 2, 0, `con ${total} notas las de media columna deben ser pares (hay ${medias})`);
  }
});

test("la portada reparte las notas en destacada, segunda, columna lateral y río", () => {
  const { lead, second, rail, river } = splitHomeSlots([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(lead, 1);
  assert.equal(second, 2);
  assert.deepEqual(rail, [3, 4, 5, 6]);
  assert.deepEqual(river, [7, 8, 9, 10]);
});
