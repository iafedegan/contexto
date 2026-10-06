import "server-only";

import { generateText, type ToolSet } from "ai";
import { getGroundedAi } from "@/lib/ai-provider";
import { registrarUsoIA } from "@/lib/ai-cuota";

/**
 * Redacta un borrador a partir del tema y las notas del periodista.
 *
 * Nunca publica: devuelve el texto al editor, que lo revisa y guarda. Es la
 * regla de la casa (AGENTS.md) y también la razón de que todo dato no
 * confirmado se omita en lugar de inventarse.
 *
 * Sin `ANTHROPIC_API_KEY` no se simula una noticia —sería inventar hechos—:
 * se devuelve un ESQUEMA de trabajo con la estructura, los intertítulos y la
 * ficha de posicionamiento, para que el periodista escriba encima.
 */
/** Hechos verificables del tema (búsqueda web con fuentes). Sin esto el modelo escribiría de memoria, es decir, inventando. */
export async function investigarTema(userId: string, tema: string, encargo: string, section?: string) {
  const ai = await getGroundedAi();
  if (!ai || ai === "otro-proveedor") return null;
  try {
    const hoy = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" }).format(new Date());
    const sistema =
      "Eres verificador de datos de un medio ganadero colombiano. Busca en la web fuentes fidedignas (DANE, FEDEGAN, ICA, Ministerio de Agricultura, Agronet/SIPSA, IDEAM, Banco de la República, FAO, USDA, medios reconocidos). Reporta SOLO hechos que aparezcan literalmente en las páginas consultadas: cifras con su unidad, periodo y fecha de corte, nombres, cargos, declaraciones y lugares, cada uno con su fuente (entidad y página). Si algo no lo encuentras, di que no lo encontraste. Nunca completes con suposiciones.";
    const base = `Hoy es ${hoy}.${section ? ` Sección: ${section}.` : ""}\nTEMA DE LA NOTA: ${tema || encargo.slice(0, 200)}\nCONTEXTO DEL PERIODISTA: ${encargo.slice(0, 1500)}\n\n`;
    const [hechos, cifras] = await Promise.all([
      generateText({ model: ai.model, tools: ai.tools as unknown as ToolSet, system: sistema, prompt: `${base}Lista los hechos verificables y recientes sobre este tema (qué pasó, cuándo, dónde, quién) con la fuente de cada uno.` }),
      generateText({ model: ai.model, tools: ai.tools as unknown as ToolSet, system: sistema, prompt: `${base}Busca las CIFRAS OFICIALES Y AUDITABLES relacionadas con este tema (inventarios, precios, producción, exportaciones, área o animales afectados, variaciones porcentuales). Para cada cifra: valor exacto, unidad, periodo o fecha de corte y entidad que la publica con su enlace.` }),
    ]);
    await registrarUsoIA(userId, hechos.usage);
    await registrarUsoIA(userId, cifras.usage);
    const sources = [...hechos.sources, ...cifras.sources]
      .filter((x) => x.sourceType === "url")
      .map((x) => { const host = hostFuente(x.title, x.url); return { title: (x.title && x.title !== host ? x.title : host || x.url).slice(0, 120), outlet: host, url: x.url }; })
      .filter((x, i, a) => a.findIndex((y) => y.url === x.url) === i)
      .slice(0, 10);
    const r = { text: `HECHOS:\n${hechos.text}\n\nCIFRAS OFICIALES:\n${cifras.text}` };
    return { text: r.text, sources: await resolverEnlaces(sources) };
  } catch (e) {
    console.warn("investigarTema:", e);
    return null;
  }
}

/** Las fuentes de la búsqueda de Gemini llegan como enlaces de redirección: se siguen para guardar la página real. */
export async function resolverEnlaces<T extends { url: string }>(lista: T[]): Promise<T[]> {
  return Promise.all(
    lista.map(async (x) => {
      try {
        if (new URL(x.url).hostname !== "vertexaisearch.cloud.google.com") return x;
        const r = await fetch(x.url, { redirect: "manual", signal: AbortSignal.timeout(4000) });
        const loc = r.headers.get("location");
        return loc && /^https?:\/\//i.test(loc) ? { ...x, url: loc } : x;
      } catch {
        return x;
      }
    }),
  );
}

/**
 * Dominio de una fuente. La búsqueda de Gemini devuelve enlaces de redirección (vertexaisearch…) y deja el dominio
 * real en el título; por eso se usa el título cuando tiene forma de dominio.
 */
export function hostFuente(title: string | undefined, url: string): string {
  const t = (title ?? "").trim().toLowerCase();
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(t)) return t.replace(/^www\./, "");
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

/** Id de un video de YouTube a partir de su enlace (watch, youtu.be, shorts, embed). */
export function youtubeId(url: string): string | undefined {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, "");
    if (h === "youtu.be") return u.pathname.slice(1).split("/")[0] || undefined;
    if (h.endsWith("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v") ?? undefined;
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]{6,})/);
      if (m) return m[2];
    }
  } catch {
    /* url inválida */
  }
  return undefined;
}

/** Las fuentes de Gemini llegan como redirecciones de Google: se resuelven al enlace real (con tope de tiempo). */
export async function resolverEnlace(url: string): Promise<string> {
  if (!/vertexaisearch\.cloud\.google\.com|grounding-api-redirect/.test(url)) return url;
  try {
    const r = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(4000) });
    const loc = r.headers.get("location");
    return loc && /^https?:\/\//i.test(loc) ? loc : url;
  } catch {
    return url;
  }
}

/** Entidades oficiales, gremiales, multilaterales y académicas: las fuentes que sí respaldan una cifra. */
export const FUENTE_CONFIABLE = [
  /\.gov(\.[a-z]{2})?$/, /(^|\.)fedegan\.org\.co$/, /(^|\.)fenavi\.org$/, /(^|\.)asoleche\.org$/, /(^|\.)bolsamercantil\.com\.co$/,
  /(^|\.)fao\.org$/, /(^|\.)oecd\.org$/, /(^|\.)worldbank\.org$/, /(^|\.)cepal\.org$/, /(^|\.)iica\.int$/, /(^|\.)un\.org$/,
  /(^|\.)woah\.org$/, /(^|\.)edu(\.[a-z]{2})?$/, /(^|\.)agronet\.gov\.co$/, /(^|\.)banrep\.gov\.co$/,
];
// Indica si el dominio de una fuente está en la lista de fuentes confiables.
export const esConfiable = (host: string) => FUENTE_CONFIABLE.some((r) => r.test(host));
