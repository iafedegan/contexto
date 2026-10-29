import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { ROLES_ASIGNADOS_KEY, ROLES_PROPIOS_KEY, sanitizeRolesPropios, type RolPropio } from "@/lib/roles";

// Lee un valor de `site_settings` por clave (o undefined).
async function leer(key: string): Promise<unknown> {
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
  return row?.value;
}

/** Roles propios del sitio. Una consulta por petición; si falla, no hay ninguno. */
export const getRolesPropios = cache(async (): Promise<RolPropio[]> => {
  try {
    return sanitizeRolesPropios(await leer(ROLES_PROPIOS_KEY));
  } catch {
    return [];
  }
});

/** Qué rol propio tiene cada persona: `{ [userId]: idDelRol }`. */
export const getRolesAsignados = cache(async (): Promise<Record<string, string>> => {
  try {
    const v = await leer(ROLES_ASIGNADOS_KEY);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
});
