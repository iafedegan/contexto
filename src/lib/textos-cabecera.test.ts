import test from "node:test";
import assert from "node:assert/strict";
import { conTextos, sanitizeTextos } from "@/lib/textos-cabecera";
import { normalizeLayout } from "@/lib/home-layout-normalize";
import { summarizeChanges } from "@/lib/portada-summary";
import { DEFAULT_HOME_LAYOUT } from "@/lib/home-layout";

const sitio = { name: "CONtexto Ganadero", tagline: "Periodismo del sector ganadero" };

test("sin ajustes, la cabecera usa el nombre y el lema del sitio", () => {
  assert.deepEqual(conTextos(sitio), sitio);
  assert.deepEqual(conTextos(sitio, {}), { ...sitio });
});

test("el título y el subtítulo del editor mandan sobre los del sitio; un subtítulo vacío lo quita; la fecha se puede ocultar", () => {
  assert.deepEqual(conTextos(sitio, { nombre: "El Diario del Campo", lema: "Noticias del hato" }), { name: "El Diario del Campo", tagline: "Noticias del hato" });
  const sinLema = conTextos(sitio, { lema: "", fecha: false });
  assert.equal(sinLema.name, sitio.name);
  assert.equal(sinLema.sinLema, true);
  assert.equal(sinLema.fecha, false);
});

test("sanitizeTextos limpia etiquetas y saltos, recorta el largo y descarta lo vacío", () => {
  assert.equal(sanitizeTextos(null), undefined);
  assert.equal(sanitizeTextos({}), undefined);
  assert.equal(sanitizeTextos({ nombre: "   " }), undefined);
  assert.deepEqual(sanitizeTextos({ nombre: "  <b>Hola</b>\n\nmundo  " }), { nombre: "b Hola /b mundo" });
  assert.equal(sanitizeTextos({ nombre: "x".repeat(300) })!.nombre!.length, 60);
  assert.deepEqual(sanitizeTextos({ lema: "" }), { lema: "" }); // «sin subtítulo»
  assert.deepEqual(sanitizeTextos({ fecha: false, otra: 1 }), { fecha: false });
  assert.equal(sanitizeTextos({ fecha: true }), undefined);
});

test("el diseño guardado conserva los textos ya validados y el resumen de cambios los menciona", () => {
  const guardado = normalizeLayout({ textos: { nombre: " Mi Diario ", fecha: false } } as never);
  assert.deepEqual(guardado.textos, { nombre: "Mi Diario", fecha: false });
  const base = { layout: DEFAULT_HOME_LAYOUT, items: [], popup: undefined as never, ads: {}, auto: true };
  const cur = { ...base, layout: { ...DEFAULT_HOME_LAYOUT, textos: { nombre: "Mi Diario" } } };
  const lineas = summarizeChanges(base as never, cur as never, { titles: {}, adsBase: {}, adNames: {} });
  assert.ok(lineas.some((l) => l.id === "textos"), JSON.stringify(lineas));
});

import { aplicarMenu, sanitizeMenuNavbar } from "@/lib/menu-navbar";
test("menú de la barra: oculta, añade enlaces válidos y quita submenús", () => {
  const items = [
    { href: "/categoria/a", label: "A", children: [{ href: "/categoria/a1", label: "A1" }] },
    { href: "/categoria/b", label: "B" },
  ];
  const m = sanitizeMenuNavbar({ ocultas: ["b", "<x>"], extras: [{ label: "Ok", href: "/pagina" }, { label: "Mal", href: "javascript:alert(1)" }], submenus: false });
  assert.deepEqual(m, { ocultas: ["b"], extras: [{ label: "Ok", href: "/pagina" }], submenus: false });
  const r = aplicarMenu(items, m);
  assert.deepEqual(r.map((i) => i.label), ["A", "Ok"]);
  assert.equal(r[0].children, undefined);
  assert.equal(sanitizeMenuNavbar({}), undefined);
});
