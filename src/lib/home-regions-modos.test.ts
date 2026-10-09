import test from "node:test";
import assert from "node:assert/strict";
import { regionsCss, sanitizeRegions } from "@/lib/home-regions";

test("los colores de cada modo se validan y los inválidos no llegan al CSS", () => {
  const r = sanitizeRegions({ navbar: { claro: { bg: "#ffffff", fg: "red;}body{display:none" }, oscuro: { accent: "#0d2318", bg: "no-es-color" }, bg: "#112233" } });
  assert.deepEqual(r.navbar?.claro, { bg: "#ffffff" });
  assert.deepEqual(r.navbar?.oscuro, { accent: "#0d2318" });
  assert.equal(r.navbar?.bg, "#112233");
  assert.equal(sanitizeRegions({ navbar: { claro: { bg: "x" }, oscuro: 5 } }).navbar, undefined, "sin nada válido no queda el componente");
});

test("sin colores por modo, el CSS es el de siempre: una sola regla de color para los dos modos", () => {
  const css = regionsCss({ navbar: { bg: "#112233" } });
  assert.match(css, /\[data-site-root\] \[data-region="navbar"\]\{[^}]*background:#112233!important/);
  assert.doesNotMatch(css, /data-dark/);
});

test("cada modo pinta SOLO cuando el sitio se ve en ese modo, y manda sobre el color de los dos", () => {
  const css = regionsCss({ navbar: { bg: "#112233", claro: { bg: "#fafafa" }, oscuro: { bg: "#050505" } } });
  const reglas = css.split("\n");
  const claro = reglas.find((x) => x.includes('html[data-dark="0"]'));
  const oscuro = reglas.find((x) => x.includes('html[data-dark="1"]'));
  assert.ok(claro && oscuro, css);
  assert.match(claro!, /background:#fafafa!important/);
  assert.doesNotMatch(claro!, /#050505/);
  assert.match(oscuro!, /background:#050505!important/);
  assert.doesNotMatch(oscuro!, /#fafafa/);
  // Sin preferencia del lector valen las plantillas: las oscuras de fábrica toman el oscuro y las demás el claro.
  assert.match(oscuro!, /html:not\(\[data-dark\]\) \[data-site-root\]:is\(\[data-theme="home"\],\[data-theme="esmeralda"\]/);
  assert.match(claro!, /html:not\(\[data-dark\]\) \[data-site-root\]:not\(:is\(\[data-theme="home"\]/);
  // La regla base queda antes: las de modo vienen después y con más peso.
  assert.ok(css.indexOf('background:#112233') < css.indexOf('html[data-dark="0"]'));
});

test("un solo modo con color propio no toca al otro", () => {
  const css = regionsCss({ hero: { oscuro: { accent: "#d9a05b" } } });
  assert.match(css, /html\[data-dark="1"\]/);
  assert.doesNotMatch(css, /html\[data-dark="0"\]/);
});
