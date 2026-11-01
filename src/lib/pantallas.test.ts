import assert from "node:assert/strict";
import { test } from "node:test";
import { conCambios, conEstiloEnPantalla, copiarDiseno, copiarEstilo, cssPorPantalla, estiloEnPantalla, layoutDePantalla, pantallaDeAncho } from "@/lib/pantallas";
import { blockStylesCss, sanitizeHomeStyle } from "@/lib/home-style";
import { zonesCss } from "@/lib/zones";
import { normalizeLayout } from "@/lib/home-layout-normalize";
import type { HomeLayoutConfig } from "@/db/schema";

const L = (l: HomeLayoutConfig) => l;

test("una pantalla sin ajustes usa lo general y editar una no mueve a las otras", () => {
  const base = L({ regions: { hero: { bg: "#111111" } } });
  const conPc = conCambios(base, "pc", { regions: { hero: { bg: "#222222" } } });
  assert.equal(layoutDePantalla(conPc, "pc").regions?.hero?.bg, "#222222");
  assert.equal(layoutDePantalla(conPc, "movil").regions?.hero?.bg, "#111111");
  assert.equal(layoutDePantalla(conPc, "tablet").regions?.hero?.bg, "#111111");
  assert.equal(conPc.regions?.hero?.bg, "#111111");
});

test("lo común del cambio no va a la pantalla", () => {
  const l = conCambios(L({ menuNav: { ocultas: ["a"], estilo: { tamano: 12 } } }), "movil", { riverColumns: 2, menuNav: { ocultas: ["b"], estilo: { tamano: 20 } } });
  assert.equal(l.riverColumns, 2);
  assert.deepEqual(l.menuNav?.ocultas, ["b"]);
  assert.equal(l.menuNav?.estilo?.tamano, 12);
  assert.equal(layoutDePantalla(l, "movil").menuNav?.estilo?.tamano, 20);
  assert.equal(layoutDePantalla(l, "pc").menuNav?.estilo?.tamano, 12);
});

test("sin ajustes por pantalla la hoja es la de siempre, sin @media", () => {
  assert.equal(cssPorPantalla("x", () => undefined, (v) => String(v)), "x");
  const css = cssPorPantalla("x", (p) => (p === "movil" ? "y" : undefined), (v) => String(v));
  assert.match(css, /max-width:639\.98px\)\{\ny\n\}/);
  assert.match(css, /min-width:1024px\)\{\nx\n\}/);
});

test("copiar deja las tres pantallas iguales", () => {
  const l = copiarDiseno(conCambios(L({}), "tablet", { regions: { footer: { bg: "#333333" } } }), "tablet");
  for (const p of ["pc", "tablet", "movil"] as const) assert.equal(layoutDePantalla(l, p).regions?.footer?.bg, "#333333");
  const e = copiarEstilo(conEstiloEnPantalla(null, "pc", { bold: true }), "pc");
  for (const p of ["pc", "tablet", "movil"] as const) assert.equal(estiloEnPantalla(e, p).bold, true);
});

test("la zona ajustada en el celular deja de apilarse; las copiadas de lo general siguen apiladas", () => {
  const base = L({ zones: { i2: { cols: 3 }, i6: { cols: 3 } } });
  const l = conCambios(base, "movil", { zones: { i2: { cols: 2 }, i6: { cols: 3 } } });
  const z = layoutDePantalla(l, "movil").zones ?? {};
  assert.equal(z.i2.libreEnMovil, true);
  assert.equal(z.i6.libreEnMovil, undefined);
  assert.ok(!/max-width:640px/.test(zonesCss({ i2: z.i2 })));
  assert.ok(/max-width:640px/.test(zonesCss({ i6: z.i6 })));
});

test("una nota con ajustes por pantalla saca su CSS por @media y sin ellos no cambia", () => {
  assert.ok(!blockStylesCss([{ slug: "n", homeStyle: { bg: "#000000" } }]).includes("@media"));
  const st = conEstiloEnPantalla({ bold: true }, "movil", { color: "#ff0000", titleScale: 120 });
  const css = blockStylesCss([{ slug: "n", homeStyle: st }]);
  assert.match(css, /max-width:639\.98px[\s\S]*--cg-t-esc:1\.2[\s\S]*color:#ff0000/);
  assert.equal(estiloEnPantalla(st, "pc").color, undefined);
  assert.equal(estiloEnPantalla(st, "pc").bold, true);
});

test("lo por pantalla se valida igual que lo general", () => {
  const n = normalizeLayout({ pantallas: { movil: { regions: { hero: { bg: "red;}body{display:none" } }, menuEstilo: { tamano: 14 } }, otra: {} } } as never);
  assert.deepEqual(n.pantallas?.movil?.regions, {});
  assert.deepEqual(Object.keys(n.pantallas ?? {}), ["movil"]);
  const s = sanitizeHomeStyle({ pantallas: { pc: { color: "x;}" , bold: true }, tablet: {} } });
  assert.deepEqual(s?.pantallas?.pc, { bold: true });
  assert.deepEqual(s?.pantallas?.tablet, {});
  assert.equal(pantallaDeAncho(1024), "pc");
  assert.equal(pantallaDeAncho(820), "tablet");
  assert.equal(pantallaDeAncho(390), "movil");
});
