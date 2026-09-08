/**
 * Redirecciones 301 permanentes entre la taxonomía antigua y la nueva.
 * Objetivo: no perder posicionamiento acumulado. Seguimiento en Search Console.
 *
 * Dos capas:
 *  1. Prefijos de taxonomía legada -> se resuelven en middleware (sin DB, en borde).
 *  2. Casos uno-a-uno -> tabla `redirects` en Postgres (resueltos en not-found).
 *
 * Las URLs del ARCHIVO histórico (artículos individuales del sistema legado)
 * NUNCA se redirigen aquí: permanecen en su dominio/ruta original intactas.
 */

/** Mapa de secciones legadas -> nueva ruta de categoría. */
export const LEGACY_TAXONOMY: Record<string, string> = {
  "/economia": "/categoria/economia-y-mercados",
  "/ganaderia-sostenible": "/categoria/sostenibilidad",
  "/regiones": "/categoria/regiones",
  "/columna": "/categoria/opinion",
  "/columnistas": "/categoria/opinion",
  "/politica": "/categoria/politica-gremial",
  "/agricultura": "/categoria/agricultura",
  "/ciencia-y-tecnologia": "/categoria/ciencia-y-tecnologia",
  "/blogs": "/categoria/opinion",
};

/**
 * Devuelve la ruta destino si `pathname` cae bajo una sección legada conocida.
 * Preserva el resto del path como segmento informativo (se pierde el subnivel,
 * pero la categoría destino es la correcta y evita un 404).
 */
export function resolveLegacyTaxonomy(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, "").toLowerCase() || "/";
  for (const [legacyPrefix, target] of Object.entries(LEGACY_TAXONOMY)) {
    if (normalized === legacyPrefix || normalized.startsWith(legacyPrefix + "/")) {
      return target;
    }
  }
  return null;
}

/** Rutas legadas de sistema que deben responder pero no existen en el portal nuevo. */
export const LEGACY_SYSTEM_REDIRECTS: Record<string, string> = {
  "/rss": "/feed.xml",
  "/feed": "/feed.xml",
  "/sitemap": "/sitemap.xml",
  "/buscador": "/buscar",
  "/noticias": "/",
};
