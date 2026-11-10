import test from "node:test";
import assert from "node:assert/strict";
import { destinoPermitido, destinosPara, envioLibre, puedeEnviarNota, type Destino } from "./notas-asignadas-reglas";

const gente: Destino[] = [
  { id: "r1", nombre: "Rosa", rol: "redactor" },
  { id: "d1", nombre: "Diego", rol: "disenador" },
  { id: "e1", nombre: "Elena", rol: "editor" },
  { id: "a1", nombre: "Álvaro", rol: "administrador" },
];

test("envían notas los redactores, los editores y los administradores; los diseñadores no", () => {
  assert.equal(puedeEnviarNota("redactor"), true);
  assert.equal(puedeEnviarNota("editor"), true);
  assert.equal(puedeEnviarNota("administrador"), true);
  assert.equal(puedeEnviarNota("disenador"), false);
});

test("un redactor solo ve editores y administradores", () => {
  assert.deepEqual(destinosPara("redactor", "r1", gente).map((p) => p.id), ["a1", "e1"]);
});

test("un editor ve a todas las personas activas menos a sí mismo", () => {
  assert.equal(envioLibre("editor"), true);
  assert.deepEqual(destinosPara("editor", "e1", gente).map((p) => p.id), ["a1", "d1", "r1"]);
});

test("un administrador también ve a todos, sin él", () => {
  assert.deepEqual(destinosPara("administrador", "a1", gente).map((p) => p.id), ["d1", "e1", "r1"]);
});

test("un redactor no puede enviarle una nota a otro redactor ni a un diseñador", () => {
  assert.equal(destinoPermitido("redactor", "redactor"), false);
  assert.equal(destinoPermitido("redactor", "disenador"), false);
  assert.equal(destinoPermitido("redactor", "editor"), true);
  assert.equal(destinoPermitido("editor", "redactor"), true);
});
