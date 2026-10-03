import "server-only";

import { generateImage, generateObject, generateText, type ToolSet } from "ai";
import { z } from "zod";
import { EDITOR_ASSIST_SYSTEM } from "@/agents/prompts";
import { focusTerms } from "@/lib/seo-audit";
import { getAiModel, getGroundedAi, getImageAi } from "@/lib/ai-provider";
import { subirImagenBytes } from "@/lib/media-upload";
import { PREFIJO_IMAGEN_IA } from "@/lib/ai-image";
import { materialParaPrompt, type Material } from "@/lib/material-types";
import { registrarCostoIA, registrarUsoIA, verificarCuotaIA } from "@/lib/ai-cuota";
import { aplicarTipo, chartProblem, renderChartSvg, type ChartSpec, type TipoGrafica } from "@/lib/chart-svg";


const draftSchema = z.object({
  title: z.string().min(8),
  excerpt: z.string().min(20),
  body: z.string().min(50),
  metaTitle: z.string().min(8).max(70),
  metaDescription: z.string().min(50).max(170),
  tags: z.array(z.string()).min(2).max(8),
  keywords: z.array(z.string()).min(3).max(8),
  seoOptions: z
    .array(
      z.object({
        metaTitle: z.string(),
        metaDescription: z.string(),
        rationale: z.string(),
      }),
    )
    .min(1)
    .max(3),
});

export type GeneratedDraft = z.infer<typeof draftSchema>;

export type GenerateResult =
  | { ok: true; mode: "ia" | "esquema"; draft: GeneratedDraft; note?: string }
  | { ok: false; error: string };

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
async function investigarTema(userId: string, tema: string, encargo: string, section?: string) {
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
      .map((x) => ({ title: (x.title || new URL(x.url).hostname).slice(0, 120), outlet: new URL(x.url).hostname.replace(/^www\./, ""), url: x.url }))
      .filter((x, i, a) => a.findIndex((y) => y.url === x.url) === i)
      .slice(0, 10);
    const r = { text: `HECHOS:\n${hechos.text}\n\nCIFRAS OFICIALES:\n${cifras.text}` };
    return { text: r.text, sources };
  } catch (e) {
    console.warn("investigarTema:", e);
    return null;
  }
}

/** Cifras (con al menos 2 dígitos) del cuerpo que no constan en el material de respaldo. */
function cifrasSinRespaldo(html: string, respaldo: string): string[] {
  const dig = (x: string) => x.replace(/[.,\s]/g, "");
  const base = new Set((respaldo.match(/\d[\d.,]*\d|\d/g) ?? []).map(dig));
  const texto = html.replace(/<[^>]+>/g, " ");
  const malas = new Set<string>();
  for (const m of texto.match(/\d[\d.,]*\d/g) ?? []) if (!base.has(dig(m))) malas.add(m);
  return [...malas];
}
/** Quita los párrafos/viñetas con cifras que no constan en las fuentes: mejor omitir que inventar. */
function sinCifrasInventadas(html: string, malas: string[]): string {
  if (!malas.length) return html;
  return html.replace(/<(p|li)\b[^>]*>[\s\S]*?<\/\1>/gi, (blk) => (malas.some((m) => blk.includes(m)) ? "" : blk));
}

export async function generateArticleDraftCore(userId: string, input: {
  title: string;
  prompt: string;
  section?: string;
  /** Noticias que el periodista eligió referenciar: se citan con enlace en el cuerpo. */
  references?: { title: string; outlet: string; url: string; videoId?: string }[];
  /** Entrevista transcrita o texto de enlaces: material primario del que sale la nota. */
  material?: Material[];
}): Promise<GenerateResult> {

  const tema = input.title.trim();
  const encargo = input.prompt.trim();
  const mat = materialParaPrompt(input.material);
  if (encargo.length < 20 && !mat) {
    return { ok: false, error: "Describe el tema con un poco más de detalle (mínimo 20 caracteres)." };
  }

  const refs = (input.references ?? []).filter((r) => /^https?:\/\//i.test(r.url)).slice(0, 8);
  const model = await getAiModel();
  if (!model) {
    return {
      ok: true,
      mode: "esquema",
      note:
        "Sin clave del modelo: no se redacta la noticia (sería inventar hechos). " +
        "Puedes añadirla en Configuración → Asistente. " +
        "Este es el esqueleto con su ficha de posicionamiento para que escribas encima.",
      draft: scaffold(tema, encargo, input.section),
    };
  }

  try {
    // 1) Respaldo: material del periodista y, si es escaso, una investigación web con fuentes. Sin respaldo no se escribe.
    const cuotaIA = await verificarCuotaIA(userId);
    if (!cuotaIA.ok) return { ok: false, error: cuotaIA.message };
    const suficiente = mat.length >= 2500 || encargo.length >= 600;
    const inv = suficiente && refs.length ? null : await investigarTema(userId, tema, encargo, input.section);
    if (!suficiente && !refs.length && !mat && !(inv && inv.sources.length)) {
      return { ok: false, error: "No encontré fuentes verificables para ese tema y no hay material tuyo (entrevista, enlaces o texto). Para no inventar información, no redacto la nota. Pega enlaces o el texto base, o precisa el tema." };
    }
    const fuentes = [...refs, ...(inv?.sources ?? [])].filter((r, i, a) => a.findIndex((y) => y.url === r.url) === i).slice(0, 10);
    const respaldo = [tema, encargo, mat, inv?.text ?? "", refs.map((r) => `${r.title} ${r.outlet}`).join(" ")].join("\n");

    const prompt = [
      tema ? `TÍTULO PROPUESTO POR EL PERIODISTA: ${tema}` : "El periodista no fijó título.",
      input.section ? `SECCIÓN: ${input.section}` : "",
      encargo ? `ENCARGO Y NOTAS:\n${encargo}` : "ENCARGO: redacta la nota a partir del material de partida.",
      mat ? `MATERIAL DE PARTIDA:\n${mat}` : "",
      inv?.text ? `DOSSIER VERIFICADO (búsqueda web con fuentes: ${inv.sources.map((x) => x.outlet).join(", ")}):\n${inv.text.slice(0, 7000)}` : "",
      refs.length
        ? `NOTICIAS DE REFERENCIA (las eligió el periodista): ${refs.map((r, i) => `[${i + 1}] ${r.outlet}: «${r.title}»`).join("; ")}. Atribúyelas en el texto («según …») sin copiar frases textuales: redacta con palabras propias.`
        : "",
      "REGLA DE ORO: la nota debe ser 100 % real y verificable. Usa SOLO hechos, cifras, fechas, nombres, cargos y declaraciones que consten en el encargo, el material o el dossier. Si algo no consta, NO lo escribas (no lo deduzcas, no lo redondees, no lo completes con conocimiento propio). Atribuye cada dato a su fuente en el texto («según el DANE, con corte a junio de 2026…»). La nota debe apoyarse en CIFRAS AUDITABLES: incluye las cifras clave que traiga el dossier o el material (mínimo tres cuando existan), cada una con su unidad, su periodo y la entidad que la publica, y nunca mezcles periodos o unidades sin decirlo. Sin citas textuales que no estén en el material. Es preferible una nota más corta y exacta que una larga con datos dudosos.",
    ]
      .filter(Boolean)
      .join("\n\n");
    let { object, usage } = await generateObject({ model, schema: draftSchema, system: EDITOR_ASSIST_SYSTEM, prompt });
    await registrarUsoIA(userId, usage);
    // Debe salir listo para publicar: si aun así trae marcadores {{…}}, un
    // segundo intento lo exige y, de persistir, se quitan.
    if (hasMarkers(object)) {
      ({ object, usage } = await generateObject({
        model,
        schema: draftSchema,
        system: EDITOR_ASSIST_SYSTEM,
        prompt: `${prompt}\n\nIMPORTANTE: tu borrador anterior traía marcadores entre llaves. Reescríbelo SIN ningún marcador: redacta solo con lo que sí consta en el encargo y omite lo que falte.`,
      }));
      await registrarUsoIA(userId, usage);
    }
    // 2) Verificación: toda cifra del cuerpo debe constar en el respaldo. Una segunda redacción corrige; lo que aún no conste se omite.
    let malas = cifrasSinRespaldo(object.body, respaldo);
    if (malas.length) {
      ({ object, usage } = await generateObject({
        model,
        schema: draftSchema,
        system: EDITOR_ASSIST_SYSTEM,
        prompt: `${prompt}\n\nCORRECCIÓN OBLIGATORIA: en tu borrador anterior estas cifras NO constan en el material ni en el dossier: ${malas.join(", ")}. Reescribe la nota sin ellas (o con las cifras que sí constan).`,
      }));
      await registrarUsoIA(userId, usage);
      malas = cifrasSinRespaldo(object.body, respaldo);
      object.body = sinCifrasInventadas(object.body, malas);
    }
    const draft = stripMarkers(object);
    if (fuentes.length) draft.body = `${draft.body}${fuentesHtml(fuentes)}`;
    return { ok: true, mode: "ia", draft };
  } catch (err) {
    console.error("generateArticleDraft:", err);
    // El mensaje del proveedor dice exactamente qué pasa («este modelo ya no
    // está disponible», «cuota agotada»…). Repetir un genérico obliga a ir a
    // los logs del servidor para algo que el editor puede resolver solo.
    const detalle =
      err && typeof err === "object" && "message" in err ? String((err as Error).message) : "";
    return {
      ok: false,
      error: detalle
        ? `El proveedor rechazó la petición: ${detalle.slice(0, 220)}`
        : "El modelo no respondió. Revisa la clave o inténtalo de nuevo en un momento.",
    };
  }
}

/** Cierra el cuerpo con las noticias de referencia enlazadas (señal de fuentes y evidencia). */
function fuentesHtml(refs: { title: string; outlet: string; url: string; videoId?: string }[]): string {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const videos = refs.filter((r) => r.videoId && /^[\w-]{6,20}$/.test(r.videoId));
  const incrustados = videos.length
    ? `<h2>Videos relacionados</h2>${videos
        .map((v) => `<p><iframe src="https://www.youtube-nocookie.com/embed/${v.videoId}" title="${esc(v.title)}" loading="lazy" allowfullscreen></iframe></p>`)
        .join("")}`
    : "";
  return `${incrustados}<h2>Fuentes consultadas</h2><ul>${refs
    .map((r) => `<li><a href="${esc(r.url)}" rel="noopener noreferrer" target="_blank">${esc(r.outlet ? `${r.outlet}: ` : "")}${esc(r.title)}</a></li>`)
    .join("")}</ul>`;
}

const MARKER = /\s*\{\{[^}]*\}\}/g;
const hasMarkers = (o: unknown) => JSON.stringify(o).includes("{{");
function stripMarkers<T>(o: T): T {
  return JSON.parse(JSON.stringify(o).replace(MARKER, "")) as T;
}

/** Esqueleto determinista: estructura y ficha, sin hechos inventados. */
function scaffold(tema: string, encargo: string, section?: string): GeneratedDraft {
  const terms = focusTerms(`${tema} ${encargo}`);
  const titulo = tema || `{{Titular}} sobre ${terms.slice(0, 3).join(", ") || "el tema"}`;
  const clave = terms.slice(0, 3).join(", ");

  return {
    title: titulo,
    excerpt: `{{Entradilla}}: qué pasó, dónde y por qué le importa al productor. Tema del encargo: ${encargo.slice(0, 120)}`,
    body: [
      `<p>{{Párrafo de apertura: el hecho principal con su cifra o fecha verificada.}}</p>`,
      `<h2>Qué dice la fuente</h2>`,
      `<p>{{Dato concreto y atribución: quién lo informó y cuándo.}}</p>`,
      `<h2>Qué significa para el productor</h2>`,
      `<p>{{Consecuencia práctica: costos, precios, sanidad o acceso a mercado.}}</p>`,
      `<h2>Qué sigue</h2>`,
      `<p>{{Próximo hito verificable: fecha, decisión pendiente o cifra esperada.}}</p>`,
    ].join("\n"),
    metaTitle: titulo.slice(0, 65),
    metaDescription: `{{Descripción}} en prosa de 70 a 155 caracteres sobre ${clave || "el tema"}.`,
    tags: terms.slice(0, 4),
    keywords: terms,
    seoOptions: [
      {
        metaTitle: titulo.slice(0, 65),
        metaDescription: `{{Qué pasó}} y qué cambia para el ganadero${section ? ` en ${section.toLowerCase()}` : ""}.`,
        rationale: "Enfoque informativo: responde la búsqueda directa del hecho.",
      },
      {
        metaTitle: `${clave || "Tema"}: {{cifra}} y qué implica`.slice(0, 65),
        metaDescription: `{{Dato concreto}} con contexto de mercado y fuente atribuida.`,
        rationale: "Enfoque de dato: capta a quien busca la cifra exacta.",
      },
      {
        metaTitle: `Lo que el alza de ${clave || "precios"} deja al productor`.slice(0, 65),
        metaDescription: `{{Consecuencia práctica}} para costos, precios o sanidad en finca.`,
        rationale: "Enfoque de interés: apela a la decisión del productor.",
      },
    ],
  };
}

// --- Regenerar una sola parte del borrador --------------------------------

export type DraftPart = "excerpt" | "tags" | "body" | "seo";

const PART_SCHEMAS = {
  excerpt: z.object({ excerpt: z.string().min(20).max(300) }),
  tags: z.object({ tags: z.array(z.string()).min(3).max(8) }),
  body: z.object({ body: z.string().min(50) }),
  seo: z.object({ metaTitle: z.string().min(8).max(70), metaDescription: z.string().min(50).max(170) }),
} as const;

const PART_TASK: Record<DraftPart, string> = {
  excerpt: "Escribe SOLO una nueva entradilla (2-3 líneas, 70-155 caracteres ideal) que explique por qué importa la noticia.",
  tags: "Propón SOLO un nuevo conjunto de 3 a 6 palabras clave o etiquetas, en minúsculas, específicas del tema. La primera debe ser la palabra clave principal.",
  body: "Redacta SOLO un nuevo cuerpo en HTML (<p>, <h2>), de al menos 250 palabras, con intertítulos. Sin llaves ni marcadores: el texto sale listo para publicar; si falta un dato, redacta sin él en vez de inventarlo.",
  seo: "Propón SOLO un nuevo título SEO (15-65 caracteres) y una meta descripción en prosa (70-155 caracteres).",
};

export type RegenerateResult =
  | { ok: true; part: DraftPart; value: Partial<Pick<GeneratedDraft, "excerpt" | "tags" | "body" | "metaTitle" | "metaDescription">> }
  | { ok: false; error: string };

/**
 * Regenera una parte del borrador (entradilla, palabras clave, cuerpo o ficha
 * SEO) sin tocar el resto. Recibe la versión actual para proponer otra
 * distinta. Como el borrador completo, nunca publica: devuelve texto al editor.
 */
export async function regenerateDraftPartCore(userId: string, input: {
  title: string;
  prompt: string;
  part: DraftPart;
  current: string;
  section?: string;
}): Promise<RegenerateResult> {
  const model = await getAiModel();
  if (!model) {
    return { ok: false, error: "Para regenerar hace falta la clave del modelo (Configuración → Asistente)." };
  }
  try {
    const cuotaIA = await verificarCuotaIA(userId);
    if (!cuotaIA.ok) return { ok: false, error: cuotaIA.message };
    const { object, usage: uso1 } = await generateObject({
      model,
      schema: PART_SCHEMAS[input.part],
      system: EDITOR_ASSIST_SYSTEM,
      prompt: [
        `TÍTULO: ${input.title.trim()}`,
        input.section ? `SECCIÓN: ${input.section}` : "",
        `ENCARGO Y NOTAS:\n${input.prompt.trim()}`,
        input.current ? `VERSIÓN ACTUAL (el editor la rechazó; propón otra claramente distinta):\n${input.current.slice(0, 4000)}` : "",
        `TAREA: ${PART_TASK[input.part]}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
    await registrarUsoIA(userId, uso1);
    return { ok: true, part: input.part, value: stripMarkers(object) };
  } catch (err) {
    console.error("regenerateDraftPart:", err);
    const detalle = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "";
    return { ok: false, error: detalle ? `El proveedor rechazó la petición: ${detalle.slice(0, 220)}` : "El modelo no respondió." };
  }
}

// --- Opciones de título y contexto a partir de un tema ----------------------

const optionsSchema = z.object({
  titles: z.array(z.string().min(15).max(90)).min(4).max(5),
  contexts: z
    .array(z.object({ label: z.string().min(3).max(60), text: z.string().min(40).max(700) }))
    .min(3)
    .max(4),
});

export type TitleContextOptions = z.infer<typeof optionsSchema>;

export type SuggestResult = ({ ok: true } & TitleContextOptions) | { ok: false; error: string };

/**
 * Del tema que da el periodista propone varios títulos y varios contextos
 * (enfoques de redacción) para que elija. No redacta la nota ni inventa
 * hechos: los contextos dicen QUÉ enfoque tomar y qué datos hay que
 * confirmar; lo que el periodista no aportó queda entre {{llaves}}.
 */
export async function suggestTitlesAndContextsCore(userId: string, input: {
  topic: string;
  section?: string;
  material?: Material[];
}): Promise<SuggestResult> {
  const topic = input.topic.trim();
  const mat = materialParaPrompt(input.material, 30_000);
  if (topic.length < 10 && !mat) return { ok: false, error: "Cuéntame el tema con un poco más de detalle (mínimo 10 caracteres)." };

  const model = await getAiModel();
  if (!model) {
    return { ok: false, error: "Para proponer opciones hace falta la clave del modelo (Configuración → Asistente)." };
  }
  try {
    const cuotaIA = await verificarCuotaIA(userId);
    if (!cuotaIA.ok) return { ok: false, error: cuotaIA.message };
    const { object, usage: uso2 } = await generateObject({
      model,
      schema: optionsSchema,
      system: EDITOR_ASSIST_SYSTEM,
      prompt: [
        input.section ? `SECCIÓN: ${input.section}` : "",
        topic ? `TEMA DEL PERIODISTA:\n${topic}` : "",
        mat ? `MATERIAL DE PARTIDA (entrevista o fuentes que cargó el periodista):\n${mat}` : "",
        "TAREA: propón entre 4 y 5 TÍTULOS distintos entre sí (de 15 a 65 caracteres; uno informativo con el hecho, uno con el dato, uno centrado en la consecuencia para el productor, uno en forma de pregunta o explicación). " +
          "Propón además entre 3 y 4 CONTEXTOS: cada uno es un enfoque de redacción distinto (p. ej. noticia de última hora, análisis para el productor, explicativo con antecedentes). " +
          "Cada contexto tiene una etiqueta corta y un texto de 2 a 4 frases que dice qué ángulo tomar, qué datos y fuentes hay que confirmar y a quién le importa. " +
          "NO inventes cifras, fechas, fuentes ni declaraciones y no uses llaves ni marcadores: si falta un dato, el contexto dice qué enfoque tomar sin él.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
    await registrarUsoIA(userId, uso2);
    return { ok: true, ...object };
  } catch (err) {
    console.error("suggestTitlesAndContexts:", err);
    const detalle = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "";
    return { ok: false, error: detalle ? `El proveedor rechazó la petición: ${detalle.slice(0, 220)}` : "El modelo no respondió." };
  }
}

// --- Gráfica con datos reales (Gemini + búsqueda en Google) ----------------

const chartSchema = z.object({
  enough: z.boolean().describe("false si el texto no trae cifras suficientes para una gráfica"),
  type: z.enum(["bar", "line", "pie"]),
  title: z.string(),
  unit: z.string(),
  labels: z.array(z.string()),
  series: z.array(z.object({ name: z.string(), values: z.array(z.number()) })),
  sourceNote: z.string().describe("Fuente y periodo de las cifras, tal como constan en el texto"),
});

export type ChartResult =
  | { ok: true; chart: ChartSpec; sourceNote: string; sources: { title: string; url: string }[]; svg: string }
  | { ok: false; error: string };

/**
 * Pide a Gemini, con búsqueda en Google, cifras reales y recientes del tema y
 * las convierte en una gráfica. Se rechaza si la búsqueda no devuelve fuentes
 * citables (regla de la casa: nada sin fuente) y la gráfica sale con sus
 * fuentes a la vista para que el periodista las verifique antes de insertarla.
 */
export async function generateChartCore(userId: string, input: { topic: string; section?: string; tipo?: TipoGrafica; /** Texto de la nota ya redactada: la gráfica debe ilustrar sus cifras y su hecho central. */ articulo?: string }): Promise<ChartResult> {
  const topic = input.topic.trim();
  if (topic.length < 10) return { ok: false, error: "Describe qué quieres graficar (mínimo 10 caracteres)." };

  const ai = await getGroundedAi();
  if (!ai) return { ok: false, error: "Falta la clave del modelo (Configuración → Asistente)." };
  if (ai === "otro-proveedor") {
    return { ok: false, error: "Las gráficas con datos reales usan Gemini: elige Google (Gemini) en Configuración → Asistente." };
  }

  try {
    const cuotaIA = await verificarCuotaIA(userId);
    if (!cuotaIA.ok) return { ok: false, error: cuotaIA.message };
    const hoy = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" }).format(new Date());
    const FUENTES =
      "Fuentes preferidas (en este orden): DANE, FEDEGAN (cifras de referencia del sector, Fondo Nacional del Ganado), ICA (censo pecuario), Ministerio de Agricultura (Agronet, SIPSA, UPRA, EVA), Banco de la República, Bolsa Mercantil, Fedegán/Fenavi/Asoleche, FAO (FAOSTAT), USDA, OCDE, Banco Mundial.";
    const REGLAS =
      "Devuelve SOLO cifras que aparezcan literalmente en las páginas que consultes, cada una con su unidad, periodo y fuente (nombre y página). Nunca estimes, interpoles, redondees ni inventes números; si una cifra no está, no la incluyas. Prefiere tablas y series históricas oficiales.";
    const buscar = async (system: string, prompt: string) => {
      const r = await generateText({ model: ai.model, tools: ai.tools as unknown as ToolSet, system, prompt });
      await registrarUsoIA(userId, r.usage);
      const src = r.sources
        .filter((x) => x.sourceType === "url")
        .map((x) => ({ title: (x.title || new URL(x.url).hostname).slice(0, 120), url: x.url }));
      return { text: r.text, src };
    };
    const sistema = `Eres un analista de datos de un medio ganadero colombiano. ${FUENTES} ${REGLAS}`;
    const nota = (input.articulo ?? "").replace(/\s+/g, " ").trim().slice(0, 3000);
    const sec = `${input.section ? `SECCIÓN: ${input.section}\n` : ""}${nota ? `NOTA YA REDACTADA (la gráfica debe ilustrar su hecho central y sus cifras): ${nota}\n` : ""}`;

    // Dos búsquedas en paralelo con ángulos distintos: la cifra exacta del tema y la serie oficial más cercana.
    const [exacta, serie] = await Promise.all([
      buscar(sistema, `Hoy es ${hoy}.\n${sec}TEMA A GRAFICAR: ${topic}\n\nBusca las cifras EXACTAS de ese tema (valores, periodo, fuente). Lista de 3 a 12 puntos comparables en el tiempo o entre categorías.`),
      buscar(sistema, `Hoy es ${hoy}.\n${sec}TEMA: ${topic}\n\nBusca la SERIE OFICIAL HISTÓRICA más cercana a ese tema (por ejemplo inventario bovino, sacrificio, precios por kilo o litro, producción, exportaciones, área, ocupación o afectaciones) con valores de varios años o meses consecutivos, en una misma unidad. Cita cada valor con su fuente.`),
    ]);
    let texto = `${exacta.text}\n\n${serie.text}${nota ? `\n\nCIFRAS DE LA NOTA REDACTADA:\n${nota}` : ""}`;
    let allSrc = [...exacta.src, ...serie.src];

    const armar = async (material: string, estricto: boolean) => {
      const { object, usage } = await generateObject({
        model: ai.model,
        schema: chartSchema,
        prompt: `Con SOLO las cifras del siguiente texto (no agregues ninguna y no cambies ninguna: cada valor debe aparecer en el texto tal cual), arma la gráfica más adecuada (barras para comparar categorías, línea para evolución en el tiempo, torta SOLO para partes de un total). REGLAS DE LA GRÁFICA: (1) todos los valores deben ser de la MISMA magnitud y unidad y comparables entre sí: NUNCA mezcles hectáreas con cabezas de ganado o con pesos en el mismo gráfico; si el texto trae varias magnitudes, elige UNA y grafica solo esa; (2) prefiere una serie en el tiempo o categorías comparables, de 3 a 8 puntos; (3) etiquetas cortas (máx. 22 caracteres) sin repetir la unidad; (4) ordena las categorías de mayor a menor (si no son cronológicas); (5) title = una frase que diga qué muestra (no «Gráfica de…»), unit = la unidad con su periodo (p. ej. «Miles de cabezas, 2025»); (6) sourceNote = la(s) fuente(s) concretas de los datos; (7) la gráfica debe ser CONSECUENTE con la nota: ilustra su hecho central usando, de preferencia, las cifras que la propia nota ya presenta (constan en sus fuentes) y complementa solo con series oficiales del MISMO tema; nunca grafiques datos de otro asunto. ${estricto ? "Si el tema exacto no tiene serie, usa la serie oficial relacionada más cercana y deja claro en el title qué mide realmente (no digas que mide otra cosa). " : ""}Si no hay cifras suficientes y comparables marca enough=false.${input.tipo && input.tipo !== "auto" ? ` El periodista pidió una gráfica de tipo «${input.tipo}»: organiza los datos para que ese tipo tenga sentido.` : ""}\n\nTEMA: ${topic}\n\nTEXTO:\n${material.slice(0, 9000)}`,
      });
      await registrarUsoIA(userId, usage);
      return object;
    };
    /** Una cifra está respaldada si aparece en el texto de las fuentes (con formato latino o inglés, o escalada a miles/millones). */
    const respaldada = (v: number, t: string) => {
      const abs = Math.abs(v);
      const f = new Set<string>();
      for (const base of [abs, abs / 1000, abs / 1_000_000]) {
        if (!Number.isFinite(base) || base === 0) continue;
        for (const dec of [0, 1, 2]) {
          const n = Number(base.toFixed(dec));
          if (Math.abs(n - base) > base * 0.0005 + 1e-9) continue;
          for (const loc of ["es-CO", "en-US"]) f.add(n.toLocaleString(loc, { minimumFractionDigits: dec, maximumFractionDigits: dec }));
          f.add(n.toFixed(dec)); f.add(n.toFixed(dec).replace(".", ","));
        }
      }
      return [...f].some((x) => x.length > 0 && new RegExp(`(?<![\\d.,])${x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\d|[.,]\\d)`).test(t));
    };
    const verificada = (o: Awaited<ReturnType<typeof armar>>, t: string) => {
      const vals = o.series.flatMap((x) => x.values);
      if (!vals.length) return false;
      return vals.filter((v) => respaldada(v, t)).length / vals.length >= 0.8;
    };

    let object = await armar(texto, false);
    if (!object.enough || !verificada(object, texto)) {
      // Segundo intento: búsqueda más amplia (datos macro del sector) y reglas más flexibles con el tema, nunca con los números.
      const amplia = await buscar(
        sistema,
        `Hoy es ${hoy}.\n${sec}TEMA DE LA NOTA: ${topic}\n\nNo encontré cifras exactas. Busca en las fuentes oficiales (DANE, FEDEGAN, ICA, Agronet/SIPSA, FAO) los datos del sector ganadero colombiano (o mundial si aplica) MÁS RELACIONADOS con ese tema que tengan una serie anual o mensual de 4 o más valores (inventario, precios, producción, exportaciones, sacrificio, leche acopiada, clima/área afectada). Copia los valores tal cual con su fuente y año.`,
      );
      texto = `${texto}\n\n${amplia.text}`;
      allSrc = [...allSrc, ...amplia.src];
      object = await armar(texto, true);
    }
    const sources = allSrc.filter((x, k, arr) => arr.findIndex((y) => y.url === x.url) === k).slice(0, 8);
    if (!sources.length) {
      return { ok: false, error: "La búsqueda no devolvió fuentes citables para ese tema, así que no se genera la gráfica. Prueba describiendo el dato concreto (p. ej. «inventario bovino de Colombia 2019–2024»)." };
    }
    if (!object.enough) return { ok: false, error: "Busqué en fuentes oficiales (DANE, FEDEGAN, ICA, FAO…) y no hallé una serie de cifras comparables para ese tema. Prueba con el dato concreto que quieres mostrar, por ejemplo «precio del kilo de novillo gordo en 2025» o «exportaciones de carne bovina de Colombia 2020–2024»." };
    if (!verificada(object, texto)) return { ok: false, error: "Encontré cifras, pero no pude confirmar que cada valor aparezca en las fuentes citadas, así que no genero la gráfica (regla de la casa: solo datos verificables). Prueba con un dato más concreto o inserta la gráfica manual con tus cifras." };

    const base: ChartSpec = { type: object.type, title: object.title.slice(0, 110), unit: object.unit.slice(0, 70), labels: object.labels.slice(0, 12).map((l) => l.slice(0, 30)), series: object.series.slice(0, 4), source: object.sourceNote.slice(0, 160) };
    // Si quien redacta eligió una forma concreta (torta, histograma…), se aplica sobre los datos encontrados.
    const forma = aplicarTipo(base, input.tipo ?? "auto");
    if (!forma.ok) return { ok: false, error: forma.error };
    const chart = forma.chart;
    const problem = chartProblem(chart);
    if (problem) return { ok: false, error: `Los datos no sirven para graficar: ${problem}` };
    return { ok: true, chart, sourceNote: object.sourceNote.slice(0, 160), sources, svg: renderChartSvg(chart) };
  } catch (err) {
    console.error("generateChart:", err);
    const detalle = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "";
    return { ok: false, error: detalle ? `No se pudo generar la gráfica: ${detalle.slice(0, 220)}` : "El modelo no respondió." };
  }
}

/* --------------------------------------------------------------------------
 * Temas sugeridos por la IA a partir de la tendencia en internet
 * -------------------------------------------------------------------------- */

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

export type TopicIdea = z.infer<typeof topicIdeasSchema>["ideas"][number];

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

export type NewsSearchResult = { ok: true; items: NewsItem[] } | { ok: false; error: string };

/** Id de un video de YouTube a partir de su enlace (watch, youtu.be, shorts, embed). */
function youtubeId(url: string): string | undefined {
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
async function resolverEnlace(url: string): Promise<string> {
  if (!/vertexaisearch\.cloud\.google\.com|grounding-api-redirect/.test(url)) return url;
  try {
    const r = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(4000) });
    const loc = r.headers.get("location");
    return loc && /^https?:\/\//i.test(loc) ? loc : url;
  } catch {
    return url;
  }
}

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

/** Costo estimado por imagen generada (USD); se descuenta de la cuota mensual de la persona. */
const COSTO_IMAGEN_USD = 0.12;

export type CoverImageResult =
  | { ok: true; url: string; alt: string; scene: string }
  | { ok: false; error: string };

/**
 * Genera la portada a partir del tema de la nota: primero el modelo de texto redacta la escena
 * (fotográfica, sin texto, sin personas reales identificables) y luego el modelo de imagen la pinta
 * en 16:9. Se sube al mismo almacenamiento que las fotos y se etiqueta como generada con IA.
 */
export async function generateCoverImageCore(userId: string, input: {
  title: string;
  excerpt?: string;
  section?: string;
  /** Cuerpo de la nota (HTML o texto): la escena sale de lo que la nota realmente cuenta. */
  body?: string;
  /** Escena escrita por el periodista (opcional): manda sobre la que propondría el modelo. */
  scene?: string;
}): Promise<CoverImageResult> {
  const title = input.title.trim();
  if (title.length < 5 && !(input.scene ?? "").trim()) {
    return { ok: false, error: "Escribe primero el título de la nota (o describe la escena) para generar la imagen." };
  }
  const imageModel = await getImageAi();
  if (!imageModel) return { ok: false, error: "Falta la clave del modelo (Configuración → Asistente)." };
  if (imageModel === "otro-proveedor") {
    return { ok: false, error: "Las imágenes se generan con Gemini: elige Google (Gemini) en Configuración → Asistente." };
  }
  const text = await getAiModel();
  try {
    const cuota = await verificarCuotaIA(userId);
    if (!cuota.ok) return { ok: false, error: cuota.message };

    let scene = (input.scene ?? "").trim();
    if (!scene && text) {
      const r = await generateText({
        model: text,
        system:
          "Eres director de fotografía de un medio ganadero colombiano. Escribes UNA escena fotográfica concreta, en español, de 1-2 frases, que ilustre EXACTAMENTE lo que cuenta la noticia (su hecho central, el lugar, los animales, la actividad o la situación que menciona el texto; si habla de sequía, muestra potreros resecos; si habla de exportación, corrales o embarque; si habla de precios, subasta o feria ganadera; nunca una escena genérica que podría ir en cualquier nota). Ilustra: ganadería, paisaje, animales, trabajadores vistos de espaldas o lejos, instalaciones, mercados, clima. Sin texto en la imagen. NUNCA retrates a una persona real identificable (políticos, empresarios, figuras públicas): usa personas anónimas de espaldas, siluetas o planos generales. Sin logotipos ni marcas. OBLIGATORIO: todo es COLOMBIANO. Si aparecen personas, son campesinos y ganaderos colombianos (rasgos mestizos latinoamericanos, sombrero aguadeño o de paja, ruana, poncho, carriel, botas de caucho, ropa de trabajo de campo), anónimos y vistos de espaldas o a distancia. El paisaje es reconocible de Colombia (potreros y sabanas de los Llanos Orientales, sabana de Córdoba y Sucre, montaña andina con cafetales, valles del Cauca, páramo, Caribe colombiano, cordilleras al fondo) y nunca de otros países (ni praderas de Estados Unidos, ni campo europeo, ni africano). Razas y entorno propios del trópico colombiano (cebú, brahman, criollo, Holstein de altiplano).",
        prompt: `TÍTULO: ${title}\n${input.excerpt ? `RESUMEN: ${input.excerpt.slice(0, 400)}\n` : ""}${input.section ? `SECCIÓN: ${input.section}\n` : ""}${input.body ? `CONTENIDO DE LA NOTA:\n${input.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 1800)}\n` : ""}\nDescribe la escena que mejor ilustra el hecho central de esta nota.`,
      });
      await registrarUsoIA(userId, r.usage);
      scene = r.text.trim().replace(/^["«]|["»]$/g, "");
    }
    if (!scene) scene = `Paisaje ganadero colombiano relacionado con: ${title}`;

    const prompt =
      `Fotografía fotorrealista con estética de fotograma de cine que ilustra la noticia «${title}»${input.excerpt ? ` (${input.excerpt.slice(0, 220)})` : ""}. La imagen debe mostrar de forma inequívoca el tema de la nota, no una escena genérica: ${scene}. ` +
      "Máxima nitidez y detalle, resolución muy alta, sin compresión ni pixelado. Iluminación natural cinematográfica (luz dorada o contraluz suave), lente anamórfica de 35 mm, poca profundidad de campo, " +
      "grano de película sutil, colores naturales y ricos, composición editorial amplia en formato horizontal 16:9. " +
      "Ambientación 100 % colombiana: paisaje de Colombia (Llanos Orientales, sabana caribeña, montaña andina, valles, páramo) y, si hay personas, campesinos y ganaderos colombianos anónimos, de espaldas o a distancia, con sombrero, ruana o poncho y botas de caucho; nada de paisajes ni personas de otros países. " +
      "Sin texto, sin letras, sin logotipos, sin marcas de agua. Sin personas reales identificables.";

    // Alta resolución (2K ≈ 2752×1536): a pantalla completa una imagen de 1K se pixela. Si el modelo
    // de 2K no está disponible, se cae al anterior (1K) en vez de fallar.
    let image;
    try {
      ({ image } = await generateImage({
        model: imageModel,
        prompt,
        aspectRatio: "16:9",
        providerOptions: { google: { imageConfig: { imageSize: "2K" } } },
      }));
    } catch (e) {
      console.warn("generateCoverImage: falló el modelo de 2K, uso el de 1K:", e);
      const respaldo = await getImageAi("gemini-2.5-flash-image");
      if (!respaldo || respaldo === "otro-proveedor") throw e;
      ({ image } = await generateImage({ model: respaldo, prompt, aspectRatio: "16:9" }));
    }
    await registrarCostoIA(userId, COSTO_IMAGEN_USD);
    const mime = image.mediaType === "image/jpeg" ? "image/jpeg" : image.mediaType === "image/webp" ? "image/webp" : "image/png";
    const up = await subirImagenBytes(image.uint8Array, mime);
    if (!up.ok) return { ok: false, error: up.error };
    return { ok: true, url: up.url, alt: `${PREFIJO_IMAGEN_IA} ${scene}`.slice(0, 300), scene };
  } catch (err) {
    console.error("generateCoverImage:", err);
    const detalle = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "";
    return { ok: false, error: detalle ? `No se pudo generar la imagen: ${detalle.slice(0, 220)}` : "El modelo de imagen no respondió." };
  }
}

/* --------------------------------------------------------------------------
 * Material de partida: entrevista de voz transcrita y enlaces leídos
 * -------------------------------------------------------------------------- */

export type MaterialResult = { ok: true; material: Material } | { ok: false; error: string };
export type EnlacesResult = { ok: true; materiales: Material[]; fallidos: string[] } | { ok: false; error: string };

const AUDIO_MIME: Record<string, string> = {
  mp3: "audio/mpeg", mpeg: "audio/mpeg", m4a: "audio/mp4", mp4: "audio/mp4", aac: "audio/aac",
  wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/ogg", webm: "audio/webm", flac: "audio/flac",
};
/** Tope del audio que se envía al modelo en una sola petición (límite práctico de Gemini en línea). */
const MAX_AUDIO = 20 * 1024 * 1024;

function mimeAudio(name: string, declared: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (AUDIO_MIME[ext]) return AUDIO_MIME[ext];
  if (declared.startsWith("audio/")) return declared === "audio/x-m4a" || declared === "audio/m4a" ? "audio/mp4" : declared;
  return null;
}

async function transcribir(userId: string, bytes: Uint8Array, mime: string, nombre: string): Promise<MaterialResult> {
  const model = await getAiModel();
  if (!model) return { ok: false, error: "Falta la clave del modelo (Configuración → Asistente)." };
  const settingsOk = await getImageAi(); // solo para distinguir proveedor: «otro-proveedor» = no es Google
  if (settingsOk === "otro-proveedor") {
    return { ok: false, error: "Transcribir audio usa Gemini: elige Google (Gemini) en Configuración → Asistente." };
  }
  const cuota = await verificarCuotaIA(userId);
  if (!cuota.ok) return { ok: false, error: cuota.message };
  const r = await generateText({
    model,
    system:
      "Eres transcriptor profesional de un medio periodístico colombiano. Transcribes entrevistas con fidelidad: texto literal en el idioma hablado, con puntuación correcta, párrafos por intervención y, cuando se distingan voces, marcas «Entrevistador:» / «Entrevistado:» (o el nombre si se menciona). No resumas, no corrijas lo dicho, no inventes lo inaudible: márcalo como [inaudible].",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Transcribe completa esta entrevista de audio." },
          { type: "file", data: bytes, mediaType: mime },
        ],
      },
    ],
  });
  await registrarUsoIA(userId, r.usage);
  const text = r.text.trim();
  if (text.length < 20) return { ok: false, error: "No se pudo transcribir el audio (¿está vacío o ilegible?)." };
  return { ok: true, material: { kind: "entrevista", title: `Entrevista: ${nombre.replace(/\.[a-z0-9]+$/i, "").slice(0, 80)}`, text } };
}

/** Audio pequeño: llega directo en el formulario (el límite de Vercel para cuerpos de petición es ~4,5 MB). */
export async function transcribirEntrevistaCore(userId: string, formData: FormData): Promise<MaterialResult> {
  const f = formData.get("audio");
  if (!(f instanceof File) || f.size === 0) return { ok: false, error: "No llegó ningún audio." };
  const mime = mimeAudio(f.name, f.type);
  if (!mime) return { ok: false, error: "Formato de audio no admitido. Usa MP3, M4A, WAV, OGG, WEBM, AAC o FLAC." };
  if (f.size > MAX_AUDIO) return { ok: false, error: `El audio pesa ${(f.size / 1048576).toFixed(1)} MB; el máximo son 20 MB. Recórtalo o comprímelo.` };
  try {
    return await transcribir(userId, new Uint8Array(await f.arrayBuffer()), mime, f.name);
  } catch (err) {
    console.error("transcribirEntrevista:", err);
    const d = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "";
    return { ok: false, error: d ? `No se pudo transcribir: ${d.slice(0, 220)}` : "El modelo no respondió." };
  }
}

/** Audio grande: se sube directo al almacenamiento con una URL firmada y aquí solo se pide su transcripción. */
export async function crearSubidaAudioCore(userId: string, input: { name: string; type: string; size: number }): Promise<
  { ok: true; uploadUrl: string; path: string } | { ok: false; error: string }
> {
  const mime = mimeAudio(input.name, input.type);
  if (!mime) return { ok: false, error: "Formato de audio no admitido. Usa MP3, M4A, WAV, OGG, WEBM, AAC o FLAC." };
  if (input.size > MAX_AUDIO) return { ok: false, error: `El audio pesa ${(input.size / 1048576).toFixed(1)} MB; el máximo son 20 MB.` };
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, error: "Para audios grandes falta configurar SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY." };
  const ext = input.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "mp3";
  const path = `entrevistas/${crypto.randomUUID()}.${ext}`;
  const res = await fetch(`${url}/storage/v1/object/upload/sign/media/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) return { ok: false, error: `No se pudo preparar la subida (${res.status}).` };
  const data = (await res.json()) as { url?: string };
  if (!data.url) return { ok: false, error: "Supabase no devolvió la dirección de subida." };
  return { ok: true, uploadUrl: data.url.startsWith("http") ? data.url : `${url}/storage/v1${data.url}`, path };
}

export async function transcribirEntrevistaSubidaCore(userId: string, input: { path: string; name: string }): Promise<MaterialResult> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !/^entrevistas\/[\w-]+\.[a-z0-9]+$/.test(input.path)) return { ok: false, error: "Subida no válida." };
  const mime = mimeAudio(input.path, "");
  if (!mime) return { ok: false, error: "Formato de audio no admitido." };
  try {
    const r = await fetch(`${url}/storage/v1/object/media/${input.path}`, { headers: { Authorization: `Bearer ${key}`, apikey: key } });
    if (!r.ok) return { ok: false, error: `No se pudo leer el audio subido (${r.status}).` };
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.length > MAX_AUDIO) return { ok: false, error: "El audio supera 20 MB." };
    return await transcribir(userId, bytes, mime, input.name);
  } catch (err) {
    console.error("transcribirEntrevistaSubida:", err);
    const d = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "";
    return { ok: false, error: d ? `No se pudo transcribir: ${d.slice(0, 220)}` : "El modelo no respondió." };
  } finally {
    // La entrevista es privada y el bucket es público: se borra apenas se transcribe.
    void fetch(`${url}/storage/v1/object/media/${input.path}`, { method: "DELETE", headers: { Authorization: `Bearer ${key}`, apikey: key } }).catch(() => {});
  }
}

/* --- Lectura de enlaces --------------------------------------------------- */

function ipPrivada(ip: string): boolean {
  if (ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80") || ip === "::") return true;
  const m = ip.match(/^(?:::ffff:)?(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

const decodeHtml = (s: string) =>
  s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

function htmlATexto(html: string): { title: string; text: string } {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const tt = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const title = decodeHtml((og || tt || "").replace(/\s+/g, " ").trim()).slice(0, 200);
  let cuerpo = html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  cuerpo = cuerpo
    .replace(/<(script|style|noscript|svg|nav|footer|header|aside|form|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|h[1-6]|li|br|tr|section|blockquote)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = decodeHtml(cuerpo).replace(/[ \t\f\v]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").replace(/ *\n */g, "\n").trim();
  return { title, text };
}

async function leerUnEnlace(raw: string): Promise<Material | null> {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  // Protección SSRF: nada de direcciones internas.
  const { lookup } = await import("node:dns/promises");
  const dirs = await lookup(u.hostname, { all: true }).catch(() => []);
  if (!dirs.length || dirs.some((d) => ipPrivada(d.address))) return null;
  const r = await fetch(u, {
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
    headers: { "user-agent": "Mozilla/5.0 (compatible; CONtextoGanadero-Redaccion/1.0)", accept: "text/html,application/xhtml+xml" },
  });
  if (!r.ok) return null;
  const tipo = r.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml|text\/plain/.test(tipo)) return null;
  const html = (await r.text()).slice(0, 2_000_000);
  const { title, text } = tipo.includes("text/plain") ? { title: u.hostname, text: html } : htmlATexto(html);
  if (text.length < 200) return null;
  return { kind: "enlace", title: title || u.hostname, text: text.slice(0, 30_000), url: u.toString() };
}

/** Lee hasta 5 enlaces (una por línea): extrae titular y texto principal para redactar a partir de ellos. */
export async function leerEnlacesCore(userId: string, input: { urls: string }): Promise<EnlacesResult> {
  const urls = [...new Set(input.urls.split(/[\s,]+/).map((x) => x.trim()).filter((x) => /^https?:\/\//i.test(x)))].slice(0, 5);
  if (!urls.length) return { ok: false, error: "Pega al menos un enlace que empiece por http:// o https://." };
  const res = await Promise.all(urls.map((u) => leerUnEnlace(u).catch(() => null)));
  const materiales = res.filter((m): m is Material => m !== null);
  const fallidos = urls.filter((_, i) => !res[i]);
  if (!materiales.length) {
    return { ok: false, error: "No se pudo leer ningún enlace (puede estar protegido, ser un video o exigir suscripción). Pega el texto en el cuadro de tema." };
  }
  return { ok: true, materiales, fallidos };
}

/** Transcribe un audio ya descargado (bytes): lo usa el bot de Telegram. */
export async function transcribirAudioBytesCore(userId: string, bytes: Uint8Array, mime: string, nombre: string): Promise<MaterialResult> {
  const m = mimeAudio(nombre, mime) ?? (mime.startsWith("audio/") ? mime : null);
  if (!m) return { ok: false, error: "Formato de audio no admitido." };
  try {
    return await transcribir(userId, bytes, m, nombre);
  } catch (err) {
    console.error("transcribirAudioBytes:", err);
    const d = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "";
    return { ok: false, error: d ? `No se pudo transcribir: ${d.slice(0, 220)}` : "El modelo no respondió." };
  }
}
