import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { articleActivity } from "@/db/schema";
import type { TipoActividad } from "@/lib/actividad-reglas";

/**
 * Anota lo que hizo una persona en una nota (una fila por nota, persona, acción y día de Colombia; si ya existe, suma veces y palabras).
 * Nunca rompe lo que se está haciendo: si falla (p. ej. la tabla aún no existe), solo se avisa en el registro.
 */
export async function registrarActividad(articleId: string | null | undefined, userId: string | null | undefined, tipo: TipoActividad, palabras = 0): Promise<void> {
  if (!articleId || !userId) return;
  try {
    await db
      .insert(articleActivity)
      .values({ articleId, userId, tipo, dia: sql`(now() at time zone 'America/Bogota')::date`, palabras: Math.max(0, Math.round(palabras)) })
      .onConflictDoUpdate({
        target: [articleActivity.articleId, articleActivity.userId, articleActivity.tipo, articleActivity.dia],
        set: { veces: sql`${articleActivity.veces} + 1`, palabras: sql`${articleActivity.palabras} + excluded.palabras`, ultima: sql`now()` },
      });
  } catch (e) {
    console.warn("registrarActividad:", (e as Error)?.message ?? e);
  }
}
