import test from "node:test";
import assert from "node:assert/strict";
import { recorte169 } from "./ajustar-imagen";

test("una imagen más alta que 16:9 se recorta por arriba y abajo según el encuadre", () => {
  // 584 × 700: el recorte 16:9 mide 584 × 329
  const centro = recorte169(584, 700, 0.5, 0.5);
  assert.deepEqual([centro.sw, centro.sh, centro.sx], [584, 329, 0]);
  assert.equal(centro.sy, Math.round((700 - 329) * 0.5));
  assert.equal(recorte169(584, 700, 0.5, 0).sy, 0);
  assert.equal(recorte169(584, 700, 0.5, 1).sy, 700 - 329);
});

test("una imagen más ancha que 16:9 se recorta por los lados", () => {
  const r = recorte169(2000, 900, 0, 0.5);
  assert.deepEqual([r.sx, r.sy, r.sw, r.sh], [0, 0, 1600, 900]);
  assert.equal(recorte169(2000, 900, 1, 0.5).sx, 400);
});

test("una imagen que ya es 16:9 no se recorta", () => {
  const r = recorte169(1600, 900, 0.5, 0.5);
  assert.deepEqual([r.sx, r.sy, r.sw, r.sh], [0, 0, 1600, 900]);
});
