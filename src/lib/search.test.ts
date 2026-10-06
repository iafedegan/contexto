import test, { before, mock } from "node:test";
import assert from "node:assert/strict";
import { prepararBd } from "@/test-utils/bd-memoria";

let search: typeof import("@/lib/search");
let bd: typeof import("@/db");
let schema: typeof import("@/db/schema");

before(async () => {
  await prepararBd();
  search = await import("@/lib/search");
  bd = await import("@/db");
  schema = await import("@/db/schema");
});

// Responde a la API de embeddings con un vector fijo y guarda lo que se le pidió.
function simularEmbeddings() {
  const pedidos: string[] = [];
  const vec = Array.from({ length: schema.EMBEDDING_DIMENSIONS }, (_, i) => (i === 0 ? 1 : 0));
  process.env.OPENAI_API_KEY = "clave-de-prueba";
  const m = mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    pedidos.push(String((JSON.parse(String(init?.body)) as { input: string }).input));
    return new Response(JSON.stringify({ data: [{ embedding: vec }] }), { status: 200, headers: { "content-type": "application/json" } });
  });
  return { pedidos, restaurar: () => { m.mock.restore(); delete process.env.OPENAI_API_KEY; } };
}

test("el embedding se calcula sobre la pregunta original y no sobre la lista de palabras de la consulta de texto", async () => {
  const { pedidos, restaurar } = simularEmbeddings();
  try {
    const pregunta = "¿Cómo van los precios del novillo en Medellín?";
    await search.hybridSearch(pregunta);
    assert.equal(pedidos.length, 1);
    assert.equal(pedidos[0], pregunta);
    assert.ok(!/ or /.test(pedidos[0]), "no debe ser la lista «palabra or palabra»");
  } finally {
    restaurar();
  }
});

test("con más de 50 coincidencias devuelve las mejores, en orden de relevancia", async () => {
  // 60 notas publicadas: la n repite la palabra n veces, así que cuanto más alta es n, más relevante es.
  await bd.db.insert(schema.articles).values(
    Array.from({ length: 60 }, (_, i) => ({
      slug: `novillo-${i + 1}`,
      title: `Nota ${i + 1}`,
      excerpt: "Mercado ganadero",
      body: `<p>${"novillo ".repeat(i + 1)}</p>`,
      status: "publicado" as const,
      publishedAt: new Date(),
    })),
  );
  const hits = await search.hybridSearch("novillo", 20);
  assert.equal(hits.length, 20);
  for (let i = 1; i < hits.length; i++) assert.ok(hits[i - 1].score >= hits[i].score, "puntuaciones no crecientes");
  // La nota con más repeticiones está entre las primeras: antes el recorte a 50 podía dejarla fuera.
  assert.ok(hits.slice(0, 5).some((h) => h.url === "/articulo/novillo-60"), "la más relevante debe estar arriba");
});
