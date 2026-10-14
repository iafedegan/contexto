import test, { before } from "node:test";
import assert from "node:assert/strict";
import { prepararBd } from "@/test-utils/bd-memoria";
import { sanitizarAudiencia } from "@/lib/newsletter/audiencia-tipos";

type Mod = typeof import("@/lib/newsletter/audiencia");
let m: Mod;
let db: typeof import("@/db").db;
let tabla: typeof import("@/db/schema").newsletterSubscribers;

const ahora = Date.now();
const hace = (dias: number) => new Date(ahora - dias * 86_400_000);

before(async () => {
  await prepararBd();
  m = await import("@/lib/newsletter/audiencia");
  ({ db } = await import("@/db"));
  ({ newsletterSubscribers: tabla } = await import("@/db/schema"));
  await db.insert(tabla).values([
    // Bogotá escrita de tres formas, con temas.
    { email: "a@x.co", confirmed: true, city: "Bogotá", signupCountry: "CO", signupLat: "4.7000", signupLon: "-74.1000", interests: ["precios", "leche"], createdAt: hace(5) },
    { email: "b@x.co", confirmed: true, city: "  BOGOTA ", signupCountry: "CO", signupLat: "4.7200", signupLon: "-74.0400", interests: ["sanidad"], createdAt: hace(100) },
    // Sin ciudad escrita: se usa la de la IP.
    { email: "c@x.co", confirmed: true, signupCity: "Bogotá", signupCountry: "CO", interests: [], createdAt: hace(40) },
    { email: "d@x.co", confirmed: true, city: "Medellín", signupCountry: "CO", interests: ["precios"], createdAt: hace(2) },
    { email: "e@x.co", confirmed: true, city: "Caracas", signupCountry: "VE", interests: ["leche"], createdAt: hace(300) },
    // No reciben nunca: sin confirmar y con baja.
    { email: "f@x.co", confirmed: false, city: "Bogotá", signupCountry: "CO", interests: ["precios"], createdAt: hace(1) },
    { email: "g@x.co", confirmed: true, unsubscribedAt: new Date(), city: "Bogotá", signupCountry: "CO", interests: ["precios"], createdAt: hace(1) },
  ]);
});

const cuenta = (v: unknown) => m.contarAudiencia(sanitizarAudiencia(v));

test("sin filtros van todos los confirmados y sin baja", async () => {
  assert.equal(await cuenta({}), 5);
});

test("ciudad: junta las distintas formas de escribirla y usa la de la IP si no escribió ninguna", async () => {
  assert.equal(await cuenta({ ciudades: ["Bogotá"] }), 3);
  assert.equal(await cuenta({ ciudades: ["bogota", "medellin"] }), 4);
  assert.equal(await cuenta({ ciudades: ["Cali"] }), 0);
});

test("país, temas y antigüedad", async () => {
  assert.equal(await cuenta({ paises: ["VE"] }), 1);
  assert.equal(await cuenta({ paises: ["co"] }), 4);
  assert.equal(await cuenta({ temas: ["precios"] }), 2);
  assert.equal(await cuenta({ temas: ["precios", "sanidad"] }), 3);
  assert.equal(await cuenta({ nuevosDias: 30 }), 2);
});

test("los filtros de distinto tipo se suman (y) y los del mismo tipo se alternan (o)", async () => {
  assert.equal(await cuenta({ ciudades: ["bogota"], temas: ["precios"] }), 1);
  assert.equal(await cuenta({ ciudades: ["bogota"], nuevosDias: 30 }), 1);
  assert.equal(await cuenta({ ciudades: ["bogota", "medellin"], temas: ["precios", "leche"], nuevosDias: 30 }), 2);
});

test("un valor con comillas o SQL no rompe nada: va como parámetro", async () => {
  assert.equal(await cuenta({ ciudades: ["x') or 1=1 --"] }), 0);
});

test("las opciones traen las ciudades agrupadas, los países y los temas con su cuenta", async () => {
  const o = await m.opcionesAudiencia();
  assert.equal(o.total, 5);
  assert.equal(o.conTemas, 4);
  assert.equal(o.ciudades[0].clave, "bogota");
  assert.equal(o.ciudades[0].n, 3);
  // Para el mapa: el promedio de las ubicaciones de quienes se registraron en esa ciudad (la tercera no trae ubicación).
  assert.ok(Math.abs((o.ciudades[0].lat ?? 0) - 4.71) < 0.001 && Math.abs((o.ciudades[0].lon ?? 0) + 74.07) < 0.001);
  assert.equal(o.ciudades.find((c) => c.clave === "medellin")?.lat, null);
  assert.deepEqual(o.paises, [{ codigo: "CO", n: 4 }, { codigo: "VE", n: 1 }]);
  assert.deepEqual(o.temas.find((x) => x.id === "precios"), { id: "precios", n: 2 });
  assert.deepEqual(o.temas.find((x) => x.id === "leche"), { id: "leche", n: 2 });
});
