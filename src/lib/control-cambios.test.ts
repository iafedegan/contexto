import test from "node:test";
import assert from "node:assert/strict";
import { actual, atribuir, diferencias, marcar, rechazar, trocear } from "./control-cambios";

const reconstruye = (a: string, b: string) => {
  const A = trocear(a);
  const B = trocear(b);
  const salida: string[] = [];
  for (const op of diferencias(A, B)) if (op.tipo !== "quita") salida.push(B[op.b!]);
  return salida.join("");
};

test("las diferencias reconstruyen el texto nuevo", () => {
  assert.equal(reconstruye("<p>El precio subió.</p>", "<p>El precio del ganado subió un 4 %.</p>"), "<p>El precio del ganado subió un 4 %.</p>");
  assert.equal(reconstruye("", "<p>Hola</p>"), "<p>Hola</p>");
  assert.equal(reconstruye("<p>Hola</p>", ""), "");
});

test("cada persona queda con lo que agregó y lo que quitó", () => {
  const p = atribuir([
    { html: "<p>El precio subió en Montería.</p>", autor: "Andrés" },
    { html: "<p>El precio del ganado subió en Montería.</p>", autor: "Ricardo" },
    { html: "<p>El precio del ganado subió.</p>", autor: "Pedro" },
  ]);
  assert.equal(actual(p), "<p>El precio del ganado subió.</p>");
  const { html, lista } = marcar(p, ["Ricardo", "Pedro"]);
  assert.ok(lista.some((c) => c.tipo === "pone" && c.autor === "Ricardo" && c.texto.trim() === "del ganado"));
  assert.ok(lista.some((c) => c.tipo === "quita" && c.autor === "Pedro" && c.texto.includes("Montería")));
  assert.match(html, /<ins class="cc-pone" data-cambio="\d+" data-persona="0">del ganado ?<\/ins>/);
  assert.match(html, /^<p>.*<\/p>$/);
});

test("rechazar deshace solo ese cambio", () => {
  const p = atribuir([
    { html: "<p>El precio subió.</p>", autor: "Andrés" },
    { html: "<p>El precio del ganado subió mucho.</p>", autor: "Ricardo" },
  ]);
  const { lista } = marcar(p, ["Ricardo"]);
  const delGanado = lista.find((c) => c.texto.includes("ganado"))!;
  assert.equal(rechazar(p, delGanado.id), "<p>El precio subió mucho.</p>");
});

test("lo que alguien agrega y él mismo borra no deja rastro", () => {
  const p = atribuir([
    { html: "<p>Hola.</p>", autor: "A" },
    { html: "<p>Hola mundo.</p>", autor: "B" },
    { html: "<p>Hola.</p>", autor: "B" },
  ]);
  assert.equal(marcar(p, ["B"]).lista.length, 0);
});

test("una versión de rechazo deshace el cambio sin dejar rastro", () => {
  const p = atribuir([
    { html: "<p>El precio subió.</p>", autor: "Andrés" },
    { html: "<p>El precio del ganado subió.</p>", autor: "Ricardo" },
    { html: "<p>El precio subió.</p>", autor: "Pedro", limpia: true },
  ]);
  assert.equal(marcar(p, ["Ricardo", "Pedro"]).lista.length, 0);
  const q = atribuir([
    { html: "<p>El precio subió en Montería.</p>", autor: "Andrés" },
    { html: "<p>El precio subió.</p>", autor: "Ricardo" },
    { html: "<p>El precio subió en Montería.</p>", autor: "Pedro", limpia: true },
  ]);
  assert.equal(marcar(q, ["Ricardo", "Pedro"]).lista.length, 0);
  assert.equal(actual(q), "<p>El precio subió en Montería.</p>");
});
