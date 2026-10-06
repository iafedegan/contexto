/**
 * Clasificación del origen de una lectura. Es una función pura (sin base de datos) para poder probarla:
 * `view-sources.ts` la usa para registrar cada lectura.
 */

// Lectores de feeds RSS y agregadores: quien entra desde uno de ellos viene de un feed, no de «un sitio cualquiera».
const LECTORES_RSS: [RegExp, string][] = [
  [/(^|\.)feedly\.com$/, "Feedly"],
  [/(^|\.)inoreader\.com$/, "Inoreader"],
  [/(^|\.)newsblur\.com$/, "NewsBlur"],
  [/(^|\.)theoldreader\.com$/, "The Old Reader"],
  [/(^|\.)feedbin\.com$/, "Feedbin"],
  [/(^|\.)(commafeed\.com|netvibes\.com|feedspot\.com)$/, "Otro lector RSS"],
  [/(^|\.)flipboard\.com$/, "Flipboard"],
];

// Patrones de dominios de redes sociales y buscadores y el nombre con el que se agrupan.
const REDES: [RegExp, string][] = [
  [/(^|\.)google\./, "Google"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/duckduckgo\.com$|ecosia\.org$|yahoo\./, "Otros buscadores"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|l\.facebook\.com|lm\.facebook\.com)$/, "Facebook"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "X (Twitter)"],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, "WhatsApp"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
  [/(^|\.)linkedin\.com$|lnkd\.in$/, "LinkedIn"],
  [/(^|\.)(tiktok\.com)$/, "TikTok"],
  [/(^|\.)(news\.google\.com|discover\.google\.com)$/, "Google Noticias / Discover"],
];

// Texto limpio para usar como etiqueta: minúsculas, solo caracteres seguros y largo acotado.
const limpio = (s: unknown, max = 40) =>
  String(s ?? "").toLowerCase().replace(/[^a-z0-9áéíóúñü _.\-+/]/gi, "").trim().slice(0, max);

/**
 * Etiqueta legible del origen. Orden: lector RSS (los enlaces de los feeds llevan `utm_source=rss`, o se reconoce
 * el lector por el sitio de procedencia), luego el resto de UTM (es lo que el equipo etiquetó), luego el referente,
 * y por último «Directo».
 */
export function clasificarFuente(i: { utmSource?: string; utmMedium?: string; utmCampaign?: string; referrer?: string; host?: string }): string {
  const src = limpio(i.utmSource);
  let h = "";
  try {
    h = i.referrer ? new URL(i.referrer).hostname.replace(/^www\./, "").toLowerCase() : "";
  } catch {
    h = "";
  }
  const lector = LECTORES_RSS.find(([re]) => re.test(h))?.[1];
  if (src === "rss" || src === "feed" || (!src && lector)) return `Lector RSS${lector ? ` · ${lector}` : ""}`;
  if (src) {
    const med = limpio(i.utmMedium);
    const camp = limpio(i.utmCampaign, 30);
    return `UTM · ${src}${med ? ` / ${med}` : ""}${camp ? ` / ${camp}` : ""}`;
  }
  if (!h) return "Directo";
  if (i.host && (h === i.host.replace(/^www\./, "") || h.endsWith(`.${i.host.replace(/^www\./, "")}`))) return "Interno (otras páginas del sitio)";
  for (const [re, name] of REDES) if (re.test(h)) return name;
  return h.slice(0, 60);
}

