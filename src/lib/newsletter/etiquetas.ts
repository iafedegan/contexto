/**
 * Etiquetas de suscriptores: grupos que decide el equipo («Aliados», «Prensa», «Ganaderos de Antioquia»…) para enviar una edición solo a
 * quienes las llevan. Se guardan en `newsletter_subscribers.tags` (lista de textos). Sin `server-only`: las usan el servidor y el panel.
 */

/** Cuántas etiquetas puede llevar una persona. */
export const MAX_ETIQUETAS_POR_SUSCRIPTOR = 20;
/** Largo máximo del nombre de una etiqueta. */
export const MAX_LARGO_ETIQUETA = 40;

/** Nombre de una etiqueta limpio: sin caracteres de control, sin espacios de más y de hasta 40 caracteres. Vacío = no es válida. */
export function limpiarEtiqueta(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_LARGO_ETIQUETA).trim();
}

/** Clave con que se comparan: «Aliados», «aliados» y « Alíados » son la misma etiqueta. */
export const claveEtiqueta = (s: string): string => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Lista de etiquetas válida: limpias, sin repetidas (aunque cambien en mayúsculas o tildes; se queda la primera) y no más de
 * `MAX_ETIQUETAS_POR_SUSCRIPTOR`. Lo que llega de la red nunca se guarda sin pasar por aquí.
 */
export function sanitizarEtiquetas(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const vistas = new Set<string>();
  const salida: string[] = [];
  for (const x of v) {
    const nombre = limpiarEtiqueta(x);
    const clave = claveEtiqueta(nombre);
    if (!clave || vistas.has(clave)) continue;
    vistas.add(clave);
    salida.push(nombre);
    if (salida.length >= MAX_ETIQUETAS_POR_SUSCRIPTOR) break;
  }
  return salida;
}

/**
 * Pone una etiqueta a una lista (sin repetirla). Si ya hay otra igual salvo mayúsculas o tildes, no se añade. Devuelve la lista nueva y
 * si cambió; `lleno` = no cabía por el máximo de etiquetas.
 */
export function agregarEtiqueta(actuales: string[], nombre: string): { etiquetas: string[]; cambio: boolean; lleno: boolean } {
  const n = limpiarEtiqueta(nombre);
  const clave = claveEtiqueta(n);
  if (!clave || actuales.some((x) => claveEtiqueta(x) === clave)) return { etiquetas: actuales, cambio: false, lleno: false };
  if (actuales.length >= MAX_ETIQUETAS_POR_SUSCRIPTOR) return { etiquetas: actuales, cambio: false, lleno: true };
  return { etiquetas: [...actuales, n], cambio: true, lleno: false };
}

/** Quita una etiqueta de una lista (la compara sin importar mayúsculas ni tildes). */
export function quitarEtiqueta(actuales: string[], nombre: string): { etiquetas: string[]; cambio: boolean } {
  const clave = claveEtiqueta(nombre);
  const etiquetas = actuales.filter((x) => claveEtiqueta(x) !== clave);
  return { etiquetas, cambio: etiquetas.length !== actuales.length };
}
