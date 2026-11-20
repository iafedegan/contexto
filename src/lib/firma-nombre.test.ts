import test from "node:test";
import assert from "node:assert/strict";
import { debeTomarNombreDeCuenta } from "./firma-nombre";

test("la firma que es el usuario de esa persona toma su nombre real", () => {
  assert.equal(debeTomarNombreDeCuenta("pfonseca", "Pedro Fonseca", "pfonseca@contextoganadero.com"), true);
  assert.equal(debeTomarNombreDeCuenta("Pfonseca", "Pedro Fonseca"), true, "inicial + apellido, con mayúscula");
  assert.equal(debeTomarNombreDeCuenta("acbarbosa", "Angie Barbosa", "acbarbosa@contextoganadero.com"), true, "por el correo");
});

test("no se renombra una firma que no es el usuario de ESA cuenta", () => {
  assert.equal(debeTomarNombreDeCuenta("Pfonseca", "CONtexto ganadero", "contexto@contextoganadero.com"), false);
  assert.equal(debeTomarNombreDeCuenta("Fonseca", "Pedro Fonseca", "pfonseca@x.co"), false);
  assert.equal(debeTomarNombreDeCuenta("Pedro Fonseca G.", "Pedro Fonseca"), false);
  assert.equal(debeTomarNombreDeCuenta("Giovacelis", "Giovacelis"), false);
});
