import type { UserRole } from "@/db/schema";

/**
 * Permisos por persona. Cada rol trae unos por defecto y un administrador
 * puede encender o apagar casillas por persona (un redactor al que se le
 * confía el newsletter, un editor al que se le quita publicar…).
 *
 * Lo que NO es una casilla, a propósito: cambiar roles, crear y eliminar
 * cuentas. Si fuera delegable, un editor con ese permiso podría ascenderse a
 * administrador. Eso, y los ajustes del sitio, siguen siendo del administrador,
 * que siempre tiene todos los permisos y no se puede restringir.
 */

export const RANGO: Record<UserRole, number> = { redactor: 1, editor: 2, administrador: 3 };

export const PERMISOS = [
  { id: "articulos", label: "Redactar artículos", hint: "Crear y editar artículos y mandarlos a revisión", min: "redactor" },
  { id: "publicar", label: "Publicar y eliminar artículos", hint: "Publicar, programar, despublicar y borrar", min: "editor" },
  { id: "borradores_ia", label: "Borradores de IA", hint: "Revisar, aprobar y descartar lo que propone la IA", min: "editor" },
  { id: "avisos", label: "Avisos", hint: "Crear y retirar avisos del sitio", min: "editor" },
  { id: "mensajes", label: "Mensajes recibidos", hint: "Leer contacto y solicitudes de pauta", min: "editor" },
  { id: "portada", label: "Portada, plantillas y secciones", hint: "Diseño del sitio, orden y menú de secciones", min: "editor" },
  { id: "newsletter", label: "Newsletter", hint: "Ediciones, envíos y suscriptores", min: "editor" },
  { id: "api", label: "API pública", hint: "Claves para terceros", min: "administrador" },
] as const satisfies readonly { id: string; label: string; hint: string; min: UserRole }[];

export type PermisoId = (typeof PERMISOS)[number]["id"];
export const PERMISO_IDS: readonly string[] = PERMISOS.map((p) => p.id);
export type Ajustes = Partial<Record<PermisoId, boolean>>;

/** Lo que el rol da sin ajustes. */
export function porDefecto(role: UserRole, id: PermisoId): boolean {
  const p = PERMISOS.find((x) => x.id === id)!;
  return RANGO[role] >= RANGO[p.min];
}

/** Permiso efectivo: el administrador siempre; el resto, rol + ajuste de la persona. */
export function efectivo(role: UserRole, ajustes: Ajustes | undefined, id: PermisoId): boolean {
  if (role === "administrador") return true;
  const a = ajustes?.[id];
  return typeof a === "boolean" ? a : porDefecto(role, id);
}

export function efectivos(role: UserRole, ajustes: Ajustes | undefined): PermisoId[] {
  return PERMISOS.filter((p) => efectivo(role, ajustes, p.id)).map((p) => p.id);
}
