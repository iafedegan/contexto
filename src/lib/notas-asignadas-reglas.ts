/**
 * Reglas puras de a quién se le puede enviar una nota desde el asistente (paso «Enviar»). Sin base de datos, para poder probarlas.
 *
 * - Quien puede enviar (redactor, editor o administrador) ve a TODAS las personas activas registradas en la plataforma, menos a sí misma:
 *   así una nota se puede devolver a quien la escribió o pasar a cualquier especialista.
 */
export type Destino = { id: string; nombre: string; rol: string };

/** Quién envía una nota desde el asistente. */
export const puedeEnviarNota = (role: string) => role === "administrador" || role === "redactor" || role === "editor";

/** Quién puede elegir a cualquier persona activa (y no solo a un editor). */
export const envioLibre = (role: string) => puedeEnviarNota(role);

/** ¿Puede `role` mandarle una nota a alguien con el rol `rolDestino`? */
export function destinoPermitido(role: string, rolDestino: string): boolean {
  void rolDestino;
  return puedeEnviarNota(role);
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
