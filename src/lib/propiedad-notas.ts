import "server-only";
import { and, eq, inArray, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors } from "@/db/schema";
import { notasAsignadasA } from "@/lib/notas-asignadas";
import { leerPedidos } from "@/lib/imagenes-pedidas";
import { pendientesPara } from "@/lib/imagenes-pedidas-reglas";

/**
 * Quién ve y toca qué notas: los administradores todas; el resto de las personas (redactor y editor), solo las SUYAS — las que
 * crearon ellas o las que llevan su firma (la ficha de autor vinculada a su cuenta). Se usa en el listado y, además, en cada
 * acción sobre una nota y al abrirla: ocultar la fila no basta si se puede escribir la dirección o llamar a la acción. Las notas que le
 * enviaron o asignaron a la persona (ver `notas-asignadas.ts`) también cuentan como suyas: así el editor puede revisarlas y publicarlas.
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
  const [ids, asignadas] = await Promise.all([misAutorIds(p.id), notasAsignadasA(p.id)]);
  return or(eq(articles.createdBy, p.id), ...(ids.length ? [inArray(articles.authorId, ids)] : []), ...(asignadas.length ? [inArray(articles.id, asignadas)] : []));
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

/**
 * Qué notas VE una persona (listado de artículos y vista previa), que es más que lo que puede EDITAR (`condicionMisNotas`):
 * los administradores todas; los demás, las que tienen a cargo (las suyas y las que les enviaron), y además
 *  - el editor, todas las que están «En revisión» (las que le toca revisar);
 *  - el diseñador, aquellas a las que tiene una imagen por hacer (o ya entregó).
 * `undefined` = sin límite (administrador).
 */
export async function condicionVisibles(p: Persona): Promise<SQL | undefined> {
  if (p.role === "administrador") return undefined;
  const propias = await condicionMisNotas(p);
  const extras: SQL[] = [];
  if (p.role === "editor") extras.push(eq(articles.status, "en_revision"));
  if (p.role === "disenador") {
    const pedidos = await leerPedidos().catch(() => []);
    const ids = [...new Set([...pendientesPara(pedidos, p.id, p.role).map((x) => x.articleId), ...pedidos.filter((x) => x.entregadaPorId === p.id).map((x) => x.articleId)])];
    if (ids.length) extras.push(inArray(articles.id, ids));
  }
  return or(...(propias ? [propias] : []), ...extras);
}

/** ¿Puede la persona ver esta nota (listado, vista previa, comentarios)? Los administradores sí; una nota que no existe, no. */
export async function puedeVerNota(p: Persona, articleId: string): Promise<boolean> {
  const cond = await condicionVisibles(p);
  const [fila] = await db.select({ id: articles.id }).from(articles).where(and(eq(articles.id, articleId), cond)).limit(1);
  return Boolean(fila);
}
