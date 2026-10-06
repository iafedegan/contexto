import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import { EDITOR_ASSIST_SYSTEM } from "@/agents/prompts";
import { focusTerms } from "@/lib/seo-audit";
import { getAiModel } from "@/lib/ai-provider";
import { materialParaPrompt, type Material } from "@/lib/material-types";
import { registrarUsoIA, verificarCuotaIA } from "@/lib/ai-cuota";
import { escapeHtml as esc } from "@/lib/escape";
import { investigarTema } from "@/lib/ai/investigacion";
import { cifrasSinRespaldo, citasSinRespaldo, sinCifrasInventadas, sinCitasInventadas } from "@/lib/ai/verificacion";


// Forma que debe tener el borrador que devuelve el modelo: título, resumen, cuerpo, ficha SEO, etiquetas, palabras clave y variantes de ficha.
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

// Borrador generado, tipado a partir del esquema.
export type GeneratedDraft = z.infer<typeof draftSchema>;

// Resultado de generar un borrador: el borrador y su modo (IA o esquema de respaldo), o un error.
export type GenerateResult =
  | { ok: true; mode: "ia" | "esquema"; draft: GeneratedDraft; note?: string }
  | { ok: false; error: string };

/** Cómo mantener la nota sobre su tema y cómo citar a las fuentes: va en la generación completa y en la reescritura del cuerpo. */
const REGLAS_ENFOQUE_Y_CITAS = [
  "ENFOQUE (obligatorio): la nota desarrolla EXACTAMENTE el hecho del título y del encargo. Abre con ese hecho; cada párrafo siguiente debe explicarlo, ampliarlo o dar su contexto directo, y enlazarse con el anterior con una frase puente. Las cifras y el contexto del sector entran solo si ayudan a entender ESE hecho; no cambies de tema, no abras secciones sobre asuntos distintos y no rellenes con estadísticas generales.",
  "CITAS (obligatorio cuando existan): incluye de 2 a 4 citas textuales de las declaraciones literales que consten en el material o en el dossier (o en el texto de las noticias de referencia). Cada una va entre comillas angulares «…», copiada EXACTAMENTE, atribuida a quien la dijo con su cargo («dijo …», «según …») y con la frase clave dentro de <strong>…</strong>. Una cita larga puede ir en un <blockquote><p>…</p></blockquote>. Si no hay declaraciones literales, NO inventes ninguna: parafrasea y atribuye.",
].join("\n");

// Genera el borrador de una nota con el modelo a partir del tema, el contexto y el material; si no hay modelo o falla, devuelve un esquema determinista. Verifica que las cifras del texto existan en las fuentes.
export async function generateArticleDraftCore(userId: string, input: {
  title: string;
  prompt: string;
  section?: string;
  /** Noticias que el periodista eligió referenciar: se citan con enlace en el cuerpo. */
  references?: { title: string; outlet: string; url: string; videoId?: string }[];
  /** Entrevista transcrita o texto de enlaces: material primario del que sale la nota. */
  material?: Material[];
  /** Indicaciones del editor sobre cómo escribir (tono, estructura, qué incluir o evitar). Tienen prioridad. */
  instrucciones?: string;
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
      input.instrucciones?.trim() ? `INSTRUCCIONES DEL EDITOR (síguelas con prioridad sobre el estilo por defecto, sin inventar hechos):\n${input.instrucciones.trim().slice(0, 1500)}` : "",
      REGLAS_ENFOQUE_Y_CITAS,
      "REGLA DE ORO: la nota debe ser 100 % real y verificable. Usa SOLO hechos, cifras, fechas, nombres, cargos y declaraciones que consten en el encargo, el material o el dossier. Si algo no consta, NO lo escribas (no lo deduzcas, no lo redondees, no lo completes con conocimiento propio). Atribuye cada dato a su fuente en el texto («según el DANE, con corte a junio de 2026…»). La nota debe apoyarse en CIFRAS AUDITABLES: incluye las cifras clave que traiga el dossier o el material (mínimo tres cuando existan), cada una con su unidad, su periodo y la entidad que la publica, y nunca mezcles periodos o unidades sin decirlo. Es preferible una nota más corta y exacta que una larga con datos dudosos.",
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
    // 3) Citas: una cita entre comillas solo se queda si aparece literalmente en el respaldo.
    let citasMalas = citasSinRespaldo(object.body, respaldo);
    if (citasMalas.length) {
      ({ object, usage } = await generateObject({
        model,
        schema: draftSchema,
        system: EDITOR_ASSIST_SYSTEM,
        prompt: `${prompt}\n\nCORRECCIÓN OBLIGATORIA: estas citas de tu borrador NO aparecen textualmente en el material ni en el dossier: ${citasMalas.map((c) => `«${c}»`).join(" | ")}. Cítalas exactamente como constan o parafrasea sin comillas.`,
      }));
      await registrarUsoIA(userId, usage);
      citasMalas = citasSinRespaldo(object.body, respaldo);
      object.body = sinCitasInventadas(object.body, citasMalas);
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
  const videos = refs.filter((r) => r.videoId && /^[\w-]{6,20}$/.test(r.videoId));
  const incrustados = videos.length
    ? `<h2>Videos relacionados</h2>${videos
        .map((v) => `<p><iframe src="https://www.youtube-nocookie.com/embed/${v.videoId}" title="${esc(v.title)}" loading="lazy" allowfullscreen></iframe></p>`)
        .join("")}`
    : "";
  // Las fuentes van en un desplegable que SIEMPRE llega cerrado (sin el atributo `open`; el saneado no lo permite).
  const item = (r: { title: string; outlet: string; url: string }) => {
    const titulo = r.title.replace(new RegExp(`^${r.outlet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*`, "i"), "");
    const etiqueta = !r.outlet || titulo.toLowerCase() === r.outlet.toLowerCase() ? titulo || r.url : `${titulo} — ${r.outlet}`;
    return `<li><a href="${esc(r.url)}" rel="noopener noreferrer" target="_blank">${esc(etiqueta)}</a></li>`;
  };
  return `${incrustados}<details><summary>Fuentes consultadas (${refs.length})</summary><ul>${refs.map(item).join("")}</ul></details>`;
}

// Marcadores de relleno entre llaves dobles que el modelo a veces deja en el texto.
const MARKER = /\s*\{\{[^}]*\}\}/g;

// Indica si un objeto todavía contiene algún marcador de relleno.
const hasMarkers = (o: unknown) => JSON.stringify(o).includes("{{");

// Quita los marcadores de relleno de todos los textos de un objeto.
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

// Esquema de cada parte del borrador que se puede regenerar por separado.
const PART_SCHEMAS = {
  excerpt: z.object({ excerpt: z.string().min(20).max(300) }),
  tags: z.object({ tags: z.array(z.string()).min(3).max(8) }),
  body: z.object({ body: z.string().min(50) }),
  seo: z.object({ metaTitle: z.string().min(8).max(70), metaDescription: z.string().min(50).max(170) }),
} as const;

// Instrucción que se le da al modelo para regenerar cada parte.
const PART_TASK: Record<DraftPart, string> = {
  excerpt: "Escribe SOLO una nueva entradilla (2-3 líneas, 70-155 caracteres ideal) que explique por qué importa la noticia.",
  tags: "Propón SOLO un nuevo conjunto de 3 a 6 palabras clave o etiquetas, en minúsculas, específicas del tema. La primera debe ser la palabra clave principal.",
  body: "Redacta SOLO un nuevo cuerpo en HTML (<p>, <h2>, <strong>, <blockquote>), de al menos 250 palabras, con intertítulos. Conserva el bloque <details> de «Fuentes consultadas» si la versión actual lo trae. Sin llaves ni marcadores: el texto sale listo para publicar; si falta un dato, redacta sin él en vez de inventarlo.",
  seo: "Propón SOLO un nuevo título SEO (15-65 caracteres) y una meta descripción en prosa (70-155 caracteres).",
};

// Resultado de regenerar una parte: su valor nuevo o un error.
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
  /** Indicaciones del editor sobre cómo escribir esta parte. Tienen prioridad. */
  instrucciones?: string;
  /** Entrevista o texto de enlaces del que sale la nota (para citar y no salirse del tema). */
  material?: Material[];
}): Promise<RegenerateResult> {
  const model = await getAiModel();
  if (!model) {
    return { ok: false, error: "Para regenerar hace falta la clave del modelo (Configuración → Asistente)." };
  }
  try {
    const cuotaIA = await verificarCuotaIA(userId);
    if (!cuotaIA.ok) return { ok: false, error: cuotaIA.message };
    const mat = materialParaPrompt(input.material);
    const instr = input.instrucciones?.trim() ?? "";
    const prompt = [
      `TÍTULO: ${input.title.trim()}`,
      input.section ? `SECCIÓN: ${input.section}` : "",
      `ENCARGO Y NOTAS:\n${input.prompt.trim()}`,
      mat ? `MATERIAL DE PARTIDA:\n${mat}` : "",
      input.current
        ? `VERSIÓN ACTUAL (${instr ? "reescríbela aplicando las instrucciones del editor" : "el editor la rechazó; propón otra claramente distinta"}; los hechos, cifras y citas solo pueden salir de aquí, del encargo o del material, no inventes otros):\n${input.current.slice(0, 9000)}`
        : "",
      instr ? `INSTRUCCIONES DEL EDITOR (síguelas con prioridad sobre el estilo por defecto, sin inventar hechos):\n${instr.slice(0, 1500)}` : "",
      input.part === "body" ? REGLAS_ENFOQUE_Y_CITAS : "",
      `TAREA: ${PART_TASK[input.part]}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    const { object, usage: uso1 } = await generateObject({ model, schema: PART_SCHEMAS[input.part], system: EDITOR_ASSIST_SYSTEM, prompt });
    await registrarUsoIA(userId, uso1);
    const value: Partial<GeneratedDraft> = stripMarkers(object);
    // El cuerpo reescrito también pasa por la verificación: sin cifras ni citas que no consten en lo que se le dio.
    if (value.body) {
      const respaldo = [input.title, input.prompt, mat, input.current].join("\n");
      value.body = sinCitasInventadas(sinCifrasInventadas(value.body, cifrasSinRespaldo(value.body, respaldo)), citasSinRespaldo(value.body, respaldo));
    }
    return { ok: true, part: input.part, value };
  } catch (err) {
    console.error("regenerateDraftPart:", err);
    const detalle = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "";
    return { ok: false, error: detalle ? `El proveedor rechazó la petición: ${detalle.slice(0, 220)}` : "El modelo no respondió." };
  }
}

// --- Opciones de título y contexto a partir de un tema ----------------------
