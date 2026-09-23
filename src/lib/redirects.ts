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

/**
 * Mapa de secciones legadas -> nueva ruta de categoría.
 * Calcado 1:1 del navbar real de contextoganadero.com (9 secciones padre +
 * sus subcategorías); las claves son las rutas tal como existen hoy en el
 * sitio legado. Debe mantenerse en sync con `CHILD_CATS` en
 * src/db/seed-data.ts (misma fuente de verdad, dos formatos).
 */
export const LEGACY_TAXONOMY: Record<string, string> = {
  // Ganadería
  "/sostenible": "/categoria/sostenible",
  "/produccion": "/categoria/produccion",
  "/sistemas-silvopastoriles": "/categoria/sistemas-silvopastoriles",
  "/nutricion": "/categoria/nutricion",
  "/saludanimal": "/categoria/salud-animal",
  "/razas": "/categoria/razas",
  // Sistemas pecuarios
  "/porcicola": "/categoria/porcicola",
  "/equino": "/categoria/equino",
  "/avicola": "/categoria/avicola",
  "/ovinocaprino": "/categoria/ovino-caprino",
  "/otrossistemP": "/categoria/otros-sistemas-pecuarios",
  // Colombia
  "/politica": "/categoria/politica",
  "/gremialidad": "/categoria/gremialidad",
  "/regiones": "/categoria/regiones",
  "/RegionesView": "/categoria/regiones",
  // Economía
  "/nacional": "/categoria/nacional",
  "/internacional": "/categoria/internacional",
  "/IndicadoresView/IndicadorGanadero": "/categoria/precio-del-ganado",
  "/agricultura": "/categoria/agricultura",
  "/agroindustria": "/categoria/agroindustria",
  // Mundo
  "/argentina": "/categoria/argentina",
  "/eeuu": "/categoria/eeuu",
  "/espana": "/categoria/espana",
  "/mexico": "/categoria/mexico",
  "/peru": "/categoria/peru",
  "/otrosmundo": "/categoria/otros-mundo",
  // Tendencias
  "/medioambiente": "/categoria/medioambiente",
  "/gastronomia": "/categoria/gastronomia",
  "/innovacion": "/categoria/innovacion",
  "/mascotas": "/categoria/mascotas",
  "/redessociales": "/categoria/redes-sociales",
  // Opinión
  "/columna": "/categoria/columnas",
  "/columnas": "/categoria/columnas",
  "/editorial": "/categoria/editorial",
  "/blogs": "/categoria/blogs",
  "/BlogsView": "/categoria/blogs",
  "/columnistas": "/categoria/columnistas",
  "/ColumnistasView": "/categoria/columnistas",
  // Agenda
  "/congresos": "/categoria/congresos",
  "/ferias": "/categoria/ferias",
  "/tauromaquia": "/categoria/tauromaquia",
  "/otroseventos": "/categoria/otros-eventos",
  // Especiales
  "/cronica": "/categoria/cronica",
  "/reportaje": "/categoria/reportaje",
  "/entrevistas": "/categoria/entrevistas",
  "/informes": "/categoria/informes",
  "/gobierno-petro": "/categoria/gobierno-petro",
  // Legado previo al MVP (rutas ya retiradas del sitio en vivo, se conservan
  // por si quedan enlaces externos o de buscadores indexados).
  "/economia": "/categoria/nacional",
  "/ganaderia-sostenible": "/categoria/sostenible",
  "/ciencia-y-tecnologia": "/categoria/razas",
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
