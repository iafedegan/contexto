import test, { before } from "node:test";
import assert from "node:assert/strict";
import { prepararBd } from "@/test-utils/bd-memoria";

let bd: typeof import("@/db");
let esq: typeof import("@/db/schema");
let rec: typeof import("@/lib/recorrido-nota");
let act: typeof import("@/lib/actividad-notas");

before(async () => {
  await prepararBd();
  bd = await import("@/db");
  esq = await import("@/db/schema");
  rec = await import("@/lib/recorrido-nota");
  act = await import("@/lib/actividad-notas");
});

test("el recorrido cuenta quién creó, editó y a quién se la pasó, en orden", async () => {
  const persona = async (email: string, name: string) => (await bd.db.insert(esq.users).values({ email, name, role: "editor", passwordHash: "x" }).returning({ id: esq.users.id }))[0].id;
  const andres = await persona("a@x.co", "Andrés Artuz");
  const ricardo = await persona("r@x.co", "Ricardo Arenas");
  const pedro = await persona("p@x.co", "Pedro Fonseca");
  const [n] = await bd.db.insert(esq.articles).values({ slug: "nota", title: "Nota", excerpt: "x", body: "x" }).returning({ id: esq.articles.id });
  await act.registrarActividad(n.id, andres, "creo");
  await act.registrarActividad(n.id, ricardo, "edito", 12);
  await act.registrarActividad(n.id, ricardo, "envio");
  await act.registrarActividad(n.id, pedro, "recibio");
  const pasos = await rec.recorridoDe(n.id);
  const textos = pasos.map((p) => `${p.quien} ${p.texto}`);
  assert.ok(textos.includes("Andrés Artuz creó la nota"));
  assert.ok(textos.includes("Ricardo Arenas la editó · 12 palabras cambiadas"));
  assert.ok(textos.includes("Ricardo Arenas se la pasó a Pedro Fonseca"));
  assert.ok(textos.includes("Pedro Fonseca la recibió"));
});
