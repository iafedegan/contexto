/**
 * Utilidades de color para el correo del boletín (sin `server-only`: también las usa el panel). Los correos no admiten `color-mix`
 * ni variables, así que los tonos derivados (tintes, oscuros, texto legible sobre un fondo) se calculan aquí.
 */

// Componentes [r, g, b] de un color #rrggbb.
const aRgb = (hex: string): [number, number, number] => {
  const h = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "000000";
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const aHex = (rgb: [number, number, number]) => `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;

/** Mezcla `a` con `b`: `pct` % de `a` y el resto de `b`. */
export function mezclar(a: string, b: string, pct: number): string {
  const x = aRgb(a);
  const y = aRgb(b);
  const t = Math.max(0, Math.min(100, pct)) / 100;
  return aHex([x[0] * t + y[0] * (1 - t), x[1] * t + y[1] * (1 - t), x[2] * t + y[2] * (1 - t)]);
}

/** Luminosidad percibida de 0 (negro) a 1 (blanco). */
export function luminosidad(hex: string): number {
  const [r, g, b] = aRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Color de texto legible (casi negro o blanco) sobre un fondo dado. */
export const textoSobre = (fondo: string) => (luminosidad(fondo) > 0.42 ? "#111827" : "#ffffff");

/** Tono oscuro profundo derivado de un color (para paneles que contrastan con el acento). */
export const profundo = (hex: string) => mezclar(hex, "#000000", 38);
