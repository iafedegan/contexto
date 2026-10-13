import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { ESTILO_VACIO, bloqueEstilo, estiloClave, type EstiloEscritura } from "@/lib/ai/estilo-tipos";

/** Lo guardado del estilo de una persona (vacío si no hay nada o la lectura falla: nunca rompe la redacción). */
export async function getEstilo(userId: string): Promise<EstiloEscritura> {
  try {
    const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, estiloClave(userId))).limit(1);
    const v = row?.value as Partial<EstiloEscritura> | undefined;
    if (!v || typeof v !== "object") return { ...ESTILO_VACIO };
    return { fuentes: Array.isArray(v.fuentes) ? v.fuentes : [], diagnostico: v.diagnostico ?? null, activo: v.activo !== false };
  } catch {
    return { ...ESTILO_VACIO };
  }
}

/** Guarda el estilo de una persona. */
export async function guardarEstilo(userId: string, e: EstiloEscritura): Promise<void> {
  await db
    .insert(siteSettings)
    .values({ key: estiloClave(userId), value: e })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: e, updatedAt: sql`now()` } });
}

/** Borra el estilo de una persona. */
export async function borrarEstilo(userId: string): Promise<void> {
  await db.delete(siteSettings).where(eq(siteSettings.key, estiloClave(userId)));
}

/** El `system` de redacción con el estilo de la persona añadido, si lo tiene activo. */
export async function sistemaConEstilo(base: string, userId: string): Promise<string> {
  const bloque = bloqueEstilo(await getEstilo(userId));
  return bloque ? `${base}\n\n${bloque}` : base;
}
