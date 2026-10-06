import test from "node:test";
import assert from "node:assert/strict";
import { cifrasSinRespaldo, citasSinRespaldo, sinCifrasInventadas, sinCitasInventadas } from "@/lib/ai/verificacion";

const respaldo = "El ministro dijo: «El Estado fortalecerá el control sobre estos dineros públicos». El censo reporta 29.315.726 cabezas.";

test("una cifra que consta en el respaldo se acepta; una inventada se detecta", () => {
  assert.deepEqual(cifrasSinRespaldo("<p>Hay 29.315.726 cabezas.</p>", respaldo), []);
  assert.deepEqual(cifrasSinRespaldo("<p>Hay 31.000.000 cabezas.</p>", respaldo), ["31.000.000"]);
});

test("se elimina el párrafo que contiene una cifra sin respaldo y se conserva el resto", () => {
  const html = "<p>Hay 31.000.000 cabezas.</p><p>Texto sano.</p>";
  const limpio = sinCifrasInventadas(html, cifrasSinRespaldo(html, respaldo));
  assert.equal(limpio.includes("31.000.000"), false);
  assert.match(limpio, /Texto sano/);
});

test("una cita textual literal se acepta aunque cambien tildes, mayúsculas o etiquetas", () => {
  const html = "<p>Dijo «<strong>el estado fortalecera el control</strong> sobre estos dineros publicos».</p>";
  assert.deepEqual(citasSinRespaldo(html, respaldo), []);
});

test("una cita que nadie dijo se detecta y su párrafo se elimina", () => {
  const html = "<p>Aseguró: «Vamos a eliminar todos los fondos del sector ganadero».</p><p>Otra cosa.</p>";
  const malas = citasSinRespaldo(html, respaldo);
  assert.equal(malas.length, 1);
  const limpio = sinCitasInventadas(html, malas);
  assert.equal(limpio.includes("eliminar"), false);
  assert.match(limpio, /Otra cosa/);
});
