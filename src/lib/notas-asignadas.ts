import "server-only";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, siteSettings, users } from "@/db/schema";
import { destinoPermitido, destinosPara, puedeEnviarNota, type Destino } from "@/lib/notas-asignadas-reglas";

/**
 * Notas que se le dejan a un editor: las preescritas en «Notas para editores» y las que un redactor o un administrador le envía desde el
 * asistente de redacción. Se anotan en `site_settings` (una lista; sin migración). Una nota enviada a un editor cuenta como SUYA para abrirla,
 * revisarla y publicarla (ver `propiedad-notas.ts`), aunque la haya escrito otra persona.
 */
export const ASIGNADAS_KEY = "notas_asignadas";

export type Asignacion = { articleId: string; editorId: string; porId: string; mensaje: string; fecha: string; /** Cuándo la abrió por primera vez quien la recibe (pasa de «Pendiente» a «Editando»). */ abiertaAt?: string };

/** Solo administradores y redactores envían notas a un editor desde el asistente. */
export const puedeEnviarAEditor = (role: string) => role === "administrador" || role === "redactor";

/** Quién recibe notas: los editores y los administradores (en la redacción, los administradores también hacen de editores). */
export const ROLES_QUE_RECIBEN = ["editor", "administrador"] as const;
export const recibeNotas = (role: string) => (ROLES_QUE_RECIBEN as readonly string[]).includes(role);

/** Editores y administradores activos a los que se les puede enviar una nota, por nombre (sin la persona que envía). */
export async function editoresActivos(excepto?: string): Promise<{ id: string; nombre: string }[]> {
  const filas = await db
    .select({ id: users.id, nombre: users.name })
    .from(users)
    .where(and(eq(users.active, true), inArray(users.role, [...ROLES_QUE_RECIBEN]), ...(excepto ? [ne(users.id, excepto)] : [])));
  return filas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/** Personas activas a las que `role` puede enviarle una nota desde el asistente (un redactor, solo editores; un editor o administrador, todas). */
export async function destinosActivos(role: string, userId: string): Promise<Destino[]> {
  if (!puedeEnviarNota(role)) return [];
  const filas = await db.select({ id: users.id, nombre: users.name, rol: users.role }).from(users).where(eq(users.active, true));
  return destinosPara(role, userId, filas);
}

/** Devuelve a la persona activa si `role` puede enviarle una nota; si no, `null`. */
export async function destinoActivo(role: string, userId: string, id: string): Promise<{ id: string; nombre: string } | null> {
  const [p] = await db.select({ id: users.id, nombre: users.name, rol: users.role }).from(users).where(and(eq(users.id, id), eq(users.active, true))).limit(1);
  return p && p.id !== userId && destinoPermitido(role, p.rol) ? { id: p.id, nombre: p.nombre } : null;
}

/** ¿Puede recibir notas (editor o administrador, activo)? */
export async function esEditorActivo(id: string): Promise<{ id: string; nombre: string } | null> {
  const [e] = await db.select({ id: users.id, nombre: users.name }).from(users).where(and(eq(users.id, id), eq(users.active, true), inArray(users.role, [...ROLES_QUE_RECIBEN]))).limit(1);
  return e ?? null;
}

/**
 * Anota la asignación. Si la nota ya estaba asignada, la entrada anterior se reemplaza (reenviarla a otro editor no la deja en dos listas).
 * Una sola sentencia: dos envíos a la vez no se pisan.
 */
export async function registrarAsignacion(a: Asignacion): Promise<void> {
  await db
    .insert(siteSettings)
    .values({ key: ASIGNADAS_KEY, value: [a] })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: {
        value: sql`coalesce((select jsonb_agg(e) from jsonb_array_elements(${siteSettings.value}) e where e->>'articleId' <> ${a.articleId}), '[]'::jsonb) || excluded.value`,
        updatedAt: sql`now()`,
      },
    });
}

/** Ids de las notas asignadas a una persona. */
export async function notasAsignadasA(userId: string): Promise<string[]> {
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, ASIGNADAS_KEY)).limit(1);
  const lista = Array.isArray(row?.value) ? (row.value as Asignacion[]) : [];
  return [...new Set(lista.filter((a) => a.editorId === userId).map((a) => a.articleId))];
}

/** A quién se envió cada nota (nombre del editor), para las notas dadas. Solo las que siguen en borrador o en revisión importan a quien llama. */
export async function destinatariosDe(articleIds: string[]): Promise<Map<string, string>> {
  if (!articleIds.length) return new Map();
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, ASIGNADAS_KEY)).limit(1);
  const pedidas = new Set(articleIds);
  const lista = (Array.isArray(row?.value) ? (row.value as Asignacion[]) : []).filter((a) => pedidas.has(a.articleId));
  if (!lista.length) return new Map();
  const personas = await db.select({ id: users.id, nombre: users.name }).from(users).where(inArray(users.id, [...new Set(lista.map((a) => a.editorId))]));
  const nombre = new Map(personas.map((p) => [p.id, p.nombre]));
  // La más reciente manda (una nota reenviada a otro editor muestra al último).
  const porNota = new Map<string, string>();
  for (const a of [...lista].sort((x, y) => x.fecha.localeCompare(y.fecha))) porNota.set(a.articleId, nombre.get(a.editorId) ?? "un editor");
  return porNota;
}

/** Estados en los que una nota enviada sigue pendiente para el editor. */
export const ESTADOS_PENDIENTES = ["borrador", "en_revision"] as const;

/** Cuántas notas enviadas a la persona siguen pendientes (borrador o en revisión): el punto rojo del menú. Si falla, 0. */
export async function contarNotasPendientes(userId: string): Promise<number> {
  try {
    const ids = await notasAsignadasA(userId);
    if (!ids.length) return 0;
    const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(articles).where(and(inArray(articles.id, ids), inArray(articles.status, [...ESTADOS_PENDIENTES])));
    return r?.n ?? 0;
  } catch {
    return 0;
  }
}

/** Marca como abierta la nota enviada a la persona (la primera vez que la abre). Si no le fue enviada, no hace nada. */
export async function marcarAsignacionAbierta(articleId: string, userId: string): Promise<void> {
  await db.execute(sql`update site_settings set value = (
      select jsonb_agg(case when e->>'articleId' = ${articleId} and e->>'editorId' = ${userId} and e->>'abiertaAt' is null
        then e || jsonb_build_object('abiertaAt', ${new Date().toISOString()}::text) else e end)
      from jsonb_array_elements(value) e), updated_at = now()
    where key = ${ASIGNADAS_KEY} and exists (select 1 from jsonb_array_elements(value) e where e->>'articleId' = ${articleId} and e->>'editorId' = ${userId} and e->>'abiertaAt' is null)`);
}
