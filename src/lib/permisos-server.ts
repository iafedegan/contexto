import "server-only";
import { cache } from "react";
import { db } from "@/db";
import { user2faGrace, userPermissionOverrides, type UserRole } from "@/db/schema";
import { efectivo, type Ajustes, type PermisoId } from "@/lib/permisos";

// Mapa de ajustes de permisos indexado por id de usuario.
export type MapaAjustes = Record<string, Ajustes>;

/** Ajustes por persona (tabla `user_permission_overrides`): `{ [userId]: { [permiso]: boolean } }`. Una consulta por petición. Si falla (tabla sin migrar…), se usan los del rol. */
export const getAjustes = cache(async (): Promise<MapaAjustes> => {
  try {
    const mapa: MapaAjustes = {};
    for (const f of await db.select().from(userPermissionOverrides)) (mapa[f.userId] ??= {})[f.permiso as keyof Ajustes] = f.valor;
    return mapa;
  } catch {
    return {};
  }
});

// Permiso efectivo de una persona: el que da su rol más el ajuste individual que haya fijado un administrador.
export async function tienePermiso(userId: string, role: UserRole, id: PermisoId): Promise<boolean> {
  return efectivo(role, (await getAjustes())[userId], id);
}

/** Plazos de gracia del segundo factor por persona (tabla `user_2fa_grace`): `{ [userId]: fecha ISO }`. Una consulta por petición; si falla, no hay plazos (la exigencia normal se mantiene). */
export const getPlazos2fa = cache(async (): Promise<Record<string, string>> => {
  try {
    return Object.fromEntries((await db.select().from(user2faGrace)).map((f) => [f.userId, f.until.toISOString()]));
  } catch {
    return {};
  }
});
