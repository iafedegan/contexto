import test from "node:test";
import assert from "node:assert/strict";
import { eleccionSencilla, graficaDeTabla, leerTabla, numero } from "./grafica-tabla";
import { leerCsv } from "./leer-hoja";

test("lee números en formato colombiano e inglés", () => {
  assert.equal(numero("1.234,5"), 1234.5);
  assert.equal(numero("1,234.5"), 1234.5);
  assert.equal(numero("$ 13.000"), 13000);
  assert.equal(numero("43,6 %"), 43.6);
  assert.equal(numero("2.500"), 2500);
  assert.equal(numero("Antioquia"), null);
  assert.equal(numero("(1.200)"), -1200);
});

test("de un CSV con ; arma la gráfica con la primera columna de etiquetas", () => {
  const t = leerCsv("Departamento;Cabezas 2024;Cabezas 2025\nAntioquia;3.100.000;3.250.000\nCórdoba;2.400.000;2.420.000\nCasanare;2.000.000;2.050.000\n");
  const l = leerTabla(t);
  assert.deepEqual(l.numericas, [1, 2]);
  const g = graficaDeTabla(l, eleccionSencilla(l, "inventario.csv"));
  assert.ok(!("error" in g));
  if ("error" in g) return;
  assert.deepEqual(g.labels, ["Antioquia", "Córdoba", "Casanare"]);
  assert.equal(g.series[0].values[0], 3100000);
  assert.equal(g.type, "bar");
});

test("si las etiquetas son años, propone líneas", () => {
  const l = leerTabla([["Año", "Precio"], ["2021", "8.200"], ["2022", "9.100"], ["2023", "9.800"], ["2024", "10.500"]]);
  const e = eleccionSencilla(l, "precios.xlsx");
  assert.equal(e.tipo, "line");
});
