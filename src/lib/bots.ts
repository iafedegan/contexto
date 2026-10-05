/**
 * Política de bots compartida por robots.txt (src/app/robots.ts) y el
 * middleware (src/proxy.ts), para que lo que se anuncia y lo que se hace
 * coincidan.
 */

/** Buscadores de IA que citan y enlazan la nota (traen lectores): permitidos. */
export const AI_SEARCH_BOTS = ["OAI-SearchBot", "ChatGPT-User", "Claude-User", "PerplexityBot", "Perplexity-User"];

/** Crawlers que copian contenido para entrenar modelos: bloqueados. */
export const AI_TRAINING_BOTS = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Bytespider",
  "meta-externalagent",
  "FacebookBot",
  "cohere-ai",
  "cohere-training-data-crawler",
  "Diffbot",
  "Amazonbot",
  "ImagesiftBot",
  "Omgilibot",
  "Timpibot",
  "PetalBot",
];

/**
 * Herramientas y librerías de scraping: nunca son un lector humano. Los
 * buscadores legítimos (Googlebot, Bingbot…) y los lectores RSS no están aquí.
 */
const SCRAPER_PATTERNS = [
  /python-requests|python-urllib|aiohttp|httpx|scrapy|mechanize/i,
  /\bcurl\/|\bwget\/|libwww-perl|go-http-client|okhttp|java\/|apache-httpclient/i,
  /node-fetch|axios\/|undici|got \(/i,
  /headlesschrome|phantomjs|puppeteer|playwright|selenium|slimerjs/i,
  /scraperapi|zenrows|brightdata|apify|crawler4j|nutch|heritrix|httrack|webcopier|sitesucker|teleport/i,
];

// Decide si un User-Agent debe bloquearse: vacío, crawlers de entrenamiento de IA o herramientas de raspado.
export function isBlockedBot(userAgent: string | null): boolean {
  const ua = userAgent?.trim() ?? "";
  if (!ua) return true; // sin User-Agent: ningún navegador real hace eso
  if (AI_TRAINING_BOTS.some((b) => ua.toLowerCase().includes(b.toLowerCase()))) return true;
  return SCRAPER_PATTERNS.some((re) => re.test(ua));
}
