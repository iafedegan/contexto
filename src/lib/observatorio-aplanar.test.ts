import { test } from "node:test";
import assert from "node:assert/strict";
import { aplanarObservatorio, fechaDelPeriodo } from "./observatorio-aplanar";
import type { Observatorio } from "./observatorio-fedegan";

test("fechaDelPeriodo entiende años, meses abreviados e ISO", () => {
  assert.equal(fechaDelPeriodo("2025"), "2025-01-01");
  assert.equal(fechaDelPeriodo("sep/2026"), "2026-09-01");
  assert.equal(fechaDelPeriodo("2026-03-15"), "2026-03-01");
  assert.equal(fechaDelPeriodo("raro"), null);
});

test("aplanarObservatorio: una fila por departamento y año, sin valores vacíos, más el total nacional y el hato", () => {
  const o = {
    generales: [],
    departamental: [{ clave: "bovinos", titulo: "Inventario de bovinos", unidad: "cabezas", periodos: ["2024", "2025"], departamentos: [{ nombre: "Antioquia", valores: [10, 12] }, { nombre: "Meta", valores: [null, 7] }], nacional: [30, 35] }],
    hato: [{ clave: "predios", titulo: "Predios por orientación", periodo: "2025", partes: [{ nombre: "Cría", valor: 5 }] }],
    documentos: [],
  } as unknown as Observatorio;
  const f = aplanarObservatorio(o);
  assert.equal(f.filter((x) => x.serie === "Antioquia").length, 2);
  assert.equal(f.filter((x) => x.serie === "Meta").length, 1);
  assert.equal(f.find((x) => x.serie === "Total nacional" && x.periodo === "2025")?.valor, 35);
  assert.equal(f.find((x) => x.tema === "hato")?.valor, 5);
});
