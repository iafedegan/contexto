import test from "node:test";
import assert from "node:assert/strict";
import { colorPanel } from "@/lib/panel-tema";

const HEX = /^#[0-9a-f]{6}$/i;
const PLANTILLAS = ["esmeralda", "clasico", "revista", "compacto", "vanguardia", "gremial"];

test("cada plantilla tiene sus tres colores y todos son hexadecimales válidos", () => {
  for (const id of PLANTILLAS) {
    const c = colorPanel(id);
    for (const v of [c.desde, c.hasta, c.acento]) assert.match(v, HEX, `${id}: ${v}`);
  }
});

test("cada plantilla se distingue de las demás", () => {
  const desdes = PLANTILLAS.map((id) => colorPanel(id).desde);
  assert.equal(new Set(desdes).size, PLANTILLAS.length);
});

// Contraste WCAG entre dos colores (#rrggbb).
function contraste(a: string, b: string): number {
  const luz = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
// Mezcla `a` (en proporción `p`) con `b`, como hace `color-mix` en la barra.
function mezclar(a: string, b: string, p: number): string {
  const canal = (i: number) => Math.round(parseInt(a.slice(i, i + 2), 16) * p + parseInt(b.slice(i, i + 2), 16) * (1 - p)).toString(16).padStart(2, "0");
  return `#${canal(1)}${canal(3)}${canal(5)}`;
}

test("el texto se lee sobre la barra de cada plantilla (contraste WCAG) y el acento resalta", () => {
  for (const id of PLANTILLAS) {
    const c = colorPanel(id);
    // Texto principal y atenuado (la barra los mezcla con su color: ver el diseño del panel).
    for (const fondo of [c.desde, c.hasta]) {
      assert.ok(contraste(mezclar("#ffffff", c.desde, 0.94), fondo) >= 7, `${id}: texto principal sobre ${fondo}`);
      assert.ok(contraste(mezclar("#ffffff", c.desde, 0.68), fondo) >= 4.5, `${id}: texto atenuado sobre ${fondo}`);
      assert.ok(contraste(c.acento, fondo) >= 3, `${id}: acento sobre ${fondo}`);
    }
    // Arriba más claro que abajo, como el degradado de siempre.
    assert.ok(contraste("#ffffff", c.hasta) >= contraste("#ffffff", c.desde), `${id}: abajo no es más claro que arriba`);
  }
});

test("«home» es Esmeralda Real y lo desconocido vuelve al azul marino de siempre", () => {
  assert.deepEqual(colorPanel("home"), colorPanel("esmeralda"));
  assert.equal(colorPanel("no-existe").desde, "#16315c");
  assert.equal(colorPanel(undefined).desde, "#16315c");
});
