import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings, users } from "@/db/schema";

/**
 * Notas que se le dejan a un editor: las preescritas en «Notas para editores» y las que un redactor o un administrador le envía desde el
 * asistente de redacción. Se anotan en `site_settings` (una lista; sin migración). Una nota enviada a un editor cuenta como SUYA para abrirla,
 * revisarla y publicarla (ver `propiedad-notas.ts`), aunque la haya escrito otra persona.
 */
export const ASIGNADAS_KEY = "notas_asignadas";

export type Asignacion = { articleId: string; editorId: string; porId: string; mensaje: string; fecha: string };

/** Solo administradores y redactores envían notas a un editor desde el asistente. */
export const puedeEnviarAEditor = (role: string) => role === "administrador" || role === "redactor";

/** Editores activos a los que se les puede enviar una nota, por nombre. */
export async function editoresActivos(): Promise<{ id: string; nombre: string }[]> {
  const filas = await db.select({ id: users.id, nombre: users.name }).from(users).where(and(eq(users.active, true), eq(users.role, "editor")));
  return filas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/** ¿Es una persona con rol de editor y activa? */
export async function esEditorActivo(id: string): Promise<{ id: string; nombre: string } | null> {
  const [e] = await db.select({ id: users.id, nombre: users.name }).from(users).where(and(eq(users.id, id), eq(users.active, true), eq(users.role, "editor"))).limit(1);
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
