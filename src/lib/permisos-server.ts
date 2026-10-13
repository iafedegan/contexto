import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings, type UserRole } from "@/db/schema";
import { efectivo, type Ajustes, type PermisoId } from "@/lib/permisos";

/** Ajustes por persona: `{ [userId]: { [permiso]: boolean } }`, en site_settings. */
export const PERMISOS_KEY = "user_permissions";

// Mapa de ajustes de permisos indexado por id de usuario.
export type MapaAjustes = Record<string, Ajustes>;

/** Una consulta por petición. Si falla (tabla sin migrar…), se usan los del rol. */
export const getAjustes = cache(async (): Promise<MapaAjustes> => {
  try {
    const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, PERMISOS_KEY)).limit(1);
    const v = row?.value;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as MapaAjustes) : {};
  } catch {
    return {};
  }
});

// Permiso efectivo de una persona: el que da su rol más el ajuste individual que haya fijado un administrador.
export async function tienePermiso(userId: string, role: UserRole, id: PermisoId): Promise<boolean> {
  return efectivo(role, (await getAjustes())[userId], id);
}

/** Plazos de gracia del segundo factor por persona: `{ [userId]: fecha ISO }`, en site_settings. */
export const PLAZO_2FA_KEY = "plazo_2fa";

/** Una consulta por petición; si falla, no hay plazos (la exigencia normal se mantiene). */
export const getPlazos2fa = cache(async (): Promise<Record<string, string>> => {
  try {
    const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, PLAZO_2FA_KEY)).limit(1);
    const v = row?.value;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
});
