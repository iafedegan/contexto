/** Mismo nombre aunque cambien tildes, mayúsculas, puntos y comas: «Bogotá D.C.» = «BOGOTA, D.C.». */
export const normaDepartamento = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[.,]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

/** Color de un departamento en un mapa de calor: de la superficie al acento de la plantilla según `v / max` (raíz, para que se noten los pequeños). */
export const colorCalor = (v: number | undefined, max: number) =>
  v === undefined ? "var(--surface-2)" : `color-mix(in oklab, var(--accent) ${Math.round(14 + 78 * Math.sqrt(Math.max(0, v) / (max || 1)))}%, var(--bg-2))`;
