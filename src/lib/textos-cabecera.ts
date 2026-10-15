/**
 * Textos de la cabecera que se editan en /panel/portada (Cabecera › Textos): el título (nombre del sitio) y el subtítulo (lema) que salen bajo
 * el logo, y si se muestra la fecha. Son un ajuste de PRESENTACIÓN de la cabecera, con borrador y publicación como el resto del diseño; el nombre y el
 * lema del sitio (metadatos, correos, pie) siguen en /panel/configuracion. Sin `server-only`: lo usa el editor (cliente).
 */
export type TextosCabecera = {
  /** Título de la cabecera. Vacío o ausente = el nombre del sitio. */
  nombre?: string;
  /** Subtítulo. Ausente = el lema del sitio; texto vacío = sin subtítulo. */
  lema?: string;
  /** `false` oculta la fecha de hoy bajo el subtítulo. */
  fecha?: boolean;
};

export const MAX_NOMBRE = 60;
export const MAX_LEMA = 120;

// Texto en una sola línea, sin etiquetas, recortado.
const limpio = (v: unknown, max: number): string | undefined =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : undefined;

/** Valida lo que llegue del navegador o de la base; `undefined` si no hay ningún ajuste. */
export function sanitizeTextos(input: unknown): TextosCabecera | undefined {
  if (!input || typeof input !== "object") return undefined;
  const t = input as Record<string, unknown>;
  const out: TextosCabecera = {};
  const nombre = limpio(t.nombre, MAX_NOMBRE);
  if (nombre) out.nombre = nombre;
  const lema = limpio(t.lema, MAX_LEMA);
  if (lema !== undefined) out.lema = lema; // el vacío se conserva: significa «sin subtítulo»
  if (t.fecha === false) out.fecha = false;
  return Object.keys(out).length ? out : undefined;
}

/** La identidad que pinta la cabecera: la del sitio con los textos del editor encima. */
export function conTextos<T extends { name: string; tagline: string }>(identity: T, textos?: TextosCabecera): T & { fecha?: boolean; sinLema?: boolean } {
  if (!textos) return identity;
  return {
    ...identity,
    name: textos.nombre || identity.name,
    tagline: textos.lema !== undefined ? textos.lema : identity.tagline,
    ...(textos.fecha === false ? { fecha: false } : {}),
    ...(textos.lema === "" ? { sinLema: true } : {}),
  };
}
