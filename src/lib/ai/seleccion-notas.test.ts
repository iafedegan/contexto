import test from "node:test";
import assert from "node:assert/strict";
import { limpiarSeleccion } from "./seleccion-notas";

test("extrae los números en orden, sin repetir y dentro del rango", () => {
  assert.deepEqual(limpiarSeleccion("3, 1, 7, 3, 12, 0, 99", 8), [3, 1, 7]);
  assert.deepEqual(limpiarSeleccion("Las notas 2 y 5 son las relevantes", 8), [2, 5]);
});

test("respeta el máximo y devuelve [] cuando dice que ninguna sirve", () => {
  assert.deepEqual(limpiarSeleccion("1,2,3,4,5,6,7,8,9", 9), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(limpiarSeleccion("ninguna", 8), []);
  assert.deepEqual(limpiarSeleccion("", 8), []);
});
