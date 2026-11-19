import test from "node:test";
import assert from "node:assert/strict";
import { generarClaveTemporal } from "./clave-temporal";

test("la clave temporal tiene el formato y no se repite", () => {
  const vistas = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const c = generarClaveTemporal();
    assert.match(c, /^[A-HJ-NP-Za-hj-np-z2-9]{4}-[A-HJ-NP-Za-hj-np-z2-9]{4}-[A-HJ-NP-Za-hj-np-z2-9]{4}$/);
    assert.ok(c.length >= 10);
    vistas.add(c);
  }
  assert.equal(vistas.size, 200);
});
