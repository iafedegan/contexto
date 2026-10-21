import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";

/**
 * Con qué IA le gusta más redactar a cada persona. Es un solo registro en `site_settings` ({ [userId]: "proveedor:modelo" }); se escribe con un
 * UPSERT atómico (dos personas eligiendo a la vez no se pisan) y se lee una sola vez al abrir el asistente de redacción.
 */
export const FAVORITO_KEY = "ai_modelo_favorito";

/** El modelo favorito de esta persona, o `null` si nunca eligió uno (o la lectura falla: no es crítico). */
export async function getModeloFavorito(userId: string): Promise<string | null> {
  try {
    const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, FAVORITO_KEY)).limit(1);
    const v = row?.value;
    const ref = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>)[userId] : null;
    return typeof ref === "string" && ref ? ref : null;
  } catch {
    return null;
  }
}

/** Guarda el modelo favorito de esta persona. */
export async function setModeloFavorito(userId: string, ref: string): Promise<void> {
  await db.execute(sql`
    insert into site_settings (key, value) values (${FAVORITO_KEY}, jsonb_build_object(${userId}::text, ${ref}::text))
    on conflict (key) do update set
      value = jsonb_set(site_settings.value, array[${userId}::text], to_jsonb(${ref}::text)),
      updated_at = now()
  `);
}
