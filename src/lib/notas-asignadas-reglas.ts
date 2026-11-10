/**
 * Reglas puras de a quién se le puede enviar una nota desde el asistente (paso «Enviar»). Sin base de datos, para poder probarlas.
 *
 * - Un redactor envía a un editor (los administradores también hacen de editores).
 * - Un editor o un administrador envía a un especialista: cualquier persona activa de la plataforma.
 */
export type Destino = { id: string; nombre: string; rol: string };

/** Quién envía una nota desde el asistente. */
export const puedeEnviarNota = (role: string) => role === "administrador" || role === "redactor" || role === "editor";

/** Quién puede elegir a cualquier persona activa (y no solo a un editor). */
export const envioLibre = (role: string) => role === "editor" || role === "administrador";

/** ¿Puede `role` mandarle una nota a alguien con el rol `rolDestino`? */
export function destinoPermitido(role: string, rolDestino: string): boolean {
  if (!puedeEnviarNota(role)) return false;
  if (envioLibre(role)) return true;
  return rolDestino === "editor" || rolDestino === "administrador";
}

/** De las personas activas, las que `role` puede elegir, sin quien envía y por nombre. */
export function destinosPara(role: string, userId: string, personas: Destino[]): Destino[] {
  return personas
    .filter((p) => p.id !== userId && destinoPermitido(role, p.rol))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

const ETIQUETA: Record<string, string> = { redactor: "redactor", disenador: "diseñador", editor: "editor", administrador: "administrador" };
/** Rol en palabras, para la lista de destinatarios. */
export const etiquetaRol = (rol: string) => ETIQUETA[rol] ?? rol;
