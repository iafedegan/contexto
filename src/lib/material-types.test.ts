import test from "node:test";
import assert from "node:assert/strict";
import { formatoTiempo, materialParaPrompt, parseTiempo, sinIdentificar, textoDeSegmentos, type Material } from "@/lib/material-types";

test("formatoTiempo y parseTiempo son inversos", () => {
  assert.equal(formatoTiempo(75), "1:15");
  assert.equal(formatoTiempo(3725), "1:02:05");
  assert.equal(parseTiempo("1:15"), 75);
  assert.equal(parseTiempo("1:02:05"), 3725);
  assert.equal(parseTiempo("abc"), undefined);
});

test("la transcripción por intervenciones conserva quién habló", () => {
  const texto = textoDeSegmentos([
    { hablante: "Ana", inicio: 5, texto: "Hola." },
    { hablante: "Luis", texto: "Buenas." },
  ]);
  assert.match(texto, /\[0:05\] Ana: Hola\./);
  assert.match(texto, /Luis: Buenas\./);
});

test("se cuentan las intervenciones sin identificar", () => {
  assert.equal(sinIdentificar([{ hablante: "Sin identificar", texto: "a" }, { hablante: "Hablante 2", texto: "b" }, { hablante: "Ana", texto: "c" }]), 2);
});

test("el material de una entrevista le prohíbe al modelo atribuir citas a quien no está identificado", () => {
  const m: Material = { kind: "entrevista", title: "E", text: "Ana: hola", participantes: [{ nombre: "Ana", cargo: "Ministra" }], esEntrevista: true, segmentos: [{ hablante: "Ana", texto: "hola" }] };
  const p = materialParaPrompt([m]);
  assert.match(p, /Ana \(Ministra\)/);
  assert.match(p, /no atribuyas ninguna cita/i);
});
