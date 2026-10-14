import test from "node:test";
import assert from "node:assert/strict";
import { DEPARTAMENTOS } from "@/lib/colombia-mapa";
import { proyectar } from "@/lib/mapa-proyeccion";

// Ciudades de referencia y el departamento del mapa en el que deben caer (caja del trazo).
const CIUDADES: [string, number, number, string][] = [
  ["Bogotá", 4.711, -74.072, "BOGOTA, D.C."],
  ["Medellín", 6.244, -75.581, "ANTIOQUIA"],
  ["Cali", 3.452, -76.532, "VALLE DEL CAUCA"],
  ["Barranquilla", 10.964, -74.796, "ATLANTICO"],
  ["Yopal", 5.337, -72.396, "CASANARE"],
  ["Cúcuta", 7.894, -72.508, "NORTE DE SANTANDER"],
  ["Pasto", 1.214, -77.281, "NARINO"],
];

// Caja que encierra el trazo de un departamento.
function caja(d: string) {
  const n = [...d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  return { x0: Math.min(...n.map((p) => p[0])), x1: Math.max(...n.map((p) => p[0])), y0: Math.min(...n.map((p) => p[1])), y1: Math.max(...n.map((p) => p[1])) };
}

test("las ciudades caen sobre su departamento del mapa", () => {
  for (const [ciudad, lat, lon, depto] of CIUDADES) {
    const p = proyectar(lat, lon);
    assert.ok(p, `${ciudad} debe proyectarse`);
    const c = caja(DEPARTAMENTOS.find((d) => d.nombre === depto)!.d);
    assert.ok(p.x >= c.x0 - 1 && p.x <= c.x1 + 1 && p.y >= c.y0 - 1 && p.y <= c.y1 + 1, `${ciudad} (${p.x}, ${p.y}) fuera de ${depto}`);
  }
});

test("lo que está fuera de Colombia continental no se dibuja", () => {
  assert.equal(proyectar(40.4, -3.7), null); // Madrid
  assert.equal(proyectar(25.8, -80.2), null); // Miami
  assert.equal(proyectar(12.58, -81.7), null); // San Andrés
  assert.equal(proyectar(Number.NaN, -74), null);
});
