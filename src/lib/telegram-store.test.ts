import test, { before } from "node:test";
import assert from "node:assert/strict";
import { prepararBd } from "@/test-utils/bd-memoria";

let store: typeof import("@/lib/telegram-store");

before(async () => {
  await prepararBd();
  store = await import("@/lib/telegram-store");
});

test("un código vincula UNA vez: el segundo intento, aunque sea simultáneo, ya no lo encuentra", async () => {
  const codigo = await store.crearCodigo("usuario-1");
  assert.match(codigo, /^[A-Z2-9]{6}$/);
  const resultados = await Promise.all([store.vincularConCodigo(codigo, 111, "Ana"), store.vincularConCodigo(codigo, 222, "Mallory")]);
  assert.deepEqual(resultados.filter(Boolean), ["usuario-1"], "solo uno se queda con el vínculo");
  const vinculos = await store.getVinculos();
  assert.equal(Object.keys(vinculos).length, 1);
});

test("varios vínculos y códigos a la vez no se pisan (antes se leía, modificaba y reescribía todo el objeto)", async () => {
  const codigos = await Promise.all(Array.from({ length: 8 }, (_, i) => store.crearCodigo(`u${i}`)));
  assert.equal(new Set(codigos).size, 8);
  const vinculados = await Promise.all(codigos.map((c, i) => store.vincularConCodigo(c, 1000 + i, `Persona ${i}`)));
  assert.deepEqual(vinculados.sort(), Array.from({ length: 8 }, (_, i) => `u${i}`).sort());
  const vinculos = await store.getVinculos();
  for (let i = 0; i < 8; i++) assert.equal(vinculos[String(1000 + i)]?.userId, `u${i}`, `el vínculo ${i} sobrevive`);
});

test("un código inventado o en minúsculas se trata bien", async () => {
  assert.equal(await store.vincularConCodigo("ZZZZZZ", 5, "x"), null);
  const c = await store.crearCodigo("usuario-min");
  assert.equal(await store.vincularConCodigo(` ${c.toLowerCase()} `, 6, "Pepe"), "usuario-min");
});

test("desvincular quita solo ese chat y deja los demás", async () => {
  const antes = await store.getVinculos();
  assert.ok(antes["1000"] && antes["1001"]);
  await store.desvincular(1000);
  const despues = await store.getVinculos();
  assert.equal(despues["1000"], undefined);
  assert.ok(despues["1001"]);
});

test("el estado de una conversación se guarda y se lee", async () => {
  await store.setEstado(77, { fase: "titulo", title: "Hola" });
  assert.equal((await store.getEstado(77)).title, "Hola");
  assert.equal((await store.getEstado(78)).fase, "idle");
});
