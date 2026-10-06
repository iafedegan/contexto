import test from "node:test";
import assert from "node:assert/strict";
import { idiomaDeRuta, pestanaActiva } from "@/lib/pestanas";

test("cada ruta del portal enciende su pestaña de la barra inferior del celular", () => {
  assert.equal(pestanaActiva("/"), "inicio");
  assert.equal(pestanaActiva("/categoria/ganaderia"), "secciones");
  assert.equal(pestanaActiva("/categoria/economia/"), "secciones");
  assert.equal(pestanaActiva("/asistente"), "asistente");
  assert.equal(pestanaActiva("/buscar"), "buscar");
  assert.equal(pestanaActiva("/boletin"), "boletin");
  assert.equal(pestanaActiva("/boletin/confirmar"), "boletin");
});

test("en inglés (/en) se enciende la misma pestaña", () => {
  assert.equal(pestanaActiva("/en"), "inicio");
  assert.equal(pestanaActiva("/en/"), "inicio");
  assert.equal(pestanaActiva("/en/buscar"), "buscar");
  assert.equal(pestanaActiva("/en/categoria/colombia"), "secciones");
  assert.equal(idiomaDeRuta("/en/asistente"), "en");
  assert.equal(idiomaDeRuta("/entrevistas"), "es", "«/entrevistas» no es «/en»");
});

test("una nota, una página institucional o una ruta desconocida no encienden ninguna", () => {
  assert.equal(pestanaActiva("/articulo/precio-novillo"), null);
  assert.equal(pestanaActiva("/politica-de-privacidad"), null);
  assert.equal(pestanaActiva("/autor/redaccion"), null);
  assert.equal(pestanaActiva("/buscarx"), null, "un prefijo parecido no cuenta");
  assert.equal(pestanaActiva("/enigma"), null);
});
