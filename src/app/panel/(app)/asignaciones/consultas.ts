import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { articles, siteSettings, users } from "@/db/schema";

import { ASIGNADAS_KEY, editoresActivos, type Asignacion } from "@/lib/notas-asignadas";

// La clave y la forma de cada asignación viven en `lib/notas-asignadas.ts` (las usan también el asistente y los permisos de las notas).
export { ASIGNADAS_KEY, type Asignacion };

/** Personas a las que se les puede asignar una nota: editores y administradores activos, sin quien asigna. */
export async function editoresParaAsignar(excepto?: string): Promise<{ id: string; nombre: string; rol: string }[]> {
  return (await editoresActivos(excepto)).map((e) => ({ ...e, rol: "" }));
}

export type FilaAsignada = Asignacion & { titulo: string; estado: string; editor: string; por: string; slug: string };

/** Las asignaciones de la persona (`para`: las que le tocan; `por`: las que dejó), con el estado actual de cada nota. Las notas borradas no aparecen. */
export async function misAsignaciones(userId: string): Promise<{ paraMi: FilaAsignada[]; porMi: FilaAsignada[] }> {
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, ASIGNADAS_KEY)).limit(1);
  const todas = (Array.isArray(row?.value) ? (row.value as Asignacion[]) : []).filter((a) => a.editorId === userId || a.porId === userId);
  if (!todas.length) return { paraMi: [], porMi: [] };
  const [notas, personas] = await Promise.all([
    db.select({ id: articles.id, titulo: articles.title, estado: articles.status, slug: articles.slug }).from(articles).where(inArray(articles.id, todas.map((a) => a.articleId))),
    db.select({ id: users.id, nombre: users.name }).from(users).where(inArray(users.id, [...new Set(todas.flatMap((a) => [a.editorId, a.porId]))])),
  ]);
  const nota = new Map(notas.map((n) => [n.id, n]));
  const nombre = new Map(personas.map((p) => [p.id, p.nombre]));
  const filas: FilaAsignada[] = todas
    .filter((a) => nota.has(a.articleId))
    .map((a) => ({ ...a, titulo: nota.get(a.articleId)!.titulo, estado: nota.get(a.articleId)!.estado, slug: nota.get(a.articleId)!.slug, editor: nombre.get(a.editorId) ?? "—", por: nombre.get(a.porId) ?? "—" }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  return { paraMi: filas.filter((f) => f.editorId === userId), porMi: filas.filter((f) => f.porId === userId && f.editorId !== userId) };
}
