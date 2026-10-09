import test from "node:test";
import assert from "node:assert/strict";
import { MARGEN, limitarPosicion, ubicarDialogo } from "@/lib/toro-posicion";

const ventana = { w: 1280, h: 800 };
const toro = { w: 112, h: 107 };
const cuadro = { w: 416, h: 544 };

test("el toro no se sale de la ventana por ningún lado", () => {
  assert.deepEqual(limitarPosicion({ x: -50, y: -50 }, ventana, toro), { x: MARGEN, y: MARGEN });
  assert.deepEqual(limitarPosicion({ x: 5000, y: 5000 }, ventana, toro), { x: 1280 - 112 - MARGEN, y: 800 - 107 - MARGEN });
  assert.deepEqual(limitarPosicion({ x: 300, y: 200 }, ventana, toro), { x: 300, y: 200 });
});

test("con una ventana más chica que el toro no hay valores absurdos", () => {
  const p = limitarPosicion({ x: 500, y: 500 }, { w: 90, h: 90 }, toro);
  assert.equal(p.x, MARGEN);
  assert.equal(p.y, MARGEN);
});

test("con el chat encima, el toro no puede subir tanto que el cuadro se salga por arriba", () => {
  const p = limitarPosicion({ x: 300, y: 10 }, ventana, toro, { cuadro, lado: "arriba" });
  assert.equal(p.y, cuadro.h + 2 * MARGEN);
  const d = ubicarDialogo(p, ventana, toro, cuadro);
  assert.equal(d.lado, "arriba");
  assert.ok(d.y >= MARGEN);
});

test("con el chat debajo, el toro no puede bajar tanto que el cuadro se salga por abajo", () => {
  const p = limitarPosicion({ x: 300, y: 790 }, ventana, toro, { cuadro, lado: "abajo" });
  const d = ubicarDialogo(p, ventana, toro, cuadro);
  assert.equal(d.lado, "abajo");
  assert.ok(d.y + cuadro.h <= ventana.h - MARGEN);
});

test("el cuadro va encima del toro si cabe, debajo si no, y siempre dentro de la ventana", () => {
  const abajoDerecha = ubicarDialogo({ x: 1100, y: 680 }, ventana, toro, cuadro);
  assert.equal(abajoDerecha.lado, "arriba");
  assert.equal(abajoDerecha.y, 680 - cuadro.h - MARGEN);

  const arribaIzquierda = ubicarDialogo({ x: 20, y: 20 }, ventana, toro, cuadro);
  assert.equal(arribaIzquierda.lado, "abajo");
  assert.equal(arribaIzquierda.y, 20 + toro.h + MARGEN);
  assert.equal(arribaIzquierda.x, MARGEN);

  // Ventana baja: no cabe ni encima ni debajo; va al costado y no se sale.
  const baja = ubicarDialogo({ x: 400, y: 100 }, { w: 1280, h: 600 }, toro, cuadro);
  assert.equal(baja.lado, "derecha");
  assert.ok(baja.y >= MARGEN && baja.y + cuadro.h <= 600);
  assert.equal(baja.x, 400 + toro.w + MARGEN);
});

test("sin sitio encima ni debajo, el cuadro va a la derecha del toro, o a la izquierda si ahí no cabe", () => {
  const ventanaBaja = { w: 1024, h: 768 };
  const derecha = ubicarDialogo({ x: 244, y: 247 }, ventanaBaja, toro, cuadro);
  assert.equal(derecha.lado, "derecha");
  assert.ok(derecha.x >= 244 + toro.w);
  assert.ok(derecha.y >= MARGEN && derecha.y + cuadro.h <= ventanaBaja.h - MARGEN);

  const izquierda = ubicarDialogo({ x: 880, y: 247 }, ventanaBaja, toro, cuadro);
  assert.equal(izquierda.lado, "izquierda");
  assert.ok(izquierda.x + cuadro.w <= 880);
});

test("con el cuadro a un costado, el toro no puede acercarse tanto al borde que el cuadro se salga", () => {
  const ventanaBaja = { w: 1024, h: 768 };
  const p = limitarPosicion({ x: 990, y: 247 }, ventanaBaja, toro, { cuadro, lado: "derecha" });
  assert.ok(p.x + toro.w + MARGEN + cuadro.w <= ventanaBaja.w - MARGEN);
  const q = limitarPosicion({ x: 5, y: 247 }, ventanaBaja, toro, { cuadro, lado: "izquierda" });
  assert.ok(q.x >= cuadro.w + 2 * MARGEN);
});

test("el borde derecho del cuadro se alinea con el del toro y no se sale por los lados", () => {
  const alineado = ubicarDialogo({ x: 900, y: 700 }, ventana, toro, cuadro);
  assert.equal(alineado.x + cuadro.w, 900 + toro.w);
  const aLaDerecha = ubicarDialogo({ x: 1280 - toro.w - MARGEN, y: 700 }, ventana, toro, cuadro);
  assert.ok(aLaDerecha.x + cuadro.w <= ventana.w - MARGEN);
});
