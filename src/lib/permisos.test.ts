import test from "node:test";
import assert from "node:assert/strict";
import { efectivo, efectivos, exige2fa, GRUPOS_PERMISOS, PERMISOS, porDefecto, RANGO, enPlazoDosPasos } from "@/lib/permisos";

test("los rangos van de redactor a administrador", () => {
  assert.ok(RANGO.redactor < RANGO.editor && RANGO.editor < RANGO.administrador);
});

test("un redactor redacta pero no publica; un editor publica y aprueba borradores de IA", () => {
  assert.equal(porDefecto("redactor", "articulos"), true);
  assert.equal(porDefecto("redactor", "publicar"), false);
  assert.equal(porDefecto("editor", "publicar"), true);
  assert.equal(porDefecto("editor", "borradores_ia"), true);
  assert.equal(porDefecto("redactor", "borradores_ia"), false);
});

test("la API pública es solo del administrador", () => {
  assert.equal(porDefecto("editor", "api"), false);
  assert.equal(efectivo("administrador", {}, "api"), true);
});

test("los ajustes de una persona suben o bajan permisos, pero no al administrador", () => {
  assert.equal(efectivo("redactor", { publicar: true }, "publicar"), true);
  assert.equal(efectivo("editor", { publicar: false }, "publicar"), false);
  assert.equal(efectivo("administrador", { publicar: false }, "publicar"), true);
  assert.ok(efectivos("redactor", {}).includes("articulos"));
  assert.ok(!efectivos("redactor", {}).includes("publicar"));
});

test("el segundo factor es obligatorio salvo exención; al administrador nunca se le exime", () => {
  assert.equal(exige2fa("redactor", undefined), true);
  assert.equal(exige2fa("redactor", { exigir_2fa: false }), false);
  assert.equal(exige2fa("administrador", { exigir_2fa: false }), true);
});

test("el plazo de gracia del segundo factor vence solo", () => {
  const ahora = new Date("2026-10-13T12:00:00Z");
  const plazos = { a: "2026-10-20T12:00:00Z", b: "2026-10-01T12:00:00Z", c: "no es fecha" };
  assert.equal(enPlazoDosPasos(plazos, "a", ahora).activo, true);
  assert.equal(enPlazoDosPasos(plazos, "b", ahora).activo, false);
  assert.equal(enPlazoDosPasos(plazos, "c", ahora).activo, false);
  assert.equal(enPlazoDosPasos(plazos, "z", ahora).activo, false);
  assert.equal(enPlazoDosPasos(undefined, "a", ahora).activo, false);
});

test("las entradas nuevas del menú siguen lo que cada rol veía antes", () => {
  // Solicitud de imágenes: diseñador, editor y administrador, no el redactor.
  assert.equal(porDefecto("redactor", "imagenes"), false);
  assert.equal(porDefecto("disenador", "imagenes"), true);
  assert.equal(porDefecto("editor", "imagenes"), true);
  // Mis pendientes: todos menos el diseñador.
  assert.equal(porDefecto("disenador", "pendientes"), false);
  assert.equal(porDefecto("redactor", "pendientes"), true);
  assert.equal(porDefecto("editor", "pendientes"), true);
  // Notas para editores: las envía el redactor.
  assert.equal(porDefecto("redactor", "notas_editores"), true);
  assert.equal(porDefecto("editor", "notas_editores"), false);
  // Páginas: el diseñador (como la portada) y el administrador.
  assert.equal(porDefecto("disenador", "paginas"), true);
  assert.equal(porDefecto("redactor", "paginas"), false);
  assert.equal(porDefecto("editor", "paginas"), false);
  // El resumen lo ven todos.
  assert.equal(porDefecto("redactor", "resumen"), true);
});

test("cada permiso pertenece a un apartado del menú", () => {
  for (const p of PERMISOS) assert.ok(GRUPOS_PERMISOS.includes(p.grupo), `${p.id} sin apartado`);
});

test("«En vivo» es un permiso propio, como «Avisos»: lo tienen por defecto los editores", () => {
  assert.equal(porDefecto("redactor", "en_vivo"), false);
  assert.equal(porDefecto("editor", "en_vivo"), true);
  assert.equal(porDefecto("disenador", "en_vivo"), false);
});

test("«Suscriptores» y «Uso de IA» son permisos propios con sus valores de siempre", () => {
  // Suscriptores: antes iba con el newsletter (editores y administradores).
  assert.equal(porDefecto("redactor", "suscriptores"), false);
  assert.equal(porDefecto("editor", "suscriptores"), true);
  // Uso de IA: lo veía todo el equipo.
  for (const rol of ["redactor", "disenador", "editor", "administrador"] as const) assert.equal(porDefecto(rol, "uso_ia"), true);
});
