import test from "node:test";
import assert from "node:assert/strict";
import { PREGUNTAS_POR_DEFECTO, limpiarPreguntas } from "./preguntas-sugeridas";

test("limpia numeración, viñetas y comillas, y conserva solo preguntas bien formadas", () => {
  const r = limpiarPreguntas('1. ¿Qué pasa con el precio del ganado gordo esta semana?\n- «¿Cómo avanza la vacunación contra la aftosa?»\nTexto suelto sin pregunta\n3) ¿Qué regiones lideran la producción de leche?');
  assert.deepEqual(r, ["¿Qué pasa con el precio del ganado gordo esta semana?", "¿Cómo avanza la vacunación contra la aftosa?", "¿Qué regiones lideran la producción de leche?"]);
});

test("descarta repetidas, muy cortas y muy largas, y completa con las de respaldo hasta tres", () => {
  const larga = `¿${"a".repeat(120)}?`;
  const r = limpiarPreguntas(`¿Qué es esto?\n¿Cómo va el precio del novillo gordo hoy?\n¿cómo va el precio del novillo gordo hoy?\n${larga}`);
  assert.equal(r.length, 3);
  assert.equal(r[0], "¿Cómo va el precio del novillo gordo hoy?");
  assert.ok(r.slice(1).every((p) => PREGUNTAS_POR_DEFECTO.includes(p)));
});

test("sin nada utilizable devuelve las de respaldo", () => {
  assert.deepEqual(limpiarPreguntas("no hay preguntas aquí"), PREGUNTAS_POR_DEFECTO);
  assert.deepEqual(limpiarPreguntas(""), PREGUNTAS_POR_DEFECTO);
});
