import "server-only";
import { and, eq, inArray, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors } from "@/db/schema";

/**
 * Quién ve y toca qué notas: los administradores todas; el resto de las personas (redactor y editor), solo las SUYAS — las que
 * crearon ellas o las que llevan su firma (la ficha de autor vinculada a su cuenta). Se usa en el listado y, además, en cada
 * acción sobre una nota y al abrirla: ocultar la fila no basta si se puede escribir la dirección o llamar a la acción.
 */
type Persona = { id: string; role: string };

// Fichas de autor vinculadas a la cuenta de la persona.
async function misAutorIds(userId: string): Promise<string[]> {
  const filas = await db.select({ id: authors.id }).from(authors).where(eq(authors.userId, userId));
  return filas.map((f) => f.id);
}

/** Condición SQL que limita las notas a las de la persona; `undefined` (sin límite) para un administrador. */
export async function condicionMisNotas(p: Persona): Promise<SQL | undefined> {
  if (p.role === "administrador") return undefined;
  const ids = await misAutorIds(p.id);
  return ids.length ? or(eq(articles.createdBy, p.id), inArray(articles.authorId, ids)) : eq(articles.createdBy, p.id);
}

/** ¿Es la nota de la persona (o es administradora)? Una nota que no existe devuelve `true` para que quien llama dé su propio error. */
export async function esNotaPropia(p: Persona, articleId: string): Promise<boolean> {
  if (p.role === "administrador") return true;
  const cond = await condicionMisNotas(p);
  const [fila] = await db.select({ id: articles.id }).from(articles).where(and(eq(articles.id, articleId), cond)).limit(1);
  if (fila) return true;
  const [existe] = await db.select({ id: articles.id }).from(articles).where(eq(articles.id, articleId)).limit(1);
  return !existe;
}

/** Lanza si la nota es de otra persona. */
export async function exigirNotaPropia(p: Persona, articleId: string): Promise<void> {
  if (!(await esNotaPropia(p, articleId))) throw new Error("Solo puedes ver y modificar tus propias notas.");
}
