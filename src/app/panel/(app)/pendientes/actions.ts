"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { editorialSlots } from "@/db/schema";
import { auth } from "@/lib/auth";
import { soltarAsignacion } from "@/lib/notas-asignadas";
import { agregarComentario } from "@/lib/comentarios-notas";
import { marcarVistas, misPendientes } from "./consultas";

/** Da por vistas las tareas nuevas de quien tiene la sesión (abrió «Mis pendientes» o cerró el aviso). */
export async function marcarPendientesVistos(): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  await marcarVistas(session.user.id);
}

export type ResultadoDescartar = { ok: true; mensaje: string } | { ok: false; error: string };

/**
 * Quita un pendiente de «Mis pendientes» explicando por qué (el motivo es obligatorio y queda a la vista del equipo).
 *  - Pieza del grupo de redacción: pasa a «omitida» con el motivo en su registro.
 *  - Nota que le enviaron: se suelta la asignación y el motivo queda como comentario de la nota.
 * Las notas propias no se quitan desde aquí. Solo la persona a quien le toca (o un administrador, en las notas) puede hacerlo.
 */
export async function descartarPendiente(clave: string, motivo: string): Promise<ResultadoDescartar> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sesión expirada, vuelve a entrar." };
  const razon = String(motivo ?? "").replace(/\s+/g, " ").trim();
  if (razon.length < 10) return { ok: false, error: "Explica la razón (al menos 10 letras): así el equipo sabe por qué se quitó." };
  if (razon.length > 600) return { ok: false, error: "La razón es muy larga (máximo 600 letras)." };
  const m = /^(pieza|nota)-([0-9a-f-]{36})$/.exec(String(clave ?? ""));
  if (!m) return { ok: false, error: "No se reconoce ese pendiente." };
  const userId = session.user.id;
  const quien = session.user.name ?? "Una persona del equipo";

  if (m[1] === "pieza") {
    const mia = (await misPendientes(userId)).find((p) => p.id === m[2]);
    if (!mia) return { ok: false, error: "Esa pieza ya no está en tus pendientes." };
    await db
      .update(editorialSlots)
      .set({ status: "omitida", error: `Descartada por ${quien}: ${razon}`, updatedAt: sql`now()` })
      .where(eq(editorialSlots.id, mia.id));
    revalidatePath("/panel/pendientes");
    revalidatePath("/panel/consejo");
    revalidatePath("/panel", "layout");
    return { ok: true, mensaje: "Pieza quitada de tus pendientes. El motivo quedó anotado en el consejo." };
  }

  const r = await soltarAsignacion(m[2], userId, session.user.role);
  if (!r.ok) return { ok: false, error: r.message };
  await agregarComentario(m[2], userId, `Quité esta nota de mis pendientes. Motivo: ${razon}`).catch(() => {});
  revalidatePath("/panel/pendientes");
  revalidatePath("/panel/asignaciones");
  revalidatePath("/panel", "layout");
  return { ok: true, mensaje: "Nota quitada de tus pendientes. El motivo quedó como comentario de la nota." };
}
