import test from "node:test";
import assert from "node:assert/strict";
import { numeroDelCsv, parsearCsvIndicador, rangoDeMeses } from "@/lib/indicadores-csv";

// Lo que devuelve el origen (la cabecera llega con la «ó» rota por el ISO-8859-1).
const CSV = `064-Precio ganado flaco Kilo en pie - Machos
Fecha;Regi�n Caribe;Magdalena Medio y Santanderes;Llanos Orientales ;
sep/2025;10.197;10.243;9.639;
oct/2025;10.078;10.072;9.643;
ago/2026;10.490;11.438;12.158;
`;
const NOMBRES = ["Región Caribe", "Magdalena Medio y Santanderes", "Llanos Orientales"];

test("los números del origen traen el punto de miles y a veces coma decimal", () => {
  assert.equal(numeroDelCsv("10.490"), 10490);
  assert.equal(numeroDelCsv(" 9.639 "), 9639);
  assert.equal(numeroDelCsv("10,5"), 10.5);
  assert.equal(numeroDelCsv(""), null);
  assert.equal(numeroDelCsv("n/d"), null);
});

test("el CSV se convierte en meses y una serie por columna, con los nombres del catálogo", () => {
  const t = parsearCsvIndicador(CSV, NOMBRES);
  assert.ok(t);
  assert.deepEqual(t.periodos, ["sep/2025", "oct/2025", "ago/2026"]);
  assert.deepEqual(t.series.map((s) => s.nombre), NOMBRES);
  assert.deepEqual(t.series[2].valores, [9639, 9643, 12158]);
});

test("una celda vacía es un hueco (null), no un cero", () => {
  const t = parsearCsvIndicador("Fecha;A;B;\nsep/2025;1.000;;\noct/2025;2.000;3.000;\n", ["A", "B"]);
  assert.ok(t);
  assert.deepEqual(t.series[1].valores, [null, 3000]);
});

test("si no hay al menos dos meses o una serie queda vacía, no se dibuja nada", () => {
  assert.equal(parsearCsvIndicador("", NOMBRES), null);
  assert.equal(parsearCsvIndicador("<html>Error</html>", NOMBRES), null);
  assert.equal(parsearCsvIndicador("Fecha;A;\nsep/2025;1.000;\n", ["A"]), null, "un solo mes no es una tendencia");
  assert.equal(parsearCsvIndicador("Fecha;A;B;\nsep/2025;1.000;;\noct/2025;2.000;;\n", ["A", "B"]), null);
});

test("el rango son los doce meses que terminan en el mes actual de Colombia", () => {
  assert.deepEqual(rangoDeMeses(new Date("2026-10-07T12:00:00Z")), { desde: "01-11-2025", hasta: "31-10-2026" });
  assert.deepEqual(rangoDeMeses(new Date("2026-02-15T12:00:00Z")), { desde: "01-03-2025", hasta: "28-02-2026" });
  // 1 de enero 02:00 UTC todavía es 31 de diciembre en Colombia (UTC−5).
  assert.deepEqual(rangoDeMeses(new Date("2027-01-01T02:00:00Z")), { desde: "01-01-2026", hasta: "31-12-2026" });
});
