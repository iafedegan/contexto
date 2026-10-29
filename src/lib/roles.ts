import { PERMISOS, PERMISO_IDS, porDefecto, type Ajustes, type PermisoId } from "@/lib/permisos";
import type { UserRole } from "@/db/schema";

/**
 * Roles propios del sitio, además de los cuatro de siempre. Un rol propio es una plantilla: parte de un rol base (redactor, diseñador
 * o editor) y enciende o apaga permisos sobre lo que ese rol da. Al asignárselo a una persona se aplica sobre sus ajustes; al editar el
 * rol se reaplica a quienes lo tienen. El administrador no se puede replicar: siempre tiene todo.
 */
export const ROLES_PROPIOS_KEY = "roles_personalizados";
// Quién tiene qué rol propio: `{ [userId]: idDelRol }`.
export const ROLES_ASIGNADOS_KEY = "roles_asignados";

// Roles sobre los que se puede basar uno propio.
export const ROLES_BASE: UserRole[] = ["redactor", "disenador", "editor"];

// Rol propio guardado en `site_settings`.
export type RolPropio = { id: string; nombre: string; base: UserRole; permisos: Partial<Record<PermisoId, boolean>> };

// Etiqueta legible de un rol incorporado.
export const nombreRol = (r: UserRole) => (r === "disenador" ? "diseñador" : r);

// Valida lo guardado (o lo que llega del navegador) y devuelve solo roles bien formados.
export function sanitizeRolesPropios(input: unknown): RolPropio[] {
  if (!Array.isArray(input)) return [];
  const vistos = new Set<string>();
  const out: RolPropio[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === "string" && /^[a-z0-9-]{3,40}$/.test(r.id) ? r.id : null;
    const nombre = typeof r.nombre === "string" ? r.nombre.trim().slice(0, 40) : "";
    const base = ROLES_BASE.find((b) => b === r.base);
    if (!id || !nombre || !base || vistos.has(id)) continue;
    vistos.add(id);
    const permisos: RolPropio["permisos"] = {};
    if (r.permisos && typeof r.permisos === "object") {
      for (const p of PERMISO_IDS) {
        const v = (r.permisos as Record<string, unknown>)[p];
        if (typeof v === "boolean") permisos[p as PermisoId] = v;
      }
    }
    out.push({ id, nombre, base, permisos });
  }
  return out;
}

// Permiso que da un rol propio: lo que fija la plantilla o, si no, lo del rol base.
export const permisoDeRol = (rol: RolPropio, id: PermisoId) => rol.permisos[id] ?? porDefecto(rol.base, id);

// Ajustes individuales que hacen falta para que una persona tenga los permisos de un rol propio (solo la diferencia con su rol base).
export function ajustesDeRol(rol: RolPropio, previos: Ajustes | undefined): Ajustes | undefined {
  const out: Record<string, boolean> = {};
  // El segundo factor es de la persona, no del rol: se conserva.
  if (previos && typeof previos.exigir_2fa === "boolean") out.exigir_2fa = previos.exigir_2fa;
  for (const p of PERMISOS) {
    const v = permisoDeRol(rol, p.id);
    if (v !== porDefecto(rol.base, p.id)) out[p.id] = v;
  }
  return Object.keys(out).length ? (out as Ajustes) : undefined;
}
