import test from "node:test";
import assert from "node:assert/strict";
import { leerCifra } from "./lectura-cifra";

test("separa la serie, el periodo, la cifra y la unidad", () => {
  assert.deepEqual(leerCifra("Colombia (oct/2026): 9.795 $ por kilo en pie; Argentina (sep/2026): 3,11 US$ por kilo"), [
    { serie: "Colombia", periodo: "oct/2026", valor: "9.795", numero: 9795, unidad: "$ por kilo en pie" },
    { serie: "Argentina", periodo: "sep/2026", valor: "3,11", numero: 3.11, unidad: "US$ por kilo" },
  ]);
});

test("acepta una serie sin periodo ni unidad", () => {
  assert.deepEqual(leerCifra("Antioquia: 3.250.969"), [{ serie: "Antioquia", periodo: null, valor: "3.250.969", numero: 3250969, unidad: "" }]);
});

test("un texto que no es una cifra se deja como texto", () => {
  assert.equal(leerCifra("Ganado gordo. Precio por kilo. Fuente: FEDEGÁN."), null);
  assert.equal(leerCifra("Colombia: 9.795 $; texto suelto"), null);
  assert.equal(leerCifra(""), null);
});
