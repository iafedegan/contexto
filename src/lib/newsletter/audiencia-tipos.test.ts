import test from "node:test";
import assert from "node:assert/strict";
import { AUDIENCIA_VACIA, claveCiudad, describirAudiencia, esSegmento, sanitizarAudiencia } from "@/lib/newsletter/audiencia-tipos";

test("sin filtros va a todos; cualquier filtro lo vuelve un segmento", () => {
  assert.equal(esSegmento(sanitizarAudiencia({})), false);
  assert.equal(esSegmento(sanitizarAudiencia(undefined)), false);
  assert.deepEqual(sanitizarAudiencia(null), AUDIENCIA_VACIA);
  assert.equal(esSegmento({ ...AUDIENCIA_VACIA, temas: ["leche"] }), true);
  assert.equal(esSegmento({ ...AUDIENCIA_VACIA, nuevosDias: 30 }), true);
});

test("lo que llega de la red se limpia: temas conocidos, países de dos letras, ciudades normalizadas, días razonables", () => {
  const a = sanitizarAudiencia({
    ciudades: ["  Bogotá ", "BOGOTA", "Medellín", 7, ""],
    paises: ["co", "COL", "ve", "co"],
    temas: ["leche", "inventado", "leche", "precios"],
    nuevosDias: 30.4,
  });
  assert.deepEqual(a.ciudades, ["bogota", "medellin"]);
  assert.deepEqual(a.paises, ["CO", "VE"]);
  assert.deepEqual(a.temas, ["leche", "precios"]);
  assert.equal(a.nuevosDias, 30);
  assert.equal(sanitizarAudiencia({ nuevosDias: 0 }).nuevosDias, null);
  assert.equal(sanitizarAudiencia({ nuevosDias: 99999 }).nuevosDias, null);
  assert.equal(sanitizarAudiencia({ nuevosDias: "30" }).nuevosDias, null);
  assert.equal(sanitizarAudiencia({ ciudades: "bogota" }).ciudades.length, 0);
  assert.equal(sanitizarAudiencia({ ciudades: Array.from({ length: 100 }, (_, i) => `ciudad ${i}`) }).ciudades.length, 30);
  assert.equal(claveCiudad("  Cúcuta  "), "cucuta");
});

test("la descripción dice a quién va", () => {
  assert.equal(describirAudiencia(AUDIENCIA_VACIA), "Todos los suscriptores");
  const d = describirAudiencia({ ciudades: ["bogota", "medellin"], paises: [], temas: ["precios"], nuevosDias: 30 }, (c) => c.toUpperCase());
  assert.equal(d, "BOGOTA y MEDELLIN · interesados en Precios y mercado · suscritos en los últimos 30 días");
});
