import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { embedMany, embeddingsDisponibles } from "@/lib/embeddings";

/**
 * Vectoriza las notas publicadas que aún no tienen embedding (las ~51.000 del sitio anterior se migraron sin él), de las más recientes a las
 * más antiguas. Es REANUDABLE y barato de llamar: cada ejecución avanza lo que cabe en su presupuesto de tiempo y la siguiente sigue donde
 * quedó, porque lo pendiente se define por «embedding es nulo». Sin proveedor configurado no hace nada y lo dice.
 */
const POR_LOTE = 64;

// Texto que se vectoriza de una nota: el mismo que usa `article-ops` al publicar, para que los vectores sean comparables.
const textoDe = (a: { title: string; excerpt: string; body: string }) => `${a.title}\n\n${a.excerpt}\n\n${a.body.replace(/<[^>]+>/g, " ").slice(0, 6000)}`;

export type ResultadoVectorizar = { ok: boolean; hechas: number; pendientes: number; motivo?: string };

/** Vectoriza lotes hasta agotar `presupuestoMs` o las notas pendientes. */
export async function vectorizarPendientes(presupuestoMs: number): Promise<ResultadoVectorizar> {
  const cuenta = async () => {
    const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(articles).where(and(eq(articles.status, "publicado"), isNull(articles.embedding)));
    return r?.n ?? 0;
  };
  if (!(await embeddingsDisponibles())) return { ok: false, hechas: 0, pendientes: await cuenta(), motivo: "No hay clave del proveedor de embeddings configurada." };

  const inicio = Date.now();
  let hechas = 0;
  while (Date.now() - inicio < presupuestoMs) {
    const lote = await db
      .select({ id: articles.id, title: articles.title, excerpt: articles.excerpt, body: articles.body })
      .from(articles)
      .where(and(eq(articles.status, "publicado"), isNull(articles.embedding)))
      .orderBy(desc(articles.publishedAt))
      .limit(POR_LOTE);
    if (lote.length === 0) break;
    const vectores = await embedMany(lote.map(textoDe));
    let guardadas = 0;
    for (const [i, v] of vectores.entries()) {
      if (!v) continue;
      await db.update(articles).set({ embedding: v }).where(eq(articles.id, lote[i].id));
      guardadas++;
    }
    hechas += guardadas;
    // Si el proveedor no devolvió nada (cuota, error), se corta: repetir el mismo lote no arregla nada y gastaría tiempo.
    if (guardadas === 0) return { ok: false, hechas, pendientes: await cuenta(), motivo: "El proveedor no devolvió vectores (cuota o error); se reintenta en la próxima ejecución." };
  }
  return { ok: true, hechas, pendientes: await cuenta() };
}
