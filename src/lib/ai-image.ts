/** Prefijo del texto alternativo de una portada generada con IA: el sitio lo usa para rotularla bajo la imagen. */
// Constante compartida: el generador de portadas la antepone al texto alternativo y el sitio la reconoce.
export const PREFIJO_IMAGEN_IA = "Imagen generada con IA:";

/** Largo recomendado del texto alternativo: los lectores de pantalla y Google lo leen completo hasta unos 125 caracteres. */
export const MAX_ALT = 125;

/**
 * Texto alternativo de una portada generada con IA: el prefijo que la rotula más la primera frase de la escena, recortado por palabras para que
 * no pase de `max` caracteres (la escena completa pasa de 250 y no sirve como alt).
 */
export function altDeEscena(escena: string, max: number = MAX_ALT): string {
  const limpia = escena.replace(/\s+/g, " ").trim();
  const primera = limpia.split(/(?<=[.!?])\s+/)[0] ?? limpia;
  const cabe = max - PREFIJO_IMAGEN_IA.length - 1;
  let cuerpo = primera;
  if (cuerpo.length > cabe) {
    cuerpo = cuerpo.slice(0, cabe - 1);
    cuerpo = cuerpo.slice(0, Math.max(cuerpo.lastIndexOf(" "), 20)).replace(/[,;:\s]+$/, "") + "…";
  }
  return `${PREFIJO_IMAGEN_IA} ${cuerpo}`;
}

/** Crédito (pie de foto) de una imagen generada con IA, según el modelo que la hizo. */
export const creditoImagenIA = (pro: boolean) => `Imagen generada con inteligencia artificial (${pro ? "Nano Banana Pro, " : ""}Google Gemini) para CONtexto Ganadero.`;
