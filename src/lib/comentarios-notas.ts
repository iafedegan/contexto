import "server-only";
import { and, asc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { articleCommentReads, articleComments, articles, users } from "@/db/schema";
import { condicionVisibles } from "@/lib/propiedad-notas";

/**
 * Comentarios de la revisión de una nota. Quien tiene a cargo la nota, quien la revisa y el diseñador con una imagen por hacer los ven y pueden
 * responder; la otra parte recibe un aviso (el número de comentarios sin leer) en el listado de artículos y en el menú.
 */
export type Comentario = { id: string; texto: string; /** Fragmento de la nota al que se refiere (si se comentó una selección). */ cita: string | null; fecha: string; autor: string; autorRol: string; mio: boolean };

export const MAX_CITA = 600;

export const MAX_COMENTARIO = 2000;

/** Los comentarios de una nota, del más antiguo al más nuevo. */
export async function listarComentarios(articleId: string, userId: string): Promise<Comentario[]> {
  const filas = await db
    .select({ id: articleComments.id, texto: articleComments.body, cita: articleComments.quote, fecha: articleComments.createdAt, autorId: articleComments.authorId, autor: users.name, rol: users.role })
    .from(articleComments)
    .leftJoin(users, eq(users.id, articleComments.authorId))
    .where(eq(articleComments.articleId, articleId))
    .orderBy(asc(articleComments.createdAt));
  return filas.map((f) => ({ id: f.id, texto: f.texto, cita: f.cita, fecha: f.fecha.toISOString(), autor: f.autor ?? "Persona eliminada", autorRol: f.rol ?? "", mio: f.autorId === userId }));
}

/** Deja un comentario (ya validado por quien llama) y lo da por leído para su autor. */
export async function agregarComentario(articleId: string, userId: string, texto: string, cita?: string | null): Promise<void> {
  await db.insert(articleComments).values({ articleId, authorId: userId, body: texto, quote: cita || null });
  await marcarLeidos(articleId, userId);
}

/** Da por leídos los comentarios de la nota para la persona (una sola sentencia: dos aperturas a la vez no se pisan). */
export async function marcarLeidos(articleId: string, userId: string): Promise<void> {
  await db
    .insert(articleCommentReads)
    .values({ articleId, userId, lastReadAt: new Date() })
    .onConflictDoUpdate({ target: [articleCommentReads.articleId, articleCommentReads.userId], set: { lastReadAt: sql`now()` } });
}

/** Cuántos comentarios sin leer tiene la persona por nota (de otras personas y posteriores a su última lectura). Solo notas con novedades. */
export async function contarSinLeer(userId: string, articleIds?: string[]): Promise<Map<string, number>> {
  if (articleIds && articleIds.length === 0) return new Map();
  const filas = await db
    .select({ articleId: articleComments.articleId, n: sql<number>`count(*)::int` })
    .from(articleComments)
    .leftJoin(articleCommentReads, and(eq(articleCommentReads.articleId, articleComments.articleId), eq(articleCommentReads.userId, userId)))
    .where(
      and(
        articleIds ? inArray(articleComments.articleId, articleIds) : undefined,
        sql`${articleComments.authorId} is distinct from ${userId}`,
        or(isNull(articleCommentReads.lastReadAt), gt(articleComments.createdAt, articleCommentReads.lastReadAt)),
      ),
    )
    .groupBy(articleComments.articleId);
  return new Map(filas.map((f) => [f.articleId, f.n]));
}

/** Total de comentarios sin leer en las notas que la persona ve: el número rojo del menú. Si falla, 0. */
export async function totalSinLeer(persona: { id: string; role: string }): Promise<number> {
  try {
    const visibles = await condicionVisibles(persona);
    const filas = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(articleComments)
      .innerJoin(articles, eq(articles.id, articleComments.articleId))
      .leftJoin(articleCommentReads, and(eq(articleCommentReads.articleId, articleComments.articleId), eq(articleCommentReads.userId, persona.id)))
      .where(and(visibles, sql`${articleComments.authorId} is distinct from ${persona.id}`, or(isNull(articleCommentReads.lastReadAt), gt(articleComments.createdAt, articleCommentReads.lastReadAt))));
    return filas[0]?.n ?? 0;
  } catch {
    return 0;
  }
}
