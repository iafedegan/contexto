import test from "node:test";
import assert from "node:assert/strict";
import { dispositivoDe, enmascararCorreo } from "@/lib/login-log";

test("el correo se enmascara pero la cuenta sigue siendo reconocible", () => {
  assert.equal(enmascararCorreo("edgar@gmail.com"), "ed***@gmail.com");
  assert.equal(enmascararCorreo("ab@x.co"), "a***@x.co");
  assert.equal(enmascararCorreo("a@x.co"), "a***@x.co");
  assert.ok(!enmascararCorreo("persona.larga@dominio.org").includes("persona.larga"));
});

test("entradas raras no rompen el registro", () => {
  assert.equal(enmascararCorreo(""), "sin correo");
  assert.equal(enmascararCorreo(null), "sin correo");
  assert.equal(enmascararCorreo("sin-arroba"), "***");
  assert.equal(enmascararCorreo("@dominio.com"), "***");
});

test("el dispositivo se resume sin guardar el user-agent completo", () => {
  assert.equal(dispositivoDe("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"), "Chrome · macOS");
  assert.equal(dispositivoDe(null), "Navegador");
});
