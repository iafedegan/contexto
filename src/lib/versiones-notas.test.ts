import test, { before } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { prepararBd } from "@/test-utils/bd-memoria";

let bd: typeof import("@/db");
let esq: typeof import("@/db/schema");
let ver: typeof import("@/lib/versiones-notas");
let act: typeof import("@/lib/actividad-notas");

before(async () => {
  await prepararBd();
  bd = await import("@/db");
  esq = await import("@/db/schema");
  ver = await import("@/lib/versiones-notas");
  act = await import("@/lib/actividad-notas");
});

test("control de cambios: marca lo de Ricardo, se rechaza un cambio y al aceptar quedan limpios", async () => {
  const persona = async (email: string, name: string) => (await bd.db.insert(esq.users).values({ email, name, role: "editor", passwordHash: "x" }).returning({ id: esq.users.id }))[0].id;
  const andres = await persona("a@x.co", "Andrés Artuz");
  const ricardo = await persona("r@x.co", "Ricardo Arenas");
  const [n] = await bd.db.insert(esq.articles).values({ slug: "n", title: "Precio del ganado", excerpt: "x", body: "<p>El precio subió en Montería.</p>" }).returning({ id: esq.articles.id });

  assert.equal((await ver.controlDeCambios(n.id)).hay, false, "sin envíos no hay control de cambios");
  await ver.guardarVersion(n.id, andres, "envio"); // Andrés se la envía a Ricardo
  await bd.db.update(esq.articles).set({ body: "<p>El precio del ganado subió.</p>" }).where(eq(esq.articles.id, n.id));
  await act.registrarActividad(n.id, ricardo, "edito", 4);

  const c = await ver.controlDeCambios(n.id);
  assert.equal(c.hay, true);
  assert.deepEqual(c.personas, ["Ricardo Arenas"]);
  const puso = c.cambios.find((x) => x.tipo === "pone")!;
  const quito = c.cambios.find((x) => x.tipo === "quita")!;
  assert.equal(puso.texto.trim(), "del ganado");
  assert.ok(quito.texto.includes("Montería"));

  // Se rechaza lo que quitó: «en Montería» vuelve y ese cambio desaparece.
  const cuerpo = await ver.rechazarCambio(n.id, ricardo, quito.id);
  assert.equal(cuerpo, "<p>El precio del ganado subió en Montería.</p>");
  const c2 = await ver.controlDeCambios(n.id);
  assert.equal(c2.cambios.length, 1);
  assert.equal(c2.cambios[0].texto.trim(), "del ganado");

  await ver.guardarVersion(n.id, ricardo, "aceptado");
  assert.equal((await ver.controlDeCambios(n.id)).cambios.length, 0, "aceptar deja la versión actual sin marcas");
});

test("si otra persona empieza a editar sin que se la envíen, sus cambios también quedan marcados", async () => {
  const persona = async (email: string, name: string) => (await bd.db.insert(esq.users).values({ email, name, role: "editor", passwordHash: "x" }).returning({ id: esq.users.id }))[0].id;
  const angie = await persona("an@x.co", "Angie Barbosa");
  const pedro = await persona("pe@x.co", "Pedro Fonseca");
  const [n] = await bd.db.insert(esq.articles).values({ slug: "n2", title: "Ferias", excerpt: "x", body: "<p>Rionegro será sede.</p>", createdBy: angie }).returning({ id: esq.articles.id });
  await act.registrarActividad(n.id, angie, "edito", 3);
  await ver.versionAlCambiarDeManos(n.id, pedro); // Pedro abre y corrige
  await bd.db.update(esq.articles).set({ body: "<p>Rionegro (Antioquia) será sede.</p>" }).where(eq(esq.articles.id, n.id));
  await act.registrarActividad(n.id, pedro, "edito", 1);
  const c = await ver.controlDeCambios(n.id);
  assert.equal(c.hay, true);
  assert.deepEqual(c.personas, ["Pedro Fonseca"]);
  assert.ok(c.cambios.some((x) => x.tipo === "pone" && x.texto.includes("Antioquia")));
  const rec = await import("@/lib/recorrido-nota");
  const pasos = await rec.recorridoDe(n.id);
  assert.equal(`${pasos[0].quien} ${pasos[0].texto}`, "Angie Barbosa creó la nota");
});
