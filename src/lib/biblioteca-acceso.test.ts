import test from "node:test";
import assert from "node:assert/strict";
import { carpetasVisibles, estaDentroDe, nombreValido, rutaDe } from "./biblioteca-acceso";

const C = [
  { id: "r", parentId: null, name: "redactores" },
  { id: "n", parentId: "r", name: "Natalia" },
  { id: "n1", parentId: "n", name: "Dalex" },
  { id: "l", parentId: "r", name: "Luis" },
  { id: "p", parentId: null, name: "política" },
];

test("quien gestiona ve todas las carpetas", () => {
  assert.equal(carpetasVisibles(C, [], true).size, 5);
});

test("una carpeta asignada deja ver todo lo que hay dentro, y nada más", () => {
  assert.deepEqual([...carpetasVisibles(C, ["n"], false)].sort(), ["n", "n1"]);
  assert.equal(carpetasVisibles(C, [], false).size, 0);
});

test("asignar una carpeta que ya no existe no abre nada", () => {
  assert.equal(carpetasVisibles(C, ["zzz"], false).size, 0);
});

test("la ruta va de la raíz a la carpeta", () => {
  assert.deepEqual(rutaDe(C, "n1").map((c) => c.name), ["redactores", "Natalia", "Dalex"]);
  assert.deepEqual(rutaDe(C, null), []);
  assert.deepEqual(rutaDe(C, "no"), []);
});

test("detecta si una carpeta está dentro de otra", () => {
  assert.equal(estaDentroDe(C, "n1", "r"), true);
  assert.equal(estaDentroDe(C, "n1", "n1"), true);
  assert.equal(estaDentroDe(C, "p", "r"), false);
});

test("los nombres se limpian y se rechazan los vacíos o larguísimos", () => {
  assert.equal(nombreValido("  Día   del ganadero  "), "Día del ganadero");
  assert.equal(nombreValido("a/b\\c"), "a b c");
  assert.equal(nombreValido("   "), null);
  assert.equal(nombreValido("x".repeat(200)), null);
  assert.equal(nombreValido(42), null);
});
