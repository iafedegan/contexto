/**
 * Formato propio de algunas secciones (Anexo Funcional, plantillas de Especiales, TV y Radio): en vez de la cuadrícula de la plantilla
 * del sitio, esas secciones se muestran como lo que son. Se decide por la sección o por su sección madre, así una subsección nueva
 * (p. ej. «Video», hija de «TV») hereda el formato sin configurar nada.
 */
export type FormatoSeccion = "tv" | "radio" | "especiales";

const POR_SLUG: Record<string, FormatoSeccion> = {
  tv: "tv",
  video: "tv",
  videos: "tv",
  radio: "radio",
  audio: "radio",
  podcast: "radio",
  podcasts: "radio",
  especiales: "especiales",
  especial: "especiales",
  galeria: "especiales",
};

/** Formato de la sección `slug` (o, si no tiene uno propio, el de su madre); `null` = la cuadrícula normal de la plantilla. */
export function formatoDeSeccion(slug: string, padre?: string | null): FormatoSeccion | null {
  return POR_SLUG[slug] ?? (padre ? (POR_SLUG[padre] ?? null) : null);
}
