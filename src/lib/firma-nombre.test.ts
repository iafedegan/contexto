import test from "node:test";
import assert from "node:assert/strict";
import { debeTomarNombreDeCuenta } from "./firma-nombre";

test("una firma con nombre de usuario toma el nombre real de la cuenta", () => {
  assert.equal(debeTomarNombreDeCuenta("pfonseca", "Pedro Fonseca"), true);
  assert.equal(debeTomarNombreDeCuenta("acbarbosa", "Angie Barbosa"), true);
  assert.equal(debeTomarNombreDeCuenta("Pfonseca", "Pedro Fonseca"), true, "también con mayúscula inicial");
  assert.equal(debeTomarNombreDeCuenta("Fonseca", "Pedro Fonseca"), false, "un apellido real no se cambia");
});

test("no se toca una firma escrita a mano ni una cuenta sin nombre completo", () => {
  assert.equal(debeTomarNombreDeCuenta("Pedro Fonseca G.", "Pedro Fonseca"), false);
  assert.equal(debeTomarNombreDeCuenta("Pedro Fonseca", "Pedro Fonseca"), false);
  assert.equal(debeTomarNombreDeCuenta("pfonseca", "pfonseca"), false);
  assert.equal(debeTomarNombreDeCuenta("Giovacelis", "Giovacelis"), false);
});
