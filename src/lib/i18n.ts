/**
 * Internacionalización de la INTERFAZ.
 *
 * El contenido periodístico permanece en español: traducirlo a máquina y
 * publicarlo sin revisión iría contra la política editorial del medio. Lo que
 * se traduce es el cromo del sitio (navegación, etiquetas, pies, formularios).
 *
 * Por eso las rutas `/en/*` llevan `noindex` y su canonical apunta a la URL en
 * español: son la MISMA nota con la interfaz en otro idioma, no una versión
 * traducida. Marcarlas como alternativa `hreflang` sería decirle a Google que
 * existe contenido en inglés que no existe.
 */

export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";

export const LOCALE_LABEL: Record<Locale, string> = { es: "Español", en: "English" };
export const LOCALE_SHORT: Record<Locale, string> = { es: "ES", en: "EN" };
/** Idioma real del documento (el contenido sigue siendo español). */
export const HTML_LANG: Record<Locale, string> = { es: "es-CO", en: "es-CO" };

type Dict = Record<string, string>;

const es: Dict = {
  // --- Cromo ---
  "nav.sections": "Secciones",
  "nav.search": "Buscar",
  "nav.more": "Más",
  "breaking.label": "Última hora",
  "newsletter.title": "Boletín",
  "newsletter.blurb": "Las noticias del sector ganadero en tu correo, sin ruido.",
  "newsletter.email": "Tu correo electrónico",
  "newsletter.cta": "Suscribirme",
  "newsletter.legal": "Te enviaremos un correo para confirmar. Puedes darte de baja cuando quieras.",
  "sidebar.mostRead": "Más leídas",
  "search.section": "Sección",
  "search.archive": "Archivo",
  "share.label": "Compartir",
  "share.copy": "Copiar enlace",
  "share.copied": "Enlace copiado",
  "share.more": "Más opciones",
  "theme.dark": "Modo oscuro",
  "push.on": "Avisarme de última hora",
  "push.off": "Desactivar avisos",
  "push.blocked": "Has bloqueado las notificaciones en este navegador.",
  "theme.light": "Modo claro",
  "sidebar.follow": "Síguenos",
  "live.label": "En vivo",
  "radio.listen": "Escuchar la emisora",
  "radio.playing": "Emisora en directo",
  "radio.stop": "Detener",
  "nav.assistant": "Asistente",
  "nav.panel": "Panel editorial",
  "nav.signatures": "Firmas",
  "nav.digitalEdition": "Edición digital · Colombia",
  "nav.tagline": "Periodismo del sector ganadero",
  "nav.archive": "Archivo histórico",
  "nav.institutional": "Documentos institucionales",
  "nav.online": "en línea",
  "market.label": "Indicadores",
  "market.trm": "Dólar (TRM)",
  "market.oil": "Petróleo Brent",
  "market.cattle": "Novillo gordo · Medellín",

  // --- Pie ---
  "footer.sections": "Secciones",
  "footer.institutional": "Institucional",
  "footer.legal": "Legal",
  "footer.tools": "Herramientas",
  "footer.editorialPolicy": "Política editorial",
  "footer.panel": "Panel editorial",
  "footer.archiveNote":
    "El archivo histórico permanece disponible en sus URLs originales, sin migración.",
  "footer.blurb":
    "Noticias, análisis y datos del sector ganadero colombiano. Verificación humana en cada publicación.",
  "footer.consultArchive": "Consultar el archivo",
  "footer.quote": "«Cada pieza lleva la firma de quien la reportea.»",
  "footer.assistantNote":
    "Las respuestas se generan únicamente sobre contenido publicado por CONtexto Ganadero y citan su fuente. No sustituyen la asesoría de un médico veterinario.",
  "footer.about":
    "CONtexto Ganadero es un medio periodístico del sector ganadero y agropecuario colombiano.",
  "footer.template": "Plantilla",

  // --- Portada ---
  "home.cover": "En portada",
  "home.latest": "Lo último",
  "home.current": "Actualidad",
  "home.recent": "Lo más reciente",
  "home.archiveKicker": "Archivo completo · 20 años",
  "home.ctaTitle":
    "Pregúntale al asistente sobre cualquier tema del archivo de CONtexto Ganadero",
  "home.ctaText":
    "Respuestas con fuente citada y enlace verificable. Si no hay fuente, no hay respuesta.",
  "home.ctaPrimary": "Abrir el asistente",
  "home.ctaSecondary": "Buscar en el archivo",
  "home.empty": "No hay artículos publicados todavía.",
  "home.emptyHint": "Configura la base de datos y ejecuta",
  "home.specials": "Especiales",
  "home.featuredColumn": "Columna destacada",
  "home.brief": "En breve",
  "home.forRancher": "Para el ganadero",
  "home.viewAll": "Ver todas",
  "home.sustainable": "Ganadería sostenible",
  "home.columnists": "Opinión y columnistas",
  "home.tools.prices": "Precios del ganado",
  "home.tools.markets": "Mercados",
  "home.tools.health": "Sanidad animal",
  "home.tools.manual": "Manual práctico",
  "card.by": "Por",
  "card.newsroom": "Redacción",
  "card.number": "N.º",

  // --- Artículo ---
  "article.home": "Inicio",
  "article.readTime": "min de lectura",
  "article.aboutAuthor": "Sobre la firma",
  "article.keepReading": "Continúa la lectura",
  "article.archiveTag": "archivo",

  // --- Sección / autor ---
  "section.kicker": "Sección",
  "section.count": "publicaciones",
  "section.live": "actualizado en continuo",
  "section.empty": "Sin artículos en esta sección todavía.",
  "section.noMatches": "Sin artículos que coincidan con los filtros.",
  "section.subcategory": "Subsección",
  "section.all": "Todas",
  "section.from": "Desde",
  "section.to": "Hasta",
  "section.filter": "Filtrar",
  "section.clear": "Limpiar filtros",
  "section.rangeAll": "Todo",
  "section.rangeToday": "Hoy",
  "section.rangeWeek": "Esta semana",
  "section.rangeMonth": "Este mes",
  "section.loadMore": "Cargar más noticias",
  "section.showing": "Mostrando",
  "section.of": "de",
  "section.prev": "Anterior",
  "section.next": "Siguiente",
  "author.kicker": "Firma",
  "author.count": "publicaciones",
  "author.empty": "Esta firma aún no tiene artículos publicados.",

  // --- Buscador ---
  "search.kicker": "Búsqueda híbrida",
  "search.title": "Consulta el",
  "search.titleAccent": "archivo completo",
  "search.blurb":
    "Un solo índice sobre contenido nuevo y archivo histórico: texto completo en español + vecinos semánticos (pgvector).",
  "search.placeholder": "Ej: precios del novillo gordo",
  "search.button": "Buscar",
  "search.try": "prueba:",
  "search.results": "resultados",
  "search.result": "resultado",
  "search.query": "consulta",
  "search.none": "sin coincidencias — prueba con menos términos o usa el",
  "search.assistant": "asistente",
  "search.label": "Términos de búsqueda",

  // --- Asistente ---
  "assistant.badge": "Recuperación con fuentes",
  "assistant.title": "Asistente",
  "assistant.blurb":
    "Busca en el contenido propio y en el archivo histórico, y cita cada fuente con enlace verificable. No sustituye la asesoría de un médico veterinario para casos individuales.",

  // --- Institucional / 404 ---
  "policy.kicker": "Documento vigente",
  "policy.title": "Política editorial",
  "policy.contents": "Contenido",
  "policy.approved": "Aprobado por el comité editorial · Revisión anual",
  "notFound.title": "Página no encontrada",
  "notFound.text":
    "Si llegaste desde un enlace antiguo, es posible que el contenido esté en el archivo histórico, que conserva sus direcciones originales.",
  "notFound.home": "Ir al inicio",
  "notFound.search": "Buscar en el archivo",

  // --- Conmutador ---
  "locale.switch": "Cambiar idioma",
  "locale.notice":
    "La interfaz está en inglés; los artículos permanecen en su idioma original, español.",
};

const en: Dict = {
  "nav.sections": "Sections",
  "nav.search": "Search",
  "nav.more": "More",
  "breaking.label": "Breaking",
  "newsletter.title": "Newsletter",
  "newsletter.blurb": "Cattle-sector news in your inbox, without the noise.",
  "newsletter.email": "Your email address",
  "newsletter.cta": "Subscribe",
  "newsletter.legal": "We will email you to confirm. You can unsubscribe at any time.",
  "sidebar.mostRead": "Most read",
  "search.section": "Section",
  "search.archive": "Archive",
  "share.label": "Share",
  "share.copy": "Copy link",
  "share.copied": "Link copied",
  "share.more": "More options",
  "theme.dark": "Dark mode",
  "push.on": "Alert me on breaking news",
  "push.off": "Turn off alerts",
  "push.blocked": "You have blocked notifications in this browser.",
  "theme.light": "Light mode",
  "sidebar.follow": "Follow us",
  "live.label": "Live",
  "radio.listen": "Listen to the station",
  "radio.playing": "Station live",
  "radio.stop": "Stop",
  "nav.assistant": "Assistant",
  "nav.panel": "Newsroom panel",
  "nav.signatures": "Bylines",
  "nav.digitalEdition": "Digital edition · Colombia",
  "nav.tagline": "Reporting on the cattle sector",
  "nav.archive": "Historical archive",
  "nav.institutional": "Institutional documents",
  "nav.online": "online",
  "market.label": "Market indicators",
  "market.trm": "USD/COP rate",
  "market.oil": "Brent crude",
  "market.cattle": "Fat steer · Medellín",

  "footer.sections": "Sections",
  "footer.institutional": "Institutional",
  "footer.legal": "Legal",
  "footer.tools": "Tools",
  "footer.editorialPolicy": "Editorial policy",
  "footer.panel": "Newsroom panel",
  "footer.archiveNote":
    "The historical archive stays available at its original URLs, with no migration.",
  "footer.blurb":
    "News, analysis and data from Colombia's cattle sector. Human verification on every story.",
  "footer.consultArchive": "Search the archive",
  "footer.quote": "“Every story carries the byline of whoever reported it.”",
  "footer.assistantNote":
    "Answers are generated only from content published by CONtexto Ganadero and always cite their source. They do not replace advice from a veterinarian.",
  "footer.about":
    "CONtexto Ganadero is a news outlet covering Colombia's cattle and agricultural sector.",
  "footer.template": "Template",

  "home.cover": "Front page",
  "home.latest": "Latest",
  "home.current": "Today",
  "home.recent": "Most recent",
  "home.archiveKicker": "Full archive · 20 years",
  "home.ctaTitle": "Ask the assistant about anything in the CONtexto Ganadero archive",
  "home.ctaText":
    "Answers with a cited source and a verifiable link. No source, no answer.",
  "home.ctaPrimary": "Open the assistant",
  "home.ctaSecondary": "Search the archive",
  "home.empty": "No articles published yet.",
  "home.emptyHint": "Set up the database and run",
  "home.specials": "Features",
  "home.featuredColumn": "Featured column",
  "home.brief": "In brief",
  "home.forRancher": "For ranchers",
  "home.viewAll": "View all",
  "home.sustainable": "Sustainable ranching",
  "home.columnists": "Opinion & columnists",
  "home.tools.prices": "Cattle prices",
  "home.tools.markets": "Markets",
  "home.tools.health": "Animal health",
  "home.tools.manual": "Practical manual",
  "card.by": "By",
  "card.newsroom": "Newsroom",
  "card.number": "No.",

  "article.home": "Home",
  "article.readTime": "min read",
  "article.aboutAuthor": "About the byline",
  "article.keepReading": "Keep reading",
  "article.archiveTag": "archive",

  "section.kicker": "Section",
  "section.count": "stories",
  "section.live": "continuously updated",
  "section.empty": "No stories in this section yet.",
  "section.noMatches": "No stories match these filters.",
  "section.subcategory": "Subsection",
  "section.all": "All",
  "section.from": "From",
  "section.to": "To",
  "section.filter": "Filter",
  "section.clear": "Clear filters",
  "section.rangeAll": "All",
  "section.rangeToday": "Today",
  "section.rangeWeek": "This week",
  "section.rangeMonth": "This month",
  "section.loadMore": "Load more stories",
  "section.showing": "Showing",
  "section.of": "of",
  "section.prev": "Previous",
  "section.next": "Next",
  "author.kicker": "Byline",
  "author.count": "stories",
  "author.empty": "This byline has no published stories yet.",

  "search.kicker": "Hybrid search",
  "search.title": "Search the",
  "search.titleAccent": "full archive",
  "search.blurb":
    "One index over new content and the historical archive: Spanish full-text search plus semantic neighbours (pgvector).",
  "search.placeholder": "e.g. fat steer prices",
  "search.button": "Search",
  "search.try": "try:",
  "search.results": "results",
  "search.result": "result",
  "search.query": "query",
  "search.none": "no matches — try fewer terms or use the",
  "search.assistant": "assistant",
  "search.label": "Search terms",

  "assistant.badge": "Source-grounded retrieval",
  "assistant.title": "Assistant",
  "assistant.blurb":
    "Searches our own content and the historical archive, citing every source with a verifiable link. It does not replace a veterinarian for individual cases.",

  "policy.kicker": "Current document",
  "policy.title": "Editorial policy",
  "policy.contents": "Contents",
  "policy.approved": "Approved by the editorial committee · Reviewed yearly",
  "notFound.title": "Page not found",
  "notFound.text":
    "If you followed an old link, the content may live in the historical archive, which keeps its original addresses.",
  "notFound.home": "Go to the home page",
  "notFound.search": "Search the archive",

  "locale.switch": "Change language",
  "locale.notice":
    "The interface is in English; articles remain in their original language, Spanish.",
};

const DICTS: Record<Locale, Dict> = { es, en };

/** Traduce una clave. Si falta en inglés, cae al español (nunca a la clave). */
export function t(locale: Locale, key: keyof typeof es): string {
  return DICTS[locale][key] ?? es[key] ?? String(key);
}

/** Atajo para componer traductores: `const tr = translator(locale)`. */
export function translator(locale: Locale) {
  return (key: keyof typeof es) => t(locale, key);
}

/** Locale BCP-47 para fechas y números. */
export const INTL_LOCALE: Record<Locale, string> = { es: "es-CO", en: "en-US" };

/**
 * Nombres de sección en inglés.
 *
 * Provisional a conciencia: la taxonomía vive en la base de datos y lo
 * correcto sería una columna `name_en` que el editor gestione desde el panel.
 * Mientras tanto, estas seis secciones fijas del medio se traducen aquí; una
 * sección nueva cae con elegancia a su nombre en español.
 */
const CATEGORY_EN: Record<string, string> = {
  "economia-y-mercados": "Economy & markets",
  regiones: "Regions",
  sostenibilidad: "Sustainability",
  "politica-gremial": "Industry policy",
  "ciencia-y-tecnologia": "Science & technology",
  opinion: "Opinion",
};

export function categoryLabel(locale: Locale, slug: string | null, fallback: string): string {
  if (locale === DEFAULT_LOCALE || !slug) return fallback;
  return CATEGORY_EN[slug] ?? fallback;
}

/** Prefija la ruta con el idioma (el español vive en la raíz). */
export function localePath(locale: Locale, path: string): string {
  if (locale === DEFAULT_LOCALE) return path;
  return path === "/" ? "/en" : `/en${path}`;
}

/** Quita el prefijo de idioma de una ruta (para el conmutador). */
export function stripLocale(path: string): string {
  return path === "/en" ? "/" : path.replace(/^\/en(?=\/|$)/, "") || "/";
}
