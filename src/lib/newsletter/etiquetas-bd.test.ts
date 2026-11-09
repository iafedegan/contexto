import test, { before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { prepararBd } from "@/test-utils/bd-memoria";
import { sanitizarAudiencia } from "@/lib/newsletter/audiencia-tipos";

type Bd = typeof import("@/lib/newsletter/etiquetas-bd");
type Aud = typeof import("@/lib/newsletter/audiencia");
let e: Bd;
let aud: Aud;
let db: typeof import("@/db").db;
let tabla: typeof import("@/db/schema").newsletterSubscribers;

before(async () => {
  await prepararBd();
  e = await import("@/lib/newsletter/etiquetas-bd");
  aud = await import("@/lib/newsletter/audiencia");
  ({ db } = await import("@/db"));
  ({ newsletterSubscribers: tabla } = await import("@/db/schema"));
});

/** Seis personas con etiquetas variadas; devuelve sus ids por letra. */
async function datos() {
  await db.delete(tabla);
  const filas = await db
    .insert(tabla)
    .values([
      { email: "a@x.co", confirmed: true, city: "Bogotá", tags: ["Aliados"] },
      { email: "b@x.co", confirmed: true, city: "Medellín", tags: [] },
      { email: "c@x.co", confirmed: true, city: "Bogotá", tags: ["Prensa", "Aliados"] },
      // No reciben nunca: sin confirmar y con baja (pero sí cuentan en el inventario de etiquetas).
      { email: "d@x.co", confirmed: false, tags: ["Aliados"] },
      { email: "e@x.co", confirmed: true, unsubscribedAt: new Date(), tags: ["Aliados"] },
      { email: "f@x.co", confirmed: true, city: "Cali", tags: ["Socios"] },
    ])
    .returning({ id: tabla.id, email: tabla.email });
  return Object.fromEntries(filas.map((f) => [f.email[0], f.id])) as Record<string, string>;
}
const etiquetasDe = async (id: string) => (await db.select({ t: tabla.tags }).from(tabla).where((await import("drizzle-orm")).eq(tabla.id, id)))[0]?.t;

beforeEach(async () => {
  await datos();
});

const cuenta = (v: unknown) => aud.contarAudiencia(sanitizarAudiencia(v));

test("filtrar por etiqueta: solo confirmados y sin baja; con varias basta una; y se combina con los demás filtros", async () => {
  assert.equal(await cuenta({ etiquetas: ["Aliados"] }), 2, "a y c (d no confirmó, e se dio de baja)");
  assert.equal(await cuenta({ etiquetas: ["Prensa"] }), 1);
  assert.equal(await cuenta({ etiquetas: ["Prensa", "Socios"] }), 2, "una u otra");
  assert.equal(await cuenta({ etiquetas: ["Inexistente"] }), 0);
  assert.equal(await cuenta({ etiquetas: ["Aliados"], ciudades: ["bogota"] }), 2);
  assert.equal(await cuenta({ etiquetas: ["Socios"], ciudades: ["bogota"] }), 0, "etiqueta Y ciudad");
  assert.equal(await cuenta({}), 4, "sin filtros siguen yendo todos los activos");
});

test("al elegir el público se ofrecen las etiquetas con cuántos activos las llevan", async () => {
  const o = await aud.opcionesAudiencia();
  assert.deepEqual(o.etiquetas, [
    { nombre: "Aliados", n: 2 },
    { nombre: "Prensa", n: 1 },
    { nombre: "Socios", n: 1 },
  ]);
});

test("el inventario cuenta a todos, activos o no", async () => {
  assert.deepEqual(await e.etiquetasEnUso(), [
    { nombre: "Aliados", n: 4 },
    { nombre: "Prensa", n: 1 },
    { nombre: "Socios", n: 1 },
  ]);
});

test("fijar las etiquetas de una persona unifica con las que ya existen y descarta repetidas", async () => {
  const id = (await datos()).b;
  assert.deepEqual(await e.fijarEtiquetas(id, [" aliados ", "ALIADOS", "Nueva"]), ["Aliados", "Nueva"], "«aliados» se une con la existente «Aliados»");
  assert.deepEqual(await etiquetasDe(id), ["Aliados", "Nueva"]);
  assert.deepEqual(await e.fijarEtiquetas(id, []), []);
  assert.equal(await e.fijarEtiquetas("00000000-0000-4000-8000-000000000000", ["x"]), null, "persona inexistente");
  assert.deepEqual(await e.fijarEtiquetas(id, "no es una lista"), [], "lo que no es lista no guarda nada");
});

test("poner una etiqueta a varias personas: reutiliza el nombre existente y no repite", async () => {
  const id = await datos();
  const r1 = await e.agregarAVarios([id.a, id.b, id.c], "  aliados ");
  assert.deepEqual(r1, { etiqueta: "Aliados", cambiados: 1, llenos: 0 }, "solo b la necesitaba");
  assert.deepEqual(await etiquetasDe(id.b), ["Aliados"]);
  assert.deepEqual(await etiquetasDe(id.a), ["Aliados"]);
  const r2 = await e.agregarAVarios([id.a, id.b], "Nueva");
  assert.deepEqual(r2, { etiqueta: "Nueva", cambiados: 2, llenos: 0 });
  assert.deepEqual(await etiquetasDe(id.a), ["Aliados", "Nueva"]);
  assert.deepEqual(await e.agregarAVarios([], "X"), { etiqueta: "X", cambiados: 0, llenos: 0 });
});

test("quien ya lleva el máximo de etiquetas no recibe más y se avisa", async () => {
  const id = await datos();
  await e.fijarEtiquetas(id.b, Array.from({ length: 20 }, (_, i) => `e${i}`));
  const r = await e.agregarAVarios([id.a, id.b], "Nueva");
  assert.deepEqual(r, { etiqueta: "Nueva", cambiados: 1, llenos: 1 });
  assert.equal((await etiquetasDe(id.b))?.length, 20);
});

test("quitar una etiqueta a varias personas", async () => {
  const id = await datos();
  const r = await e.quitarDeVarios([id.a, id.b, id.c], "aliados");
  assert.deepEqual(r, { etiqueta: "Aliados", cambiados: 2 }, "b no la llevaba");
  assert.deepEqual(await etiquetasDe(id.a), []);
  assert.deepEqual(await etiquetasDe(id.c), ["Prensa"]);
});

test("renombrar una etiqueta la cambia en todos; si el nombre nuevo ya existe, se unen sin dejar repetidas", async () => {
  const id = await datos();
  await e.agregarAVarios([id.c], "Socios"); // c lleva Aliados, Prensa y Socios
  const r = await e.renombrarEtiqueta("Aliados", "socios");
  assert.deepEqual(r, { nombre: "Socios", afectados: 4 }, "a, c, d y e la llevaban; el nombre nuevo se une con el existente");
  assert.deepEqual(await etiquetasDe(id.a), ["Socios"]);
  assert.deepEqual((await etiquetasDe(id.c))?.slice().sort(), ["Prensa", "Socios"], "c no queda con «Socios» dos veces");
  assert.deepEqual((await e.etiquetasEnUso()).map((x) => x.nombre).sort(), ["Prensa", "Socios"]);
  assert.equal(await e.renombrarEtiqueta("Socios", "Socios"), null, "mismo nombre: nada que hacer");
  assert.equal(await e.renombrarEtiqueta("Inexistente", "Otra"), null);
});

test("renombrar solo para cambiar mayúsculas funciona", async () => {
  const id = await datos();
  assert.deepEqual(await e.renombrarEtiqueta("Prensa", "PRENSA"), { nombre: "PRENSA", afectados: 1 });
  assert.deepEqual(await etiquetasDe(id.c), ["Aliados", "PRENSA"]);
});

test("eliminar una etiqueta se la quita a todos sin tocar a las personas", async () => {
  const id = await datos();
  assert.equal(await e.eliminarEtiqueta("Aliados"), 4);
  assert.deepEqual(await etiquetasDe(id.c), ["Prensa"]);
  assert.equal(await e.eliminarEtiqueta("Aliados"), 0);
  assert.equal((await db.select().from(tabla)).length, 6, "las personas siguen ahí");
});
