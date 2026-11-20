import test from "node:test";
import assert from "node:assert/strict";
import { slugLibre, SUFIJO_ANTIGUO } from "./slug-libre";

const tomadas = (...s: string[]) => async (x: string) => s.includes(x);

test("sin choque se usa el título tal cual", async () => {
  assert.equal(await slugLibre("fedegan-5-0", tomadas()), "fedegan-5-0");
});

test("con choque se agrega un número corto, el primero libre", async () => {
  assert.equal(await slugLibre("fedegan-5-0", tomadas("fedegan-5-0")), "fedegan-5-0-2");
  assert.equal(await slugLibre("fedegan-5-0", tomadas("fedegan-5-0", "fedegan-5-0-2")), "fedegan-5-0-3");
});

test("el número cabe en el tope de 96 caracteres", async () => {
  const largo = "a".repeat(96);
  const r = await slugLibre(largo, tomadas(largo));
  assert.ok(r.length <= 96 && r.endsWith("-2"));
});

test("reconoce los sufijos antiguos de fecha en base 36 y no un título normal", () => {
  assert.ok(SUFIJO_ANTIGUO.test("fedegan-5-0-la-vision-de-un-gremio-mwp9bxru"));
  assert.ok(!SUFIJO_ANTIGUO.test("fedegan-5-0-la-vision-de-un-gremio"));
  assert.ok(!SUFIJO_ANTIGUO.test("la-columna-de-opinion-2026"));
});
