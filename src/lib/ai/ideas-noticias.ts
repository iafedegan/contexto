import "server-only";

import { generateObject, generateText, type ToolSet } from "ai";
import { z } from "zod";
import { getGroundedAi } from "@/lib/ai-provider";
import { registrarUsoIA, verificarCuotaIA } from "@/lib/ai-cuota";
import { resolverEnlace, youtubeId } from "@/lib/ai/investigacion";

// Sin topes de longitud en el esquema: Gemini a veces se pasa de caracteres y todo el resultado
// se descartaba con «response did not match schema». Se recorta después.
const topicIdeasSchema = z.object({
  ideas: z
    .array(
      z.object({
        title: z.string(),
        scope: z.enum(["local", "internacional"]).catch("local"),
        angle: z.string(),
        why: z.string(),
      }),
    )
    .min(1),
});

// Una idea de tema con su ángulo y su justificación.
export type TopicIdea = z.infer<typeof topicIdeasSchema>["ideas"][number];

// Resultado de aconsejar temas: las ideas con sus fuentes, o un error.
export type TopicIdeasResult =
  | { ok: true; ideas: TopicIdea[]; sources: { title: string; url: string }[] }
  | { ok: false; error: string };

/**
 * «Aconséjame temas»: busca en la web qué se está moviendo en el sector ganadero
 * (Colombia y el mundo) y propone temas con su porqué. Solo con fuentes citables;
 * el periodista elige uno y sigue el flujo normal (nada se publica sin revisión).
 */
export async function suggestTopicIdeasCore(userId: string, input: { section?: string; focus?: string }): Promise<TopicIdeasResult> {
  const ai = await getGroundedAi();
  if (!ai) return { ok: false, error: "Falta la clave del modelo (Configuración → Asistente)." };
  if (ai === "otro-proveedor") {
    return { ok: false, error: "Buscar tendencias en internet usa Gemini: elige Google (Gemini) en Configuración → Asistente." };
  }
  try {
    const cuota = await verificarCuotaIA(userId);
    if (!cuota.ok) return { ok: false, error: cuota.message };
    const hoy = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" }).format(new Date());
    const found = await generateText({
      model: ai.model,
      tools: ai.tools as unknown as ToolSet,
      system:
        "Eres editor de un medio ganadero colombiano. Investiga en la web LO QUE ESTÁ SIENDO NOTICIA O TENDENCIA ahora: (a) en Colombia y sus regiones ganaderas (precios, sanidad animal, política pública, clima, exportaciones, FEDEGAN, ICA, Ministerio de Agricultura) y (b) a nivel internacional (mercados de carne y leche, comercio, enfermedades, tecnología, sostenibilidad, FAO, USDA). Reporta hechos con fecha y fuente; no inventes.",
      prompt: `Hoy es ${hoy}.${input.section ? ` Sección de interés: ${input.section}.` : ""}${input.focus?.trim() ? ` Enfoque pedido por el periodista: ${input.focus.trim()}.` : ""}\n\nBusca las tendencias y noticias más recientes (últimas semanas) del sector ganadero local e internacional y resume de 8 a 12 temas candidatos con el hecho, la fecha y la fuente.`,
    });
    await registrarUsoIA(userId, found.usage);
    const sources = found.sources
      .filter((s) => s.sourceType === "url")
      .map((s) => ({ title: (s.title || new URL(s.url).hostname).slice(0, 120), url: s.url }))
      .filter((s, i, a) => a.findIndex((x) => x.url === s.url) === i)
      .slice(0, 10);
    if (!sources.length) return { ok: false, error: "La búsqueda no devolvió fuentes citables, así que no se proponen temas." };

    // Una llamada al modelo para proponer los temas a partir del texto de la búsqueda.
    const intento = () => generateObject({
      model: ai.model,
      schema: topicIdeasSchema,
      prompt: `Con SOLO lo que dice el texto, propone de 5 a 8 temas de nota para un medio ganadero colombiano: mezcla temas LOCALES (Colombia) e INTERNACIONALES. Para cada uno (textos breves): title = titular tentativo claro (máx. 110 caracteres), scope, angle = el enfoque periodístico concreto (qué contar y a quién le importa), why = por qué es tendencia ahora (hecho + fecha). No inventes cifras ni hechos que no estén en el texto.\n\nTEXTO:\n${found.text.slice(0, 7000)}`,
    });
    let res;
    try {
      res = await intento();
    } catch {
      res = await intento(); // un reintento: la salida estructurada falla de forma intermitente
    }
    await registrarUsoIA(userId, res.usage);
    const ideas = res.object.ideas
      .filter((i) => i.title.trim() && i.angle.trim())
      .slice(0, 8)
      .map((i) => ({ ...i, title: i.title.trim().slice(0, 160), angle: i.angle.trim().slice(0, 400), why: i.why.trim().slice(0, 300) }));
    if (!ideas.length) return { ok: false, error: "La IA no devolvió temas utilizables; inténtalo de nuevo." };
    return { ok: true, ideas, sources };
  } catch (err) {
    console.error("suggestTopicIdeas:", err);
    const detalle = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "";
    return { ok: false, error: detalle ? `No se pudieron buscar temas: ${detalle.slice(0, 220)}` : "El modelo no respondió." };
  }
}

/* --------------------------------------------------------------------------
 * Búsqueda profunda de noticias sobre una persona, empresa o tema concreto
 * -------------------------------------------------------------------------- */

const newsSchema = z.object({
  items: z
    .array(
      z.object({
        title: z.string(),
        outlet: z.string(),
        date: z.string().optional().default(""),
        summary: z.string(),
        type: z.enum(["noticia", "video", "oficial"]).catch("noticia"),
        /** Posición (0, 1, 2…) de la fuente de la lista que respalda este resultado; -1 si ninguna. */
        sourceIndex: z.number().int().catch(-1),
      }),
    )
    .min(1),
});

// Una noticia encontrada: titular, medio, fecha, resumen y enlace.
export type NewsItem = {
  title: string;
  outlet: string;
  date: string;
  summary: string;
  url: string;
  type: "noticia" | "video" | "oficial";
  /** Solo videos de YouTube: permite miniatura e incrustación. */
  videoId?: string;
};

// Resultado de buscar noticias: la lista o un error.
export type NewsSearchResult = { ok: true; items: NewsItem[] } | { ok: false; error: string };

/**
 * «Busca noticias sobre X»: investigación profunda en la web con tres rastreos en paralelo (medios de
 * comunicación, YouTube y fuentes oficiales/redes/radio). Devuelve resultados con medio, fecha, resumen y
 * enlace verificable (solo URLs que la búsqueda realmente consultó). El periodista decide cuáles
 * referenciar o usar como tema.
 */
export async function searchNewsAboutCore(userId: string, input: { query: string; section?: string }): Promise<NewsSearchResult> {
  const query = input.query.trim().slice(0, 200);
  if (query.length < 3) return { ok: false, error: "Escribe a quién o qué buscar (mínimo 3 caracteres)." };
  const ai = await getGroundedAi();
  if (!ai) return { ok: false, error: "Falta la clave del modelo (Configuración → Asistente)." };
  if (ai === "otro-proveedor") {
    return { ok: false, error: "Buscar noticias usa Gemini: elige Google (Gemini) en Configuración → Asistente." };
  }
  try {
    const cuota = await verificarCuotaIA(userId);
    if (!cuota.ok) return { ok: false, error: cuota.message };
    const base = `${input.section ? `Sección de interés: ${input.section}.\n` : ""}BÚSQUEDA: ${query}\n\n`;
    const system =
      "Eres documentalista de un medio ganadero colombiano. Haz una búsqueda profunda en la web (varias consultas: nombre completo, cargo, entidad, regiones, sinónimos, ortografía alternativa) y lista cada resultado con titular o título, medio o canal, fecha y qué dice, solo con lo que encuentres; no inventes. Lo más reciente primero.";
    const rastreos = [
      `${base}Encuentra de 6 a 10 NOTICIAS y publicaciones en medios de comunicación (prensa, revistas, portales, agencias), distintas entre sí, con titular, medio, fecha y resumen.`,
      `${base}Busca VIDEOS en YouTube (usa consultas con «site:youtube.com»): entrevistas, noticieros, intervenciones, reportajes, canales de medios y gremios. Lista de 4 a 8 videos con título, canal, fecha y de qué trata, indicando el enlace de YouTube.`,
      `${base}Busca FUENTES OFICIALES y de primera mano: comunicados, entidades públicas y gremiales, redes sociales verificadas, radio y televisión regional, documentos. Lista de 3 a 6 con título, quién lo publica, fecha y resumen.`,
    ];
    const hallazgos = await Promise.all(
      rastreos.map((prompt) =>
        generateText({ model: ai.model, tools: ai.tools as unknown as ToolSet, system, prompt }).catch(() => null),
      ),
    );
    const validos = hallazgos.filter((h): h is NonNullable<typeof h> => h !== null);
    if (!validos.length) return { ok: false, error: "La búsqueda no respondió. Inténtalo de nuevo en un momento." };
    for (const h of validos) await registrarUsoIA(userId, h.usage);

    const crudas = validos
      .flatMap((h) => h.sources)
      .filter((x) => x.sourceType === "url")
      .map((x) => ({ title: x.title || "", url: x.url }))
      .filter((x, i, a) => a.findIndex((y) => y.url === x.url) === i)
      .slice(0, 40);
    const resueltas = await Promise.all(crudas.map(async (x) => ({ title: x.title, url: await resolverEnlace(x.url) })));
    const sources = resueltas.filter((x, i, a) => a.findIndex((y) => y.url === x.url) === i);
    if (!sources.length) return { ok: false, error: "La búsqueda no devolvió fuentes citables para ese tema." };

    const lista = sources.map((x, i) => `[${i}] ${x.title || new URL(x.url).hostname} — ${x.url}`).join("\n");
    const texto = validos.map((h, i) => `--- RASTREO ${i + 1} ---\n${h.text}`).join("\n\n").slice(0, 14000);
    const { object, usage } = await generateObject({
      model: ai.model,
      schema: newsSchema,
      prompt: `Con SOLO el texto de la investigación, extrae los resultados distintos encontrados sobre «${query}». Para cada uno: title = titular o título, outlet = medio o canal (breve), date = fecha tal como consta (o vacío), summary = 1-2 frases de lo que dice (sin inventar), type = «video» si es un video de YouTube, «oficial» si es comunicado, entidad o red social verificada, «noticia» si es prensa; sourceIndex = número de la fuente de esta lista que mejor lo respalda (o -1 si ninguna). Máximo 20 resultados.\n\nFUENTES CONSULTADAS:\n${lista}\n\nINVESTIGACIÓN:\n${texto}`,
    });
    await registrarUsoIA(userId, usage);
    const items: NewsItem[] = object.items
      .map((i) => {
        const url = sources[i.sourceIndex]?.url ?? "";
        const videoId = youtubeId(url);
        return {
          title: i.title.trim().slice(0, 200),
          outlet: i.outlet.trim().slice(0, 80),
          date: (i.date ?? "").trim().slice(0, 40),
          summary: i.summary.trim().slice(0, 500),
          url,
          type: videoId ? ("video" as const) : i.type === "video" ? ("noticia" as const) : i.type,
          videoId,
        };
      })
      // Sin enlace verificable no se ofrece: la regla de la casa es «sin fuente no hay nota».
      .filter((i) => i.title && i.summary && i.url)
      .filter((i, idx, arr) => arr.findIndex((o) => o.url === i.url) === idx)
      .slice(0, 20);
    if (!items.length) return { ok: false, error: "No se encontraron resultados con enlace verificable. Prueba con otro nombre o más contexto." };
    return { ok: true, items };
  } catch (err) {
    console.error("searchNewsAbout:", err);
    const detalle = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "";
    return { ok: false, error: detalle ? `No se pudo buscar: ${detalle.slice(0, 220)}` : "El modelo no respondió." };
  }
}
/* --------------------------------------------------------------------------
 * Foto de portada generada con IA (realista, estilo fotograma de cine)
 * -------------------------------------------------------------------------- */
