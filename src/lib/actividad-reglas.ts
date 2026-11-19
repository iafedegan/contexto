/** Reglas puras del registro de actividad en las notas (sin base), para probarlas. */
export type TipoActividad = "creo" | "recibio" | "reviso" | "edito" | "publico" | "programo" | "envio" | "devolvio";

const palabras = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/**
 * Cuántas palabras cambió una edición: las que se quitaron más las que se agregaron (se comparan como bolsas de palabras, así mover un párrafo
 * no cuenta como reescribirlo). Es una medida de cuánto intervino la persona, no un diff exacto.
 */
export function palabrasCambiadas(antes: string, despues: string): number {
  const cuenta = new Map<string, number>();
  for (const w of palabras(antes)) cuenta.set(w, (cuenta.get(w) ?? 0) + 1);
  let agregadas = 0;
  for (const w of palabras(despues)) {
    const n = cuenta.get(w) ?? 0;
    if (n > 0) cuenta.set(w, n - 1);
    else agregadas += 1;
  }
  let quitadas = 0;
  for (const n of cuenta.values()) quitadas += n;
  return agregadas + quitadas;
}

/** Con cuántas palabras cambiadas una nota recibida cuenta como «intervenida» y no solo «revisada» (corregir una coma o una tilde no es intervenir). */
export const UMBRAL_INTERVENCION = 15;

/** Qué hizo una persona con una nota que le enviaron, según su actividad. */
export function papelEnNota(a: { recibio: boolean; reviso: boolean; palabras: number }): "intervino" | "reviso" | "sin-abrir" | null {
  if (!a.recibio) return null;
  if (a.palabras >= UMBRAL_INTERVENCION) return "intervino";
  if (a.reviso || a.palabras > 0) return "reviso";
  return "sin-abrir";
}
