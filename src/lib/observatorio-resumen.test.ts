import test from "node:test";
import assert from "node:assert/strict";
import { hallazgos } from "@/lib/observatorio-resumen";
import type { Indicador } from "@/lib/indicadores-fedegan";
import type { Observatorio } from "@/lib/observatorio-fedegan";

const vacio: Observatorio = { generales: [], departamental: [], hato: [], documentos: [] };
const precio = (clave: string, series: { nombre: string; valores: (number | null)[] }[]): Indicador => ({ clave, titulo: clave, descripcion: "", unidad: "", periodos: ["jul/2026", "ago/2026"], series, fuente: "" });

test("sin datos no hay hallazgos (y no se inventa ninguno)", () => {
  assert.deepEqual(hallazgos([], vacio), []);
});

test("el precio del gordo y la región más cara del flaco salen con su variación", () => {
  const h = hallazgos(
    [
      precio("gordo", [{ nombre: "Colombia", valores: [9540, 9692] }]),
      precio("flaco-machos", [{ nombre: "Región Caribe", valores: [10016, 10490] }, { nombre: "Llanos Orientales", valores: [11105, 12158] }]),
    ],
    vacio,
  );
  assert.equal(h.length, 2);
  assert.equal(h[0].tono, "sube");
  assert.match(h[0].texto, /agosto 2026 en \$9\.692 por kilo en pie \(\+1,6 %/);
  assert.match(h[1].texto, /Llanos Orientales: \$12\.158/);
  assert.doesNotMatch(h[1].texto, /Región/);
});

test("la concentración del inventario cuenta el departamento líder frente al total nacional", () => {
  const obs: Observatorio = { ...vacio, departamental: [{ clave: "bovinos", titulo: "", unidad: "", periodos: ["2024", "2025"], nacional: [30_000_000, 29_700_000], departamentos: [{ nombre: "Antioquia ", valores: [3_300_000, 3_250_000] }, { nombre: "Meta", valores: [2_000_000, 2_400_000] }] }] };
  const [h] = hallazgos([], obs);
  assert.equal(h.tono, "dato");
  assert.match(h.texto, /^Antioquia concentra el 10,9 % de los bovinos del país: 3,25 de 29,7 millones de cabezas\./);
});

test("el mismo hallazgo sale en inglés con cifras en inglés", () => {
  const [h] = hallazgos([precio("gordo", [{ nombre: "Colombia", valores: [9540, 9692] }])], vacio, "en");
  assert.match(h.texto, /^Fattened cattle closed August 2026/);
});
