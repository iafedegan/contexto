import test from "node:test";
import assert from "node:assert/strict";
import { anfitrionIndexable } from "@/lib/indexacion";

const OFICIAL = "https://www.contextoganadero.com";

test("el dominio oficial, con o sin www y con puerto, se deja indexar", () => {
  assert.equal(anfitrionIndexable("www.contextoganadero.com", OFICIAL), true);
  assert.equal(anfitrionIndexable("contextoganadero.com", OFICIAL), true);
  assert.equal(anfitrionIndexable("WWW.ContextoGanadero.com:443", OFICIAL), true);
});

test("cualquier otra dirección (vercel.app, pruebas) no se indexa", () => {
  assert.equal(anfitrionIndexable("contexto-olive.vercel.app", OFICIAL), false);
  assert.equal(anfitrionIndexable("contexto-git-main-fedegan.vercel.app", OFICIAL), false);
  assert.equal(anfitrionIndexable("contextoganadero.com.otro.co", OFICIAL), false);
});

test("sin dato del anfitrión, o en local, no se bloquea", () => {
  assert.equal(anfitrionIndexable(null, OFICIAL), true);
  assert.equal(anfitrionIndexable("localhost:3000", OFICIAL), true);
  assert.equal(anfitrionIndexable("contexto-olive.vercel.app", ""), true);
});

test("si el dominio oficial configurado es el de vercel.app, ese se indexa (comportamiento previo)", () => {
  assert.equal(anfitrionIndexable("contexto-olive.vercel.app", "https://contexto-olive.vercel.app"), true);
});
