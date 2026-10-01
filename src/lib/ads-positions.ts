/**
 * Posiciones de publicidad del sitio (sin "server-only": las usa también el
 * editor del panel). El tamaño es una propiedad de la posición, no de cada
 * creatividad (§9 del Anexo comercial).
 */
export const AD_ZONE_SPECS = {
  /** Leaderboard bajo el menú principal de la portada. */
  home_top: { width: 728, height: 90, label: "Portada — banner de arriba (728×90)", where: "Portada, arriba del todo" },
  /** Billboard entre la noticia destacada y la grilla. */
  home_billboard: { width: 970, height: 250, label: "Portada — banner grande bajo las noticias principales (970×250)", where: "Portada, debajo de las noticias principales" },
  /** Leaderboard al final de la portada. */
  home_bottom: { width: 728, height: 90, label: "Portada — banner de abajo (728×90)", where: "Portada, al final del contenido" },
  /** Barra lateral, parte superior (above the fold). */
  sidebar_top: { width: 300, height: 250, label: "Barra lateral — arriba (300×250)", where: "Barra lateral de la portada, arriba" },
  /** Barra lateral, debajo de las redes. */
  sidebar_bottom: { width: 300, height: 250, label: "Barra lateral — abajo (300×250)", where: "Barra lateral de la portada, abajo" },
  /** Barra lateral, media página con comportamiento fijo al hacer scroll. */
  sidebar_sticky: { width: 300, height: 600, label: "Barra lateral — banner alto que acompaña al bajar (300×600)", where: "Barra lateral de la portada, fija al bajar" },
  /** Antes del texto de la nota. */
  article_top: { width: 728, height: 90, label: "Nota — antes del texto (728×90)", where: "Notas, antes del texto" },
  /** Rectángulo del artículo, tras el texto. */
  article_sidebar: { width: 300, height: 250, label: "Nota — cuadro tras el texto (300×250)", where: "Notas, después del texto" },
  /** Arriba de la lista de notas de cada sección. */
  section_top: { width: 728, height: 90, label: "Sección — sobre la lista (728×90)", where: "Secciones, sobre la lista de notas" },
  /** Debajo de la lista de notas de cada sección. */
  section_bottom: { width: 728, height: 90, label: "Sección — bajo la lista (728×90)", where: "Secciones, bajo la lista de notas" },
  /** Leaderboard antes del pie, en todo el sitio. */
  footer: { width: 728, height: 90, label: "Pie — banner antes del pie (728×90)", where: "Todo el sitio, antes del pie" },
} as const;

export type AdPosition = keyof typeof AD_ZONE_SPECS;
/** Alias histórico. */
export type AdZoneKey = AdPosition;

/** Posición a la que pertenece una clave (`home_top__2` → `home_top`). */
export function positionOf(key: string): AdPosition | null {
  const base = key.split("__")[0];
  return base in AD_ZONE_SPECS ? (base as AdPosition) : null;
}

/** Número de orden de una clave: la principal es 1; `__2` → 2. */
export function suffixOf(key: string): number {
  const n = Number(key.split("__")[1]);
  return Number.isInteger(n) && n > 1 ? n : 1;
}
