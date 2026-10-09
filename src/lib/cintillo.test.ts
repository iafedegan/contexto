import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TICKER, duracionDelCintillo, piezasDelCintillo, sanitizeTicker } from "@/lib/cintillo";

test("sin configuración, el cintillo queda como corría antes: titulares de la portada, los tres indicadores y velocidad media", () => {
  assert.deepEqual(sanitizeTicker(undefined), DEFAULT_TICKER);
  assert.deepEqual(sanitizeTicker("basura"), DEFAULT_TICKER);
  assert.deepEqual(sanitizeTicker({}), DEFAULT_TICKER);
});

test("lo que llegue se valida: rangos, fuentes, secciones y textos", () => {
  const t = sanitizeTicker({ cantidad: 99, velocidad: 0, fuente: "inventada", seccion: "../etc", mercado: ["trm", "x"], textos: ["  hola   mundo ", "", 5, "x".repeat(500)] });
  assert.equal(t.cantidad, 20);
  assert.equal(t.velocidad, 1);
  assert.equal(t.fuente, "portada");
  assert.equal(t.seccion, "", "la sección solo cuenta con la fuente «seccion»");
  assert.deepEqual(t.mercado, ["trm"]);
  assert.deepEqual(t.textos.map((x) => x.length), [10, 140]);
  assert.equal(t.textos[0], "hola mundo");
  assert.equal(sanitizeTicker({ fuente: "seccion", seccion: "ganaderia" }).seccion, "ganaderia");
  assert.equal(sanitizeTicker({ fuente: "seccion", seccion: "Con Espacios" }).seccion, "");
  assert.equal(sanitizeTicker({ textos: Array.from({ length: 30 }, (_, i) => `m${i}`) }).textos.length, 10);
  assert.equal(sanitizeTicker({ activo: false }).activo, false);
  assert.equal(sanitizeTicker({ cantidad: 0 }).cantidad, 0, "cero titulares es válido");
});

test("las piezas salen en orden: mensajes propios, indicadores elegidos y titulares", () => {
  const cfg = sanitizeTicker({ textos: ["Feria en Montería"], mercado: ["cattle", "trm"], cantidad: 2 });
  const p = piezasDelCintillo(cfg, {
    mercado: [{ key: "trm", texto: "Dólar $3.239" }, { key: "oil", texto: "Brent 80" }, { key: "cattle", texto: "Novillo $9.940" }],
    notas: [{ slug: "a", title: "A" }, { slug: "b", title: "B" }, { slug: "c", title: "C" }],
  });
  assert.deepEqual(p.map((x) => x.texto), ["Feria en Montería", "Dólar $3.239", "Novillo $9.940", "A", "B"]);
  assert.deepEqual(p.map((x) => x.tipo), ["texto", "mercado", "mercado", "nota", "nota"]);
  assert.deepEqual(piezasDelCintillo(sanitizeTicker({ cantidad: 0, mercado: [] }), { mercado: [], notas: [{ slug: "a", title: "A" }] }), []);
});

test("la velocidad: más alta = vuelta más corta, y un texto más largo tarda más con la misma velocidad", () => {
  const corto = [{ clave: "a", tipo: "nota" as const, texto: "x".repeat(300) }];
  const largo = [{ clave: "a", tipo: "nota" as const, texto: "x".repeat(900) }];
  assert.ok(duracionDelCintillo(corto, 10) < duracionDelCintillo(corto, 6));
  assert.ok(duracionDelCintillo(corto, 6) < duracionDelCintillo(corto, 1));
  assert.ok(duracionDelCintillo(largo, 6) > duracionDelCintillo(corto, 6));
  // A velocidad 6, ~800 caracteres dan ~38 s: lo que corría antes.
  const antes = duracionDelCintillo([{ clave: "a", tipo: "nota", texto: "x".repeat(800 - 6) }], 6);
  assert.ok(antes >= 36 && antes <= 40, String(antes));
  assert.equal(duracionDelCintillo([{ clave: "a", tipo: "nota", texto: "x" }], 10), 12, "nunca menos de 12 s");
  assert.equal(duracionDelCintillo([{ clave: "a", tipo: "nota", texto: "x".repeat(50000) }], 1), 400, "nunca más de 400 s");
});
