/**
 * Política de bots compartida por robots.txt (src/app/robots.ts) y el
 * proxy (src/proxy.ts), para que lo que se anuncia y lo que se hace
 * coincidan.
 *
 * Criterio (H-13): el User-Agent lo escribe quien hace la petición, así que NO es una identidad ni un freno contra
 * quien quiere raspar el sitio (basta con cambiarlo). Bloquear por él lo que no es un lector —curl, python-requests,
 * un Chrome sin interfaz, un cliente HTTP cualquiera— sí rompe cosas legítimas: auditorías (Lighthouse CI), monitores
 * de disponibilidad, validadores de RSS, las pruebas automáticas del propio sitio y los futuros agentes de monitoreo
 * del proyecto (obligación 23), que es justo el patrón que la propuesta le criticó al sitio actual. Por eso aquí solo
 * se rechaza lo que se declara a sí mismo como copiador de contenido, con listas EXPLÍCITAS y documentadas; el freno
 * contra el raspado real es el ritmo por IP (src/proxy.ts) y el Firewall de Vercel (docs/seguridad.md).
 */

/** Buscadores de IA que citan y enlazan la nota (traen lectores): permitidos. */
export const AI_SEARCH_BOTS = ["OAI-SearchBot", "ChatGPT-User", "Claude-User", "PerplexityBot", "Perplexity-User"];

/** Crawlers que copian contenido para entrenar modelos: bloqueados (y así lo declara robots.txt). */
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
 * Herramientas que se declaran a sí mismas como copiadoras de sitios completos o como servicio de raspado. Nombres
 * propios, no familias: aquí NO entran las librerías HTTP (curl, python-requests, axios, undici, go-http-client…) ni los
 * navegadores automatizados (Chrome sin interfaz, Playwright, Puppeteer, Selenium), que usan a diario las auditorías,
 * los monitores y las pruebas.
 */
export const COPIADORES_DE_SITIOS = [
  "httrack",
  "webcopier",
  "sitesucker",
  "teleport",
  "wget-mirror",
  "scraperapi",
  "zenrows",
  "brightdata",
  "apify",
  "crawler4j",
  "nutch",
  "heritrix",
  "scrapy",
  "slimerjs",
  "phantomjs",
];

/**
 * Herramientas de auditoría, monitoreo, validación y vista previa que NUNCA se bloquean, aunque su User-Agent se parezca
 * a algo de la lista anterior (p. ej. un monitor hecho con Scrapy o un Lighthouse sobre Chrome sin interfaz). Lista
 * documentada en docs/seguridad.md; se amplía con la variable `BOT_ALLOW_EXTRA`.
 */
export const HERRAMIENTAS_PERMITIDAS: { nombre: string; patron: RegExp }[] = [
  { nombre: "Lighthouse y PageSpeed Insights", patron: /lighthouse|pagespeed|google-speed|chrome-lighthouse/i },
  { nombre: "Monitores de disponibilidad", patron: /uptimerobot|pingdom|statuscake|better ?stack|betteruptime|site24x7|datadog|newrelic|checkly|freshping|hetrixtools|nodeping|vercel-/i },
  { nombre: "Validadores de feeds y de HTML", patron: /w3c[-_ ]?(validator|css|feed|markup)|feedvalidator|validator\.nu|rssvalidator|feedburner/i },
  { nombre: "Lectores RSS", patron: /feedly|inoreader|newsblur|netnewswire|feedbin|flipboard|theoldreader|miniflux|nextcloud-news|feedreader/i },
  { nombre: "Vista previa al compartir", patron: /facebookexternalhit|twitterbot|linkedinbot|slackbot|whatsapp|telegrambot|discordbot|skypeuripreview|pinterestbot/i },
  { nombre: "Agentes de monitoreo del proyecto", patron: /contextoganadero-monitor|contexto-ganadero-monitor/i },
];

// Lista de fragmentos de User-Agent de una variable de entorno (separados por comas), en minúsculas y sin vacíos.
const deEntorno = (valor: string | undefined) =>
  (valor ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 3);

/**
 * Decide si un User-Agent debe rechazarse. Orden: (1) lo permitido de forma explícita (herramientas documentadas y
 * `BOT_ALLOW_EXTRA`) gana siempre; (2) los crawlers de entrenamiento de IA y los copiadores de sitios por su nombre, más
 * lo que se añada en `BOT_BLOCK_EXTRA` (para reaccionar a un abuso sin desplegar código); (3) todo lo demás pasa, incluido
 * un User-Agent vacío o una librería HTTP genérica.
 */
export function isBlockedBot(userAgent: string | null, env: Record<string, string | undefined> = process.env): boolean {
  const ua = userAgent?.trim().toLowerCase() ?? "";
  if (!ua) return false;
  if (HERRAMIENTAS_PERMITIDAS.some((h) => h.patron.test(ua)) || deEntorno(env.BOT_ALLOW_EXTRA).some((f) => ua.includes(f))) return false;
  const bloqueados = [...AI_TRAINING_BOTS.map((b) => b.toLowerCase()), ...COPIADORES_DE_SITIOS, ...deEntorno(env.BOT_BLOCK_EXTRA)];
  return bloqueados.some((b) => ua.includes(b));
}
