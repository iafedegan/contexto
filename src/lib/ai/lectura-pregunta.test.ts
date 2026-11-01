import test from "node:test";
import assert from "node:assert/strict";
import { leerPregunta, mencionaClave, publicadaDesde, separarPorTema } from "./lectura-pregunta";

const AHORA = new Date("2026-10-31T12:00:00Z");

test("quita de las palabras clave la forma de pedir y conserva las tildes del tema", () => {
  assert.deepEqual(leerPregunta("noticias recientes sobre vacunación").claves, ["vacunación"]);
  assert.deepEqual(leerPregunta("qué dijo Lafaurie esta semana").claves, ["lafaurie"]);
  assert.deepEqual(leerPregunta("exportaciones de carne a Egipto").claves, ["exportaciones", "carne", "egipto"]);
  assert.deepEqual(leerPregunta("últimas noticias").claves, []);
});

test("distingue si pide notas", () => {
  assert.equal(leerPregunta("noticias de aftosa").pideNotas, true);
  assert.equal(leerPregunta("cuál es el inventario bovino").pideNotas, false);
});

test("lee el periodo pedido", () => {
  const semana = leerPregunta("qué dijo Lafaurie esta semana", AHORA);
  assert.equal(semana.periodo, "esta semana");
  assert.equal(semana.desde?.toISOString(), "2026-10-24T12:00:00.000Z");
  assert.equal(leerPregunta("notas de este año", AHORA).periodo, "este año");
  assert.equal(leerPregunta("aftosa", AHORA).desde, null);
});

test("reconoce la palabra con otra terminación, sin buscarla dentro de otras", () => {
  assert.equal(mencionaClave("¡Ganaderos a vacunar!", "vacunación"), true);
  assert.equal(mencionaClave("Colombia exportaría bovinos", "exportaciones"), true);
  assert.equal(mencionaClave("Un encarnecido debate", "carne"), false);
  assert.equal(mencionaClave("¿Quién se comió mi carne?", "vacunación"), false);
});

test("separa las notas del tema, de la más nueva a la más vieja", () => {
  const notas = [
    { title: "¿Quién se comió mi carne?", summary: "El precio", publishedAt: "2026-10-12T00:00:00Z" },
    { title: "Ciclo de vacunación", summary: "", publishedAt: "2026-10-07T00:00:00Z" },
    { title: "Ganaderos a vacunar", summary: "Viene el segundo ciclo", publishedAt: "2026-10-09T00:00:00Z" },
  ];
  const { delTema, resto } = separarPorTema(notas, ["ciclo", "vacunación"]);
  assert.deepEqual(delTema.map((n) => n.publishedAt), ["2026-10-09T00:00:00Z", "2026-10-07T00:00:00Z"]);
  assert.deepEqual(resto.map((n) => n.title), ["¿Quién se comió mi carne?"]);
});

test("la que tiene el tema en el título va antes que una más nueva que solo lo tiene en el resumen", () => {
  const notas = [
    { title: "Cinco ganaderías exitosas", summary: "Hablarán de exportaciones de carne", publishedAt: "2026-10-11T00:00:00Z" },
    { title: "Exportaciones de carne en rojo", summary: "", publishedAt: "2026-09-10T00:00:00Z" },
  ];
  assert.deepEqual(separarPorTema(notas, ["exportaciones", "carne"]).delTema.map((n) => n.title), ["Exportaciones de carne en rojo", "Cinco ganaderías exitosas"]);
});

test("sin palabras clave todas cuentan como del tema", () => {
  const notas = [{ title: "A", summary: "" }];
  assert.deepEqual(separarPorTema(notas, []).delTema, notas);
});

test("filtra por fecha de publicación", () => {
  const notas = [{ publishedAt: "2026-10-30T00:00:00Z" }, { publishedAt: "2026-10-01T00:00:00Z" }, { publishedAt: null }];
  assert.equal(publicadaDesde(notas, new Date("2026-10-24T00:00:00Z")).length, 1);
  assert.equal(publicadaDesde(notas, null).length, 3);
});
