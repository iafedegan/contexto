import test from "node:test";
import assert from "node:assert/strict";
import { ORDEN_PERSONAJES, PERSONAJES, esperaDeGesto, personajeValido, siguienteGesto, siguientePersonaje } from "./personajes";

test("los gestos nunca repiten el anterior y siempre son del personaje", () => {
  for (const id of ORDEN_PERSONAJES) {
    const propios = PERSONAJES[id].gestos.map((g) => g.id);
    let anterior: string | null = null;
    for (let i = 0; i < 200; i++) {
      const g = siguienteGesto(id, anterior, Math.random);
      assert.ok(propios.includes(g.id));
      assert.notEqual(g.id, anterior);
      anterior = g.id;
    }
  }
});

test("con un azar extremo el índice no se sale de la lista", () => {
  assert.ok(siguienteGesto("toro", null, () => 0.999999999).id);
  assert.ok(siguienteGesto("ganadero", "saludo", () => 0).id !== "saludo");
});

test("la rueda de personajes da la vuelta y lo guardado inválido cae al toro", () => {
  assert.equal(siguientePersonaje("toro"), "ganadero");
  assert.equal(siguientePersonaje("ganadero"), "toro");
  assert.equal(personajeValido("ganadero"), "ganadero");
  for (const raro of [null, undefined, "", "perro", 3, {}]) assert.equal(personajeValido(raro), "toro");
});

test("la espera entre gestos queda entre 18 y 42 segundos", () => {
  assert.equal(esperaDeGesto(() => 0), 18_000);
  assert.ok(esperaDeGesto(() => 0.999999) <= 42_000);
});

test("cada gesto trae texto en español e inglés", () => {
  for (const p of Object.values(PERSONAJES)) for (const g of p.gestos) assert.ok(g.es.length > 5 && g.en.length > 5);
});
