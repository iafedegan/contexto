/**
 * Validadores pequeños que usan los formularios, la API pública y la limpieza de los estilos del editor. Antes
 * cada archivo tenía su propia copia. Sin `server-only`: sirven en el servidor y en el navegador.
 */

/** Formato básico de una dirección de correo. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Color hexadecimal de 3 o 6 dígitos (#rgb o #rrggbb). */
export const HEX_COLOR = /^#(?:[\da-f]{3}|[\da-f]{6})$/i;

/** Color hexadecimal de exactamente 6 dígitos (#rrggbb). */
export const HEX6 = /^#[\da-f]{6}$/i;

/** Devuelve el color si es #rgb o #rrggbb; si no, undefined. */
export const colorHex = (v: unknown) => (typeof v === "string" && HEX_COLOR.test(v) ? v : undefined);

/**
 * Valida que `v` sea un número finito y lo acota a [min, max], redondeado a `decimales` cifras (0 = entero).
 * Devuelve undefined si no es un número.
 */
export function acotar(v: unknown, min: number, max: number, decimales = 0): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  const f = 10 ** decimales;
  return Math.min(max, Math.max(min, Math.round(v * f) / f));
}
