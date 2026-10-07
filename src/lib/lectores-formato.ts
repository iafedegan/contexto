/** Formatos del centro de análisis: duraciones, horas del día, días de la semana y variaciones. Puros y probados. */
export const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;
export const DIAS_LARGOS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"] as const;
/** Postgres cuenta el domingo como 0; el panel empieza la semana el lunes. */
export const indiceDia = (dow: number) => (dow + 6) % 7;

/** 72 → «1 min 12 s»; 45 → «45 s»; 3720 → «1 h 2 min»; 0 → «0 s». */
export function duracion(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ""}`;
  return `${Math.floor(s / 3600)} h${Math.floor((s % 3600) / 60) ? ` ${Math.floor((s % 3600) / 60)} min` : ""}`;
}

/** 0 → «12 a. m.»; 8 → «8 a. m.»; 13 → «1 p. m.». */
export const horaEtiqueta = (h: number) => `${h % 12 || 12} ${h < 12 ? "a. m." : "p. m."}`;
/** 8 → «8 a 9 a. m.»; 11 → «11 a. m. a 12 p. m.»: la franja de una hora. */
export const franja = (h: number) => `${horaEtiqueta(h)} a ${horaEtiqueta((h + 1) % 24)}`;

/** Variación porcentual de `actual` frente a `previo`; `null` si no hay con qué comparar (previo en 0). */
export const variacionPct = (actual: number, previo: number): number | null => (previo > 0 ? ((actual - previo) / previo) * 100 : null);
/** Parte de `n` sobre `total`, en porcentaje (0 si no hay total). */
export const parte = (n: number, total: number) => (total > 0 ? (n / total) * 100 : 0);
