import test from "node:test";
import assert from "node:assert/strict";
import { efectivo, efectivos, exige2fa, porDefecto, RANGO } from "@/lib/permisos";

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
