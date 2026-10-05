"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  AreaChart,
  BarChart3,
  BarChartHorizontal,
  BarChart4,
  Donut,
  LineChart,
  PieChart,
  Wand2,
  CalendarClock,
  Check,
  Eye,
  ImagePlus,
  Loader2,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { autosaveDraft, saveArticle } from "@/app/panel/(app)/articulos/actions";
import { uploadMedia } from "@/app/panel/(app)/articulos/media-actions";
import {
  generateArticleDraft,
  regenerateDraftPart,
  suggestTitlesAndContexts,
  suggestTopicIdeas,
  searchNewsAbout,
  generateCoverImage,
  transcribirEntrevista,
  crearSubidaAudio,
  transcribirEntrevistaSubida,
  leerEnlaces,
  type TopicIdea,
  type NewsItem,
  generateChart,
  type ChartResult,
  type DraftPart,
  type TitleContextOptions,
} from "@/app/panel/(app)/articulos/ai-actions";
import { SectionTree } from "@/components/panel/section-picker";
import { Carrusel, filasListas, useAltoVentana } from "@/components/panel/carrusel";
import { textoDeSegmentos, type Material, type Participante, type Segmento } from "@/lib/material-types";
import { participantesListos, SegmentosEditor } from "@/components/panel/entrevista-editor";
import { SiteArticlePreview, type SitePreviewChrome } from "@/components/panel/site-article-preview";
import { FuenteCards, PantallaEnlaces, PantallaEntrevista, PantallaIdeas, PantallaNoticias, type Fuente } from "@/components/panel/wizard-fuentes";
import { WizardStepper } from "@/components/panel/wizard-stepper";
import { duracionWav, esVideo, ExtraerAudioError, extraerAudioDeVideo, partirWav } from "@/lib/audio-extract";
import { aplicarTipo, decodeSpec, encodeSpec, renderChartSvg, svgDataUri, TIPOS_GRAFICA, type ChartSpec, type TipoGrafica } from "@/lib/chart-svg";
import { InteractiveChart } from "@/components/interactive-chart";
import { auditArticle, scoreLabel, type AuditItem, type AuditResult } from "@/lib/seo-audit";
import { escapeMinimo as escapeHtml } from "@/lib/escape";
import { ESTADO_LABEL as STATUS_LABEL } from "@/lib/estados";

// Opción de un selector: id y nombre.
type Option = { id: string; name: string };

// Datos iniciales de la nota que abre el asistente.
export type WizardInitial = {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  tags: string[];
  categoryId: string | null;
  authorId: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  isBreaking?: boolean;
  isLive?: boolean;
  /** Lugar fijado en la portada del sitio (0 = principal, 1 = segunda), si lo hay. */
  homePosition?: number | null;
};

// Pasos del asistente en modo manual.
const STEPS_MANUAL = [
  { key: "titulo", label: "Título" },
  { key: "resumen", label: "Resumen" },
  { key: "claves", label: "Palabras clave" },
  { key: "portada", label: "Imagen" },
  { key: "seccion", label: "Sección y autor" },
  { key: "cuerpo", label: "Cuerpo" },
  { key: "grafica", label: "Gráfica" },
  { key: "seo", label: "Buscadores" },
  { key: "vista", label: "Vista previa" },
] as const;

// Identificador de un paso del asistente.
type StepKey = (typeof STEPS_MANUAL)[number]["key"] | "tema";

// Con IA el primer paso pide título y contexto; el resto es igual, pero ya
// viene prellenado por el borrador para que el redactor lo revise.
const STEPS_IA: { key: StepKey; label: string }[] = [
  { key: "tema", label: "Título y contexto" },
  ...STEPS_MANUAL.slice(1),
];

// Decodifica las entidades HTML de un texto.
const decode = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

/**
 * HTML sencillo del borrador -> texto editable (párrafos y «## » intertítulos).
 * Si trae otras etiquetas (figuras, listas…) se deja en HTML para no perderlas.
 */
function toText(html: string): string {
  const t = html
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "## $1\n\n")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n");
  if (/<[a-z/][^>]*>/i.test(t)) return html;
  return decode(t).replace(/\n{3,}/g, "\n\n").trim();
}

/** Convierte las URL escritas a mano en enlaces. */
const linkify = (s: string) =>
  s.replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (u) => `<a href="${u}" rel="noopener">${u}</a>`);

/**
 * Texto plano -> HTML: cada bloque separado por una línea en blanco es un
 * párrafo; una línea que empieza por "## " es un intertítulo. Si el redactor
 * ya escribió HTML, se respeta tal cual.
 */
/** Marcador de gráfica → <figure>. Se aplica tanto al texto simple como al cuerpo que ya trae HTML (p. ej. con el bloque de fuentes). */
const MARCADOR_GRAFICA = /(?:<p[^>]*>\s*)?\[\[GRAFICA ([\w-]+) \| ([^|\]]*) \| ([^\]]*)\]\](?:\s*<\/p>)?/g;
// Convierte los marcadores de gráfica del texto en las figuras que se dibujan.
function expandirGraficas(html: string): string {
  return html.replace(MARCADOR_GRAFICA, (marca, datos: string, alt: string, fuente: string) => {
    const spec = decodeSpec(datos);
    if (!spec) return marca;
    return `<figure class="lx-chart" data-chart="${datos}"><img src="${svgDataUri(renderChartSvg(spec))}" alt="${escapeHtml(alt)}" loading="lazy"><figcaption>${escapeHtml(fuente)}</figcaption></figure>`;
  });
}

// Convierte el texto escrito en HTML con párrafos e intertítulos.
function toHtml(text: string): string {
  if (/<\/?(p|h2|h3|ul|ol|figure|blockquote|details)\b/i.test(text)) return expandirGraficas(text);
  return text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => {
      // Gráfica insertada con IA: [[GRAFICA <datos> | texto alternativo | fuente]]
      const g = /^\[\[GRAFICA ([\w-]+) \| ([^|\]]*) \| ([^\]]*)\]\]$/.exec(b);
      if (g) {
        const spec = decodeSpec(g[1]);
        if (spec) {
          return `<figure class="lx-chart" data-chart="${g[1]}"><img src="${svgDataUri(renderChartSvg(spec))}" alt="${escapeHtml(g[2])}" loading="lazy"><figcaption>${escapeHtml(g[3])}</figcaption></figure>`;
        }
      }
      return b.startsWith("## ")
        ? `<h2>${escapeHtml(b.slice(3))}</h2>`
        : `<p>${linkify(escapeHtml(b)).replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");
}

/** Creación manual de un artículo, una pantalla por paso, con vista previa final. */
export function ArticleWizard({
  categories,
  authors,
  miAutorId = null,
  mode = "manual",
  initial,
  startStep,
  site,
  status,
  canPublish = false,
  canPortada = false,
  savedAs,
}: {
  categories: (Option & { parentId?: string | null })[];
  authors: Option[];
  /** Ficha de autor de la persona con sesión iniciada: es siempre la firma de la nota. */
  miAutorId?: string | null;
  mode?: "manual" | "ia";
  /** Artículo ya guardado que se reabre en el asistente. */
  initial?: WizardInitial;
  /** Paso por el que se abre (clave de STEPS). */
  startStep?: string;
  /** Cabecera, pie y tema del sitio para la vista previa de escritorio. */
  site?: SitePreviewChrome;
  /** Estado editorial del artículo reabierto. */
  status?: string;
  /** Editor o administrador: puede publicar directamente. */
  canPublish?: boolean;
  /** Puede ubicar notas en la portada del sitio (permiso «portada»). */
  canPortada?: boolean;
  /** Resultado del último guardado (?guardado=…), para confirmarlo. */
  savedAs?: string;
}) {
  const heading = mode === "ia" ? "Nuevo artículo con IA" : "Nuevo artículo";
  const STEPS: readonly { key: StepKey; label: string }[] = mode === "ia" ? STEPS_IA : STEPS_MANUAL;
  const [step, setStep] = useState(() => Math.max(0, STEPS.findIndex((x) => x.key === startStep)));
  const [context, setContext] = useState("");
  // Tema -> la IA propone títulos y contextos -> el redactor elige y genera.
  const [topic, setTopic] = useState("");
  const [options, setOptions] = useState<TitleContextOptions | null>(null);
  const [ideas, setIdeas] = useState<{ ideas: TopicIdea[]; sources: { title: string; url: string }[] } | null>(null);
  const [ideasError, setIdeasError] = useState("");
  const [ideaElegida, setIdeaElegida] = useState<string | null>(null);
  const [newsQuery, setNewsQuery] = useState("");
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [newsError, setNewsError] = useState("");
  const [refs, setRefs] = useState<NewsItem[]>([]);
  const [newsFiltro, setNewsFiltro] = useState<"todo" | NewsItem["type"]>("todo");
  const [searchingNews, startNews] = useTransition();
  const [enOpciones, setEnOpciones] = useState(false);
  // Alto de la ventana: decide cuántas filas de cada lista caben por página del carrusel.
  const alto = useAltoVentana();
  // Fuente cuya pantalla está abierta en el primer paso (null = la pantalla base) y, aparte, la grabación o enlace que se
  // está revisando (-1 = el último cargado, para abrir la revisión justo al terminar de transcribir).
  const [fuente, setFuente] = useState<Fuente | null>(null);
  const [revisando, setRevisando] = useState<number | null>(null);
  const [progAbierto, setProgAbierto] = useState(false);
  const [progFecha, setProgFecha] = useState("");
  const [material, setMaterial] = useState<Material[]>([]);
  const [audioError, setAudioError] = useState("");
  // Quiénes intervienen en la grabación (lo declara el editor antes de transcribir) y si es una entrevista.
  const [personas, setPersonas] = useState<Participante[]>([{ nombre: "", cargo: "" }]);
  const [esEntrevistaGrabada, setEsEntrevistaGrabada] = useState(false);
  const [quienesDespues, setQuienesDespues] = useState(false);
  const [audioBusy, startAudio] = useTransition();
  const [audioFase, setAudioFase] = useState("");
  const [urlsTxt, setUrlsTxt] = useState("");
  const [urlsError, setUrlsError] = useState("");
  const [urlsBusy, startUrls] = useTransition();
  const [sceneTxt, setSceneTxt] = useState("");
  const [imgError, setImgError] = useState("");
  const [genImg, startImg] = useTransition();
  const [ideasFocus, setIdeasFocus] = useState("");
  const [searchingIdeas, startIdeas] = useTransition();
  const [pickedContext, setPickedContext] = useState<number | null>(null);
  // Gráfica con datos reales (Gemini + búsqueda en Google).
  const [chartTopic, setChartTopic] = useState("");
  const [tipoGrafica, setTipoGrafica] = useState<TipoGrafica>("auto");
  const [tokenInsertado, setTokenInsertado] = useState<string | null>(null);
  const [chart, setChart] = useState<Extract<ChartResult, { ok: true }> | null>(null);
  const [chartBusy, startChart] = useTransition();
  const [chartError, setChartError] = useState("");
  const prompt = [topic.trim(), context.trim()].filter(Boolean).join("\n\n");
  // Un artículo reabierto ya tiene borrador: se puede revisar y regenerar.
  const [generated, setGenerated] = useState(!!initial);
  const [aiNote, setAiNote] = useState("");
  const [aiNotaCerrada, setAiNotaCerrada] = useState(false);
  const [arrastre, setArrastre] = useState(false);
  const cuerpoRef = useRef<HTMLTextAreaElement>(null);
  const [generating, startGenerating] = useTransition();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [authorId] = useState(initial?.authorId ?? miAutorId ?? "");
  const [body, setBody] = useState(() => (initial?.body ? toText(initial.body) : ""));
  const [breaking, setBreaking] = useState(initial?.isBreaking ?? false);
  const [live, setLive] = useState(initial?.isLive ?? false);
  // Portada del sitio: «none» = sin destacar, «0» = principal, «1» = segunda; «keep» = ocupa otro lugar fijado desde el editor de portada.
  const [portadaPos, setPortadaPos] = useState<"none" | "0" | "1" | "keep">(() => {
    const p = initial?.homePosition;
    return p == null ? "none" : p === 0 ? "0" : p === 1 ? "1" : "keep";
  });
  const [cover, setCover] = useState(initial?.coverImageUrl ?? "");
  const [coverAlt, setCoverAlt] = useState(initial?.coverImageAlt ?? "");
  const [metaTitle, setMetaTitle] = useState(initial?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(initial?.metaDescription ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const bodyHtml = toHtml(body);
  // Misma auditoría que el editor completo. La palabra clave principal es la
  // primera etiqueta; si aún no hay, se usa el título.
  const audit = useMemo(
    () =>
      auditArticle({
        title,
        excerpt,
        body: bodyHtml,
        metaTitle,
        metaDescription,
        tags,
        focus: tags[0] || title,
        coverImageUrl: cover,
        coverImageAlt: coverAlt,
        authorName: authors.find((a) => a.id === authorId)?.name ?? "",
      }),
    [title, excerpt, bodyHtml, metaTitle, metaDescription, tags, cover, coverAlt, authorId, authors],
  );
  // Autoguardado: a cada cambio (con una pausa) y al cambiar de paso se guarda el borrador, sin salir del asistente.
  const [savedId, setSavedId] = useState(initial?.id ?? "");
  const [autoEstado, setAutoEstado] = useState<"idle" | "guardando" | "guardado" | "error" | "omitido">("idle");
  const [autoHora, setAutoHora] = useState("");
  const savedIdRef = useRef(initial?.id ?? "");
  const enVuelo = useRef(false);
  const pendiente = useRef(false);
  const ultimaFirma = useRef("");
  const snapshot = {
    title, excerpt, body: bodyHtml, tags, categoryId, authorId,
    coverImageUrl: cover, coverImageAlt: coverAlt, metaTitle, metaDescription,
  };
  const firma = JSON.stringify(snapshot);
  const snapRef = useRef(snapshot);
  // Siempre el último estado, actualizado al confirmar cada render (no durante el render).
  useEffect(() => {
    snapRef.current = snapshot;
  });
  useEffect(() => {
    if (title.trim().length < 5 || firma === ultimaFirma.current) return;
    const t = setTimeout(async function guardar() {
      if (enVuelo.current) {
        pendiente.current = true;
        return;
      }
      enVuelo.current = true;
      setAutoEstado("guardando");
      const enviado = JSON.stringify(snapRef.current);
      try {
        const res = await autosaveDraft({ id: savedIdRef.current || undefined, ...snapRef.current });
        if (res.ok) {
          ultimaFirma.current = enviado;
          if (!savedIdRef.current) {
            savedIdRef.current = res.id;
            setSavedId(res.id);
          }
          setAutoHora(new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Bogota" }).format(new Date(res.savedAt)));
          setAutoEstado("guardado");
        } else {
          setAutoEstado(res.skipped ? "omitido" : "error");
        }
      } catch {
        setAutoEstado("error");
      } finally {
        enVuelo.current = false;
        if (pendiente.current) {
          pendiente.current = false;
          void guardar();
        }
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [firma, title, mode]);

  // Recordar el último paso por artículo (en este navegador) para retomar
  // donde se quedó al volver a abrirlo desde la lista.
  const stepKey = initial ? `cg:paso:${initial.id}` : null;
  useEffect(() => {
    if (!stepKey || startStep) return;
    try {
      const saved = localStorage.getItem(stepKey);
      const i = STEPS.findIndex((x) => x.key === saved);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- solo existe en el cliente
      if (i > 0) setStep(i);
    } catch {
      /* sin almacenamiento: se empieza por el primer paso */
    }
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!stepKey) return;
    try {
      localStorage.setItem(stepKey, STEPS[step].key);
    } catch {
      /* ignorar */
    }
  }, [stepKey, step, STEPS]);

  const categoryName = categories.find((c) => c.id === categoryId)?.name;
  // Secciones cuyo nombre aparece en el título, el resumen o las palabras clave: se destacan como «Sugerida».
  const seccionesSugeridas = useMemo(() => {
    const t = `${title} ${excerpt} ${tags.join(" ")}`.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    return categories
      .filter((c) => {
        const n = c.name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
        // Coincide si alguna palabra de la sección (raíz de 5+ letras) aparece en el texto: «silvopastoril» ⇢ «silvopastoriles».
        return n.split(/\s+/).some((w) => w.length >= 5 && t.includes(w.slice(0, Math.max(5, w.length - 2))));
      })
      .map((c) => c.id);
  }, [categories, title, excerpt, tags]);
  const authorName = authors.find((a) => a.id === authorId)?.name;

  // Qué impide avanzar desde cada paso (solo título y resumen son obligatorios).
  const blocker: Record<string, string | null> = {
    tema: !generated ? "Elige un título y un contexto y genera el borrador para continuar." : null,
    titulo: title.trim().length < 5 ? "Escribe un título de al menos 5 caracteres." : null,
    resumen: excerpt.trim().length < 20 ? "El resumen debe tener al menos 20 caracteres." : null,
  };
  const current = STEPS[step];
  // Cada paso empieza arriba: el título del paso nunca queda oculto por el desplazamiento del anterior.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step, enOpciones]);
  const isLast = step === STEPS.length - 1;

  // Avanza al siguiente paso guardando el borrador.
  function next() {
    // En el paso del tema, «Siguiente» hace lo que toca: proponer opciones y,
    // con título y contexto elegidos, generar el borrador y pasar al resumen.
    if (current.key === "tema" && !generated) {
      if (generating) return;
      if (!options) return suggest();
      if (!enOpciones) return setEnOpciones(true);
      // El contexto es opcional: con solo el título elegido se redacta a partir del tema.
      return generate();
    }
    const b = blocker[current.key];
    if (b) return setError(b);
    setError("");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  // Vuelve al paso anterior.
  function back() {
    setError("");
    // En el primer paso, «Atrás» sale de la pantalla en la que se está (títulos y enfoque, revisión o fuente), no al paso anterior.
    if (current.key === "tema") {
      if (enOpciones) return setEnOpciones(false);
      if (revisando !== null) return setRevisando(null);
      if (fuente) return setFuente(null);
    }
    setStep((s) => Math.max(s - 1, 0));
  }
  // Va al paso indicado.
  function goTo(i: number) {
    // Solo se puede saltar hacia delante si los pasos obligatorios previos están completos.
    for (let k = 0; k < i; k++) {
      const b = blocker[STEPS[k].key];
      if (b) {
        setStep(k);
        return setError(b);
      }
    }
    setError("");
    setStep(i);
  }

  // Agrega palabras clave a partir de un texto separado por comas.
  function addTags(raw: string) {
    const nuevos = raw
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t && !tags.includes(t));
    if (nuevos.length) setTags([...tags, ...nuevos].slice(0, 12));
    setTagDraft("");
  }

  // Pide a la IA el borrador completo de la nota.
  function generate() {
    if (title.trim().length < 5) return setError("Escribe un título de al menos 5 caracteres.");
    if (prompt.length < 20 && material.length === 0) return setError("Añade un poco más de contexto (mínimo 20 caracteres) o carga una entrevista o enlaces.");
    setError("");
    startGenerating(async () => {
      const res = await generateArticleDraft({
        title: title.trim(),
        prompt,
        section: categories.find((c) => c.id === categoryId)?.name,
        references: refs.map((r) => ({ title: r.title, outlet: r.outlet, url: r.url, videoId: r.videoId })),
        material,
      });
      if (!res.ok) return setError(res.error);
      const d = res.draft;
      setTitle(title.trim() || d.title);
      setExcerpt(d.excerpt);
      setBody(toText(d.body));
      setMetaTitle(d.metaTitle);
      setMetaDescription(d.metaDescription);
      setTags(d.tags.map((t) => t.toLowerCase()).slice(0, 12));
      setGenerated(true);
      setAiNote(
        res.note ??
          "Borrador generado. Revísalo paso a paso antes de publicar.",
      );
      setStep(1);
    });
  }

  // Pide una gráfica con datos de la web.
  function makeChart() {
    setChartError("");
    setChart(null);
    startChart(async () => {
      const res = await generateChart({
        topic: chartTopic.trim() || title.trim(),
        section: categories.find((c) => c.id === categoryId)?.name,
        tipo: tipoGrafica,
        articulo: bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 3000),
      });
      if (!res.ok) return setChartError(res.error);
      setChart(res);
    });
  }
  // Texto corto con los datos de una gráfica, para el marcador del cuerpo.
  function tokenDe(c: Extract<ChartResult, { ok: true }>, spec: ChartSpec) {
    const fuente = `Fuente: ${c.sourceNote || "Google Search"}. Consultado en: ${c.sources.slice(0, 3).map((x) => x.title).join(", ")}.`;
    const alt = spec.title.replace(/[|\]]/g, " ");
    return `[[GRAFICA ${encodeSpec(spec)} | ${alt} | ${fuente.replace(/[|\]]/g, " ")}]]`;
  }
  /** Cambia la forma de la gráfica ya generada sin volver a buscar datos; si ya estaba en la nota, la actualiza ahí. */
  function cambiarTipo(t: TipoGrafica) {
    setTipoGrafica(t);
    setChartError("");
    if (!chart) return;
    const r = aplicarTipo(chart.chart, t);
    if (!r.ok) return setChartError(r.error);
    const nuevo = { ...chart, chart: r.chart, svg: renderChartSvg(r.chart) };
    setChart(nuevo);
    if (tokenInsertado) {
      const tk = tokenDe(nuevo, r.chart);
      setBody((b) => (b.includes(tokenInsertado) ? b.replace(tokenInsertado, tk) : b));
      setTokenInsertado(tk);
    }
  }
  // Inserta la gráfica generada en el cuerpo de la nota.
  function insertChart() {
    if (!chart) return;
    const tk = tokenDe(chart, chart.chart);
    setBody((b) => (tokenInsertado && b.includes(tokenInsertado) ? b.replace(tokenInsertado, tk) : `${b.trimEnd()}\n\n${tk}\n`));
    setTokenInsertado(tk);
    setChartError("");
  }
  // Quita del cuerpo la gráfica insertada.
  function quitarGrafica() {
    if (tokenInsertado) setBody((b) => b.replace(tokenInsertado, "").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n");
    setTokenInsertado(null);
  }

  /** Hora de Colombia (UTC-5, sin horario de verano) como «YYYY-MM-DDTHH:mm» para el campo de fecha. */
  function presetProgramacion(tipo: "lunes" | "manana-am" | "manana-pm") {
    const ahora = new Date(Date.now() - 5 * 3600_000); // se leen los campos UTC como hora de pared de Bogotá
    const base = new Date(ahora);
    let hora = 20;
    if (tipo === "lunes") {
      let dias = (1 - ahora.getUTCDay() + 7) % 7;
      if (dias === 0 && ahora.getUTCHours() >= 20) dias = 7; // hoy es lunes y ya pasaron las 8 p. m.
      base.setUTCDate(base.getUTCDate() + dias);
    } else {
      base.setUTCDate(base.getUTCDate() + 1);
      hora = tipo === "manana-am" ? 7 : 20;
    }
    setProgFecha(`${base.toISOString().slice(0, 10)}T${String(hora).padStart(2, "0")}:00`);
  }

  /** Tope por archivo que acepta el modelo (audio ya extraído o video chico). */
  const MAX_ENTREVISTA = 20 * 1024 * 1024;
  // Sube una entrevista de audio o video y la transcribe.
  function subirEntrevista(original: File) {
    setAudioError("");
    if (!participantesListos(personas, quienesDespues)) return setAudioError("Escribe quiénes intervienen en la grabación, o marca que los identificarás después.");
    // Lo que declaró el editor viaja con el archivo para que la IA etiquete cada intervención con el nombre correcto.
    const declarados = quienesDespues ? [] : personas.map((p) => ({ nombre: p.nombre.trim(), cargo: p.cargo.trim() })).filter((p) => p.nombre);
    const contexto = (parte?: { n: number; de: number }) => JSON.stringify({ participantes: declarados, esEntrevista: esEntrevistaGrabada, parte });
    startAudio(async () => {
      try {
        let f = original;
        // Un video se reduce primero a su audio EN EL NAVEGADOR: así no se sube el video (pesa cientos de MB).
        if (esVideo(original)) {
          setAudioFase("Extrayendo el audio del video…");
          try {
            f = await extraerAudioDeVideo(original, MAX_ENTREVISTA);
          } catch (e) {
            if (e instanceof ExtraerAudioError && e.fatal) return setAudioError(e.message);
            if (original.size > MAX_ENTREVISTA) {
              return setAudioError(`${e instanceof Error ? e.message : "No se pudo leer el video."} Como pesa más de 20 MB, conviértelo a MP4 (H.264/AAC) o súbelo solo en audio.`);
            }
            f = original; // video chico que el navegador no supo abrir: el modelo transcribe su audio
          }
        }
        setAudioFase(esVideo(f) ? "Transcribiendo el video…" : "Transcribiendo…");
        let res;
        if (f !== original && f.type === "audio/wav") {
          // Audio sacado de un video: se manda en trozos de ~3 MB directo al servidor (sin pasar por el almacenamiento).
          const partes = await partirWav(f, 3 * 1024 * 1024);
          const materiales: Material[] = [];
          // Segundos que ya pasaron cuando empieza cada parte: los tiempos de cada trozo se suman a este desfase.
          const desfases: number[] = [];
          let corrido = 0;
          for (let i = 0; i < partes.length; i++) {
            setAudioFase(partes.length > 1 ? `Transcribiendo… parte ${i + 1} de ${partes.length}` : "Transcribiendo…");
            const fd = new FormData();
            fd.append("audio", partes[i]);
            fd.append("contexto", contexto({ n: i + 1, de: partes.length }));
            const r = await transcribirEntrevista(fd);
            if (!r.ok) return setAudioError(`${r.error}${partes.length > 1 ? ` (parte ${i + 1} de ${partes.length})` : ""}`);
            materiales.push(r.material);
            desfases.push(corrido);
            corrido += await duracionWav(partes[i]);
          }
          const primero = materiales[0];
          if (!primero) return setAudioError("No se pudo transcribir.");
          const titulo = `Entrevista: ${original.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 80)}`;
          if (materiales.every((m) => m.segmentos?.length)) {
            // Todas las partes llegaron divididas por intervenciones: se unen con los tiempos corridos.
            const segmentos: Segmento[] = materiales.flatMap((m, i) => (m.segmentos ?? []).map((sg) => ({ ...sg, inicio: sg.inicio === undefined ? undefined : sg.inicio + desfases[i] })));
            res = { ok: true as const, material: { ...primero, title: titulo, segmentos, text: textoDeSegmentos(segmentos) } };
          } else {
            res = { ok: true as const, material: { ...primero, title: titulo, text: materiales.map((m) => m.text).join("\n\n") } };
          }
        } else if (f.size <= 3.5 * 1024 * 1024) {
          const fd = new FormData();
          fd.append("audio", f);
          fd.append("contexto", contexto());
          res = await transcribirEntrevista(fd);
        } else {
          const c = await crearSubidaAudio({ name: f.name, type: f.type, size: f.size });
          if (!c.ok) return setAudioError(c.error);
          const put = await fetch(c.uploadUrl, { method: "PUT", headers: { "content-type": f.type || "audio/mpeg" }, body: f });
          if (!put.ok) return setAudioError(`No se pudo subir el archivo (${put.status}): ${(await put.text().catch(() => "")).replace(/[{}"]/g, " ").slice(0, 160)}`);
          res = await transcribirEntrevistaSubida({ path: c.path, name: original.name, contexto: contexto() });
        }
        if (!res.ok) return setAudioError(res.error);
        setMaterial((m) => [...m, res.material]);
        setOptions(null);
        // Recién transcrita: se abre la revisión para asignar quién dijo cada fragmento.
        setFuente(null);
        setRevisando(-1);
      } catch {
        setAudioError("No se pudo procesar el archivo. Inténtalo de nuevo.");
      } finally {
        setAudioFase("");
      }
    });
  }
  // Lee los enlaces pegados y los agrega como material.
  function cargarEnlaces() {
    setUrlsError("");
    startUrls(async () => {
      const res = await leerEnlaces({ urls: urlsTxt });
      if (!res.ok) return setUrlsError(res.error);
      setMaterial((m) => [...m, ...res.materiales.filter((n) => !m.some((x) => x.url === n.url))]);
      setOptions(null);
      setUrlsTxt("");
      setFuente(null);
      if (res.fallidos.length) setUrlsError(`No se pudieron leer: ${res.fallidos.join(", ")}`);
    });
  }

  // Pide a la IA la imagen de portada.
  function makeCover() {
    setImgError("");
    startImg(async () => {
      const res = await generateCoverImage({
        title,
        excerpt,
        body: bodyHtml,
        section: categories.find((c) => c.id === categoryId)?.name,
        scene: sceneTxt,
      });
      if (!res.ok) return setImgError(res.error);
      setCover(res.url);
      setCoverAlt(res.alt);
    });
  }

  // Busca noticias sobre el tema.
  function findNews() {
    setNewsError("");
    startNews(async () => {
      const res = await searchNewsAbout({ query: newsQuery, section: categories.find((c) => c.id === categoryId)?.name });
      if (!res.ok) return setNewsError(res.error);
      setNews(res.items);
    });
  }
  // Indica si una noticia ya está marcada para referenciar.
  const isRef = (n: NewsItem) => refs.some((r) => r.url === n.url);
  // Marca o desmarca una noticia para referenciarla.
  function toggleRef(n: NewsItem) {
    setRefs((r) => (r.some((x) => x.url === n.url) ? r.filter((x) => x.url !== n.url) : [...r, n]));
  }
  // Usa una noticia como tema de la nota.
  function elegirNoticiaComoTema(n: NewsItem) {
    setTopic(`${n.title}. ${n.summary} (Fuente: ${n.outlet}${n.date ? `, ${n.date}` : ""}).`);
    setOptions(null);
    setRefs((r) => (r.some((x) => x.url === n.url) ? r : [...r, n]));
    setFuente(null);
  }

  // Pide a la IA ideas de temas.
  function findIdeas() {
    setIdeasError("");
    startIdeas(async () => {
      const res = await suggestTopicIdeas({
        section: categories.find((c) => c.id === categoryId)?.name,
        focus: ideasFocus,
      });
      if (!res.ok) return setIdeasError(res.error);
      setIdeas({ ideas: res.ideas, sources: res.sources });
    });
  }

  // Pide títulos y enfoques para el tema.
  function suggest() {
    setError("");
    startGenerating(async () => {
      const res = await suggestTitlesAndContexts({
        topic: topic.trim(),
        section: categories.find((c) => c.id === categoryId)?.name,
        material,
      });
      if (!res.ok) return setError(res.error);
      setOptions({ titles: res.titles, contexts: res.contexts });
      setPickedContext(null);
      setEnOpciones(true);
    });
  }

  // Paso de revisión con IA -> parte del borrador que se puede regenerar.
  const PART_OF: Partial<Record<StepKey, DraftPart>> = {
    resumen: "excerpt",
    claves: "tags",
    cuerpo: "body",
    seo: "seo",
  };

  // Regenera una parte del borrador.
  function regenerate(part: DraftPart) {
    const current = {
      excerpt,
      tags: tags.join(", "),
      body: bodyHtml,
      seo: `${metaTitle}\n${metaDescription}`,
    }[part];
    setError("");
    startGenerating(async () => {
      const res = await regenerateDraftPart({
        title: title.trim(),
        prompt,
        part,
        current,
        section: categories.find((c) => c.id === categoryId)?.name,
      });
      if (!res.ok) return setError(res.error);
      const v = res.value;
      if (v.excerpt) setExcerpt(v.excerpt);
      if (v.tags) setTags(v.tags.map((t) => t.toLowerCase()).slice(0, 12));
      if (v.body) setBody(toText(v.body));
      if (v.metaTitle) setMetaTitle(v.metaTitle);
      if (v.metaDescription) setMetaDescription(v.metaDescription);
    });
  }

  // Sube la imagen de portada elegida.
  async function onCover(file: File) {
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadMedia(fd);
      if (!res.ok) return setError(res.error);
      if (res.kind === "video") return setError("La portada debe ser una imagen.");
      setCover(res.url);
    } catch {
      setError("No se pudo subir la imagen.");
    } finally {
      setUploading(false);
    }
  }

  const input =
    "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 outline-none transition focus:border-[var(--accent)] placeholder:text-[var(--fg-muted)]/50";

  // Pantalla del primer paso: títulos y enfoque, la revisión de un material, la pantalla de una fuente o la base.
  const enPantallaOpciones = enOpciones && !!options;
  const idxRev = revisando === null || material.length === 0 ? null : Math.min(revisando < 0 ? material.length - 1 : revisando, material.length - 1);
  const matRev = idxRev === null ? null : material[idxRev];
  const subpantalla: Fuente | "revision" | null = current.key !== "tema" || enPantallaOpciones ? null : matRev ? "revision" : fuente;
  // Vuelve a la pantalla base del primer paso.
  const volverAlTema = () => {
    setRevisando(null);
    setFuente(null);
  };

  return (
    <form
      action={saveArticle}
      // En escritorio el asistente mide EXACTAMENTE la ventana (100dvh menos el margen del panel: 2 × 8 px, ya sin pie):
      // cada paso cabe sin desplazarse, y lo largo (ideas, noticias, intervenciones…) va en carruseles.
      // En pantallas pequeñas la página puede crecer, con la barra de navegación fija abajo.
      data-asistente
      className="-my-6 flex min-h-[max(30rem,calc(100dvh-var(--panel-header-h,61px)-5.75rem))] flex-col gap-3 lg:h-[calc(100dvh-1rem)] lg:min-h-0"
    >
      {/* Todo viaja oculto: el formulario solo se envía desde la vista previa. */}
      <input type="hidden" name="id" value={savedId} />
      <input type="hidden" name="desde" value={mode} />
      <input type="hidden" name="title" value={title.trim()} />
      <input type="hidden" name="excerpt" value={excerpt.trim()} />
      <input type="hidden" name="body" value={bodyHtml} />
      <input type="hidden" name="tags" value={tags.join(", ")} />
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="authorId" value={authorId} />
      <input type="hidden" name="coverImageUrl" value={cover} />
      <input type="hidden" name="coverImageAlt" value={coverAlt} />
      <input type="hidden" name="metaTitle" value={metaTitle} />
      <input type="hidden" name="metaDescription" value={metaDescription} />
      <input type="hidden" name="isBreaking" value={breaking ? "1" : "0"} />
      <input type="hidden" name="isLive" value={live ? "1" : "0"} />
      <input type="hidden" name="portadaPos" value={canPortada ? portadaPos : "keep"} />

      {/* --- Pasos --- */}
      <div className="lx-card shrink-0 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
            <span>{initial ? "Editar artículo" : heading}</span>
            <span className="font-normal text-[var(--fg-muted)]">· Paso {step + 1} de {STEPS.length}</span>
            {status && (
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs font-medium text-[var(--fg-muted)]">
                {STATUS_LABEL[status] ?? status}
              </span>
            )}
          </p>
          <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span role="status" aria-live="polite" className="text-[var(--fg-muted)]">
              {autoEstado === "guardando" && "Guardando…"}
              {autoEstado === "guardado" && `✓ Guardado · ${autoHora}`}
              {autoEstado === "error" && <span className="text-[var(--danger,#b4442e)]">No se pudo autoguardar</span>}
              {autoEstado === "omitido" && "Nota publicada: guarda con los botones"}
              {autoEstado === "idle" && title.trim().length < 5 && "Se guarda al escribir el título"}
            </span>
            {initial ? (
              <Link href={`/panel/articulos/${initial.id}`} className="lx-link">
                Editor completo
              </Link>
            ) : (
              <Link href="/panel/articulos/nuevo" className="lx-link">
                Cambiar modo
              </Link>
            )}
            <Link href="/panel/articulos" className="lx-link inline-flex items-center gap-1">
              <ArrowLeft size={12} /> Artículos
            </Link>
          </span>
        </div>
        <div className="mt-2.5">
          <WizardStepper pasos={STEPS} actual={step} onGo={goTo} />
        </div>
      </div>

      {current.key !== "tema" && (
        <div className="lg:hidden">
          <SeoBar score={audit.score} items={audit.items} focus={tags[0]} />
        </div>
      )}

      {/* --- Pantalla del paso + panel SEO lateral (escritorio) --- */}
      <div className="flex min-h-0 flex-1 gap-3">
      {/* Sin desplazamiento propio salvo en una ventana demasiado baja (el `auto` solo actúa si no cabe). */}
      <div className="lx-card flex min-h-0 min-w-0 flex-1 flex-col p-5 sm:p-6" style={{ transform: "none", overflowY: "auto" }}>
        {mode === "ia" && generated && PART_OF[current.key] && (
          <div className="mx-auto mb-3 flex max-w-2xl items-center gap-2 text-xs text-[var(--fg-muted)]">
            <Sparkles size={13} className="text-[var(--accent)]" />
            <span>Propuesta de la IA</span>
            <button type="button" onClick={() => regenerate(PART_OF[current.key]!)} disabled={generating} className="lx-link inline-flex items-center gap-1 font-semibold">
              {generating ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              {generating ? "Regenerando…" : "Regenerar"}
            </button>
          </div>
        )}
        {current.key === "tema" && (generating || error) && (
          <div
            role="status"
            className={`absolute inset-x-5 top-3 z-10 mx-auto flex max-w-2xl items-center gap-3 rounded-[var(--radius)] border px-4 py-3 text-sm font-medium shadow-md sm:inset-x-6 ${
              generating
                ? "border-[var(--accent)] bg-[var(--surface-2)]"
                : "border-[var(--danger,#b4442e)] bg-[var(--surface-2)] text-[var(--danger,#b4442e)]"
            }`}
          >
            {generating ? (
              <>
                <Loader2 size={18} className="shrink-0 animate-spin text-[var(--accent)]" />
                {options || generated
                  ? "La IA está redactando el borrador… puede tardar unos segundos; al terminar pasas al resumen."
                  : "La IA está buscando títulos y contextos…"}
              </>
            ) : (
              error
            )}
          </div>
        )}
        {current.key === "tema" && (
          <Step
            ancho="xl"
            title={
              enPantallaOpciones ? "Elige el título y el enfoque"
              : subpantalla === "ideas" ? "Ideas de la IA"
              : subpantalla === "noticias" ? "Buscar noticias"
              : subpantalla === "entrevista" ? "Voz o video"
              : subpantalla === "enlaces" ? "Enlaces"
              : subpantalla === "revision" ? "Revisa lo que se dijo"
              : "Tema, título y contexto"
            }
            hint={
              enPantallaOpciones ? (
                <p className="flex items-baseline gap-3">
                  <span className="line-clamp-1 min-w-0 flex-1">
                    <strong className="text-[var(--fg)]">Tema:</strong> {(topic.trim() || material[0]?.title || "—").slice(0, 200)}
                    {material.length > 0 && ` · ${material.length} material${material.length > 1 ? "es" : ""} cargado${material.length > 1 ? "s" : ""}`}
                  </span>
                  <button type="button" onClick={() => setEnOpciones(false)} className="lx-link inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
                    <ArrowLeft size={12} /> Cambiar tema o fuente
                  </button>
                </p>
              ) : subpantalla ? (
                <p className="flex items-baseline gap-3">
                  <span className="line-clamp-1 min-w-0 flex-1">
                    {subpantalla === "ideas" && "La IA busca qué es tendencia en el sector, en Colombia y en el mundo. Elige un tema para usarlo."}
                    {subpantalla === "noticias" && "Investiga una persona, empresa o tema. Elige cuáles referenciar o cuál usar como tema."}
                    {subpantalla === "entrevista" && "Dinos quiénes hablan y sube la grabación: la IA la divide por intervenciones."}
                    {subpantalla === "enlaces" && "La IA lee cada página y redacta con palabras propias."}
                    {subpantalla === "revision" && matRev && `${matRev.title} · ${matRev.segmentos?.length ? "asigna quién dijo cada fragmento y corrige el texto" : "corrige el texto antes de redactar"}`}
                  </span>
                  <button type="button" onClick={volverAlTema} className="lx-link inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
                    <ArrowLeft size={12} /> Volver al tema
                  </button>
                </p>
              ) : "Describe el tema, o parte de una noticia, una entrevista o unos enlaces. La IA propone títulos y enfoques; tú eliges y revisas cada paso."
            }
          >
            {/* Cada fuente tiene su pantalla: así el tema, las ideas, las noticias y la grabación caben sin desplazarse. */}
            {subpantalla === "ideas" && (
              <PantallaIdeas
                foco={ideasFocus}
                onFoco={setIdeasFocus}
                onBuscar={findIdeas}
                buscando={searchingIdeas}
                ocupado={generating}
                error={ideasError}
                ideas={ideas}
                picked={ideaElegida}
                onPick={(i) => {
                  setTopic(`${i.title}. ${i.angle}`);
                  setIdeaElegida(i.title);
                  setOptions(null);
                  setFuente(null);
                }}
                filas={filasListas(alto, 150, 195, 1, 3)}
              />
            )}
            {subpantalla === "noticias" && (
              <PantallaNoticias
                consulta={newsQuery}
                onConsulta={setNewsQuery}
                onBuscar={findNews}
                buscando={searchingNews}
                ocupado={generating}
                error={newsError}
                news={news}
                filtro={newsFiltro}
                onFiltro={setNewsFiltro}
                refs={refs}
                isRef={isRef}
                onTema={elegirNoticiaComoTema}
                onRef={toggleRef}
                filas={filasListas(alto, 160, 175, 1, 3)}
              />
            )}
            {subpantalla === "entrevista" && (
              <PantallaEntrevista
                personas={personas}
                onPersonas={setPersonas}
                esEntrevista={esEntrevistaGrabada}
                onEsEntrevista={setEsEntrevistaGrabada}
                despues={quienesDespues}
                onDespues={setQuienesDespues}
                ocupado={audioBusy}
                fase={audioFase}
                error={audioError}
                onArchivo={subirEntrevista}
                filasPersonas={3}
              />
            )}
            {subpantalla === "enlaces" && (
              <PantallaEnlaces texto={urlsTxt} onTexto={setUrlsTxt} onCargar={cargarEnlaces} cargando={urlsBusy} error={urlsError} />
            )}
            {subpantalla === "revision" && matRev && idxRev !== null && (
              matRev.segmentos?.length ? (
                <SegmentosEditor
                  material={matRev}
                  filas={filasListas(alto, 40, 135, 1, 5)}
                  onChange={(nuevo) => {
                    setMaterial((x) => x.map((y, k) => (k === idxRev ? nuevo : y)));
                    setOptions(null);
                  }}
                />
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  <textarea
                    value={matRev.text}
                    onChange={(e) => setMaterial((x) => x.map((y, k) => (k === idxRev ? { ...y, text: e.target.value } : y)))}
                    aria-label="Texto de la fuente"
                    className={`${input} min-h-[8rem] flex-1 resize-none text-sm leading-relaxed`}
                  />
                  {matRev.url && <a href={matRev.url} target="_blank" rel="noopener noreferrer" className="lx-link shrink-0 text-xs">Abrir enlace ↗</a>}
                </div>
              )
            )}

            {subpantalla === null && !enPantallaOpciones && (
              <div className="grid min-h-0 flex-1 gap-4 @2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @2xl:items-stretch">
                <div className="flex min-h-0 min-w-0 flex-col gap-2.5">
                  <textarea
                    autoFocus
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    aria-label="Tema de la nota"
                    placeholder="Cuéntale a la IA de qué trata la nota. Ej.: el precio del novillo gordo subió 4 % en Medellín en septiembre según la Central Ganadera; menor entrada de ganado del Magdalena Medio…"
                    className={`${input} min-h-[7rem] flex-1 resize-none text-base leading-relaxed`}
                  />
                  <p className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-0.5 text-xs text-[var(--fg-muted)]">
                    <span>Cuanto más concreto (qué pasó, dónde, cuándo y según quién), mejores serán los títulos.</span>
                    <span className={`tabular-nums font-medium ${topic.trim().length >= 10 || material.length > 0 ? "text-[#16a34a]" : ""}`} aria-live="polite">
                      {material.length > 0 ? "✓ Hay material cargado" : topic.trim().length >= 10 ? `✓ ${topic.trim().length} caracteres` : `${topic.trim().length} / 10 mínimo`}
                    </span>
                  </p>
                  {material.length > 0 && (
                    <Carrusel
                      etiqueta="Material cargado"
                      items={material}
                      filas={filasListas(alto, 202, 52, 1, 4)}
                      maxColumnas={1}
                      anchoMinimo={200}
                      separacion="gap-1.5"
                      render={(m, i) => (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2">
                          <span className="rounded-full bg-[var(--accent)]/12 px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--accent)]">
                            {m.kind === "entrevista" ? "Entrevista" : "Enlace"}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={m.title}>{m.title}</span>
                          <span className="text-xs text-[var(--fg-muted)]">{m.segmentos?.length ? `${m.segmentos.length} intervenciones · ` : ""}{m.text.length.toLocaleString("es-CO")} car.</span>
                          <button type="button" onClick={() => setRevisando(i)} className="lx-link text-xs font-semibold">
                            {m.segmentos?.length ? "Revisar quién dijo qué" : "Ver y corregir"}
                          </button>
                          <button type="button" onClick={() => { setMaterial((x) => x.filter((_, k) => k !== i)); setOptions(null); }} className="lx-link text-xs">Quitar</button>
                        </div>
                      )}
                    />
                  )}
                </div>
                <FuenteCards
                  onElegir={setFuente}
                  notas={{
                    ideas: ideaElegida ? "Tema elegido" : ideas ? `${ideas.ideas.length} temas` : undefined,
                    noticias: refs.length ? `${refs.length} referencia${refs.length > 1 ? "s" : ""}` : news ? `${news.length} resultados` : undefined,
                    entrevista: material.some((m) => m.kind === "entrevista") ? "Cargada" : undefined,
                    enlaces: material.some((m) => m.kind === "enlace") ? `${material.filter((m) => m.kind === "enlace").length} cargados` : undefined,
                  }}
                />
              </div>
            )}

            {options && enPantallaOpciones && (
              <>
                {/* Las dos elecciones en una sola hoja: título a la izquierda y enfoque a la derecha. */}
                <div className="grid items-start gap-3 @2xl:grid-cols-2">
                  <section aria-labelledby="op-titulo" className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] p-3.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 id="op-titulo" className="lx-kicker text-[var(--accent)]">1 · Título</h3>
                      <span className="text-xs text-[var(--fg-muted)]">{title.trim().length >= 5 ? <span className="font-medium text-[#16a34a]">✓ Elegido</span> : "Elige uno o escribe el tuyo"}</span>
                    </div>
                    <div role="radiogroup" aria-labelledby="op-titulo" className="flex flex-col gap-1.5">
                      {options.titles.map((t) => (
                        <button
                          key={t}
                          type="button"
                          role="radio"
                          aria-checked={title === t}
                          onClick={() => setTitle(t)}
                          className={`flex items-start gap-2.5 rounded-[var(--radius)] border px-3 py-1.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
                            title === t ? "border-[var(--accent)] bg-[var(--accent)]/8" : "border-[var(--border)] hover:border-[var(--accent)]"
                          }`}
                        >
                          <Punto on={title === t} />
                          <span className="min-w-0 flex-1 text-[0.88rem] font-semibold leading-snug">{t}</span>
                          <span className="mt-0.5 shrink-0 text-[0.7rem] tabular-nums text-[var(--fg-muted)]">{t.length}</span>
                        </button>
                      ))}
                    </div>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="O escribe el tuyo"
                      aria-label="Título propio"
                      className={`${input} !py-2 text-base font-semibold`}
                    />
                    <Counter value={title.length} min={15} max={65} />
                  </section>

                  <section aria-labelledby="op-enfoque" className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] p-3.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 id="op-enfoque" className="lx-kicker text-[var(--accent)]">2 · Enfoque</h3>
                      <span className="text-xs text-[var(--fg-muted)]">Cómo contar la nota · opcional</span>
                    </div>
                    {/* Los enfoques (y «Sin enfoque especial») van por páginas si no caben. */}
                    <Carrusel
                      etiqueta="Enfoques propuestos"
                      items={[...options.contexts, null]}
                      filas={filasListas(alto, 185, 66, 2, 5)}
                      maxColumnas={1}
                      anchoMinimo={200}
                      separacion="gap-1.5"
                      render={(c, i) => c ? (
                        <button
                          type="button"
                          aria-pressed={pickedContext === i}
                          onClick={() => {
                            setPickedContext(i);
                            setContext(c.text);
                          }}
                          className={`flex w-full items-start gap-2.5 rounded-[var(--radius)] border px-3 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
                            pickedContext === i ? "border-[var(--accent)] bg-[var(--accent)]/8" : "border-[var(--border)] hover:border-[var(--accent)]"
                          }`}
                        >
                          <Punto on={pickedContext === i} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold leading-snug">{c.label}</span>
                            <span className="mt-0.5 line-clamp-2 block text-[0.78rem] leading-snug text-[var(--fg-muted)]" title={c.text}>{c.text}</span>
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-pressed={pickedContext === -1}
                          onClick={() => {
                            setPickedContext(-1);
                            setContext("");
                          }}
                          className={`flex w-full items-center gap-2.5 rounded-[var(--radius)] border px-3 py-2 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
                            pickedContext === -1 ? "border-[var(--accent)] bg-[var(--accent)]/8 font-semibold" : "border-dashed border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent)]"
                          }`}
                        >
                          <Punto on={pickedContext === -1} />
                          Sin enfoque especial
                        </button>
                      )}
                    />
                    <textarea
                      value={context}
                      onChange={(e) => {
                        setContext(e.target.value);
                        setPickedContext(null);
                      }}
                      rows={2}
                      placeholder="O escribe el tuyo"
                      aria-label="Enfoque propio"
                      className={`${input} resize-none !py-2 text-sm leading-relaxed`}
                    />
                  </section>
                </div>

                {generated && (
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--fg-muted)]">
                    Ya hay un borrador: «Siguiente» para revisarlo.
                    <button type="button" onClick={generate} disabled={generating} className="lx-link inline-flex items-center gap-1 font-semibold disabled:opacity-60">
                      {generating ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Volver a generar con esta elección
                    </button>
                  </p>
                )}
              </>
            )}
          </Step>
        )}

        {current.key === "titulo" && (
          <Step centrado title="¿Cuál es el título?" hint="Claro y concreto: lo que verá el lector y Google. Ideal entre 15 y 65 caracteres.">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), next())}
              placeholder="El precio del novillo gordo sube 4 % en Medellín"
              className={`${input} lx-display text-xl font-semibold sm:text-2xl`}
            />
            <Counter value={title.length} min={15} max={65} />
          </Step>
        )}

        {current.key === "resumen" && (
          <Step centrado title="Resume la noticia" hint="Dos o tres líneas que expliquen por qué importa. Es la entradilla y, por defecto, la descripción en buscadores.">
            <textarea
              autoFocus
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={3}
              placeholder="La Central Ganadera reportó un alza del 4 % frente a agosto por menor oferta…"
              className={`${input} resize-y text-base leading-relaxed`}
            />
            <Counter value={excerpt.length} min={70} max={155} />
          </Step>
        )}

        {current.key === "claves" && (
          <Step centrado title="Palabras clave" hint="Temas de la nota. Escribe una y pulsa Enter o coma. Ayudan a relacionar artículos y al buscador interno.">
            <div className={`${input} flex flex-wrap items-center gap-2 py-2`}>
              {tags.map((t) => (
                <span key={t} className="lx-chip inline-flex items-center gap-1">
                  {t}
                  <button
                    type="button"
                    aria-label={`Quitar ${t}`}
                    onClick={() => setTags(tags.filter((x) => x !== t))}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <input
                autoFocus
                value={tagDraft}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v.includes(",")) addTags(v);
                  else setTagDraft(v);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (tagDraft.trim()) addTags(tagDraft);
                    else next();
                  } else if (e.key === "Backspace" && !tagDraft && tags.length) {
                    setTags(tags.slice(0, -1));
                  }
                }}
                onBlur={() => tagDraft.trim() && addTags(tagDraft)}
                placeholder={tags.length ? "Añadir otra…" : "precio del ganado, Medellín, novillo"}
                className="min-w-[10rem] flex-1 border-0 bg-transparent py-1 outline-none"
              />
            </div>
            <p className="text-xs" style={{ color: tags.length >= 3 && tags.length <= 6 ? "#16a34a" : undefined }}><span className={tags.length >= 3 && tags.length <= 6 ? "" : "text-[var(--fg-muted)]"}>{tags.length} de 12 · ideal entre 3 y 6{tags.length >= 3 && tags.length <= 6 ? " ✓" : ""}</span></p>
          </Step>
        )}

        {current.key === "seccion" && (
          <Step ancho="xl" title="Sección y autor" hint="Dónde se publica y quién firma. Puedes dejarlo para después.">
            <SectionTree options={categories} value={categoryId} onChange={setCategoryId} sugeridas={seccionesSugeridas} firma={authorName ?? "tu usuario, al guardar"} filas={filasListas(alto, 130, 38)}>
              {canPortada ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3.5 py-2.5">
                  <div className="min-w-0 flex-1 basis-48">
                    <p id="pt-sitio" className="lx-kicker text-[var(--fg-muted)]" title="Sin destacar: entra a la portada por fecha, como cualquier nota.">En la portada del sitio</p>
                    <p className="text-xs leading-snug text-[var(--fg-muted)]">
                      {portadaPos === "0" && "Se fija como la nota grande de arriba cuando se publique."}
                      {portadaPos === "1" && "Se fija junto a la principal cuando se publique."}
                      {portadaPos === "keep" && "Ya ocupa otro lugar fijado en la portada; se conserva (se ajusta en «Portada» del menú)."}
                    </p>
                  </div>
                  <div role="radiogroup" aria-labelledby="pt-sitio" className="grid w-full grid-cols-3 gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 sm:w-auto">
                    {([
                      ["none", "Normal", "Sin destacar", "Entra por fecha, como cualquier nota."],
                      ["0", "Principal", "Portada principal", "La nota grande de arriba."],
                      ["1", "Segunda", "Segunda destacada", "Junto a la principal."],
                    ] as const).map(([v, corto, t, d]) => (
                      <button key={v} type="button" role="radio" aria-checked={portadaPos === v} title={d} onClick={() => setPortadaPos(v)}
                        className={`rounded-full px-3 py-1.5 text-center text-sm font-medium transition sm:px-3.5 ${portadaPos === v ? "bg-[var(--accent)] text-[var(--accent-fg,#fff)] shadow-sm" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>
                        <span className="sm:hidden">{corto}</span><span className="hidden sm:inline">{t}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="px-1 text-xs text-[var(--fg-muted)]">Tu cuenta no ubica notas en la portada del sitio: un editor lo hace al publicar.</p>
              )}
            </SectionTree>
          </Step>
        )}

        {current.key === "cuerpo" && (
          <Step title="Escribe el cuerpo" hint="Párrafos separados por una línea en blanco. Las direcciones https://… se convierten en enlaces.">
            <div className="flex min-h-[9rem] flex-1 flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] focus-within:border-[var(--accent)]">
              <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-[var(--border)] px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const el = cuerpoRef.current;
                    const ini = el?.selectionStart ?? body.length;
                    const linea = body.lastIndexOf("\n", ini - 1) + 1;
                    if (body.slice(linea, linea + 3) === "## ") return el?.focus();
                    setBody(body.slice(0, linea) + "## " + body.slice(linea));
                    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(ini + 3, ini + 3); });
                  }}
                  className="rounded-md px-2.5 py-1 text-xs font-semibold text-[var(--fg-muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
                  title="Convierte la línea actual en un intertítulo"
                >
                  H2 · Intertítulo
                </button>
                <span className="ml-auto pr-1 text-xs tabular-nums text-[var(--fg-muted)]">
                  {words} palabras · {Math.max(1, Math.round(words / 200))} min
                </span>
              </div>
              <textarea
                ref={cuerpoRef}
                autoFocus
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={"Primer párrafo con lo más importante…\n\n## Qué explica el alza\n\nSegundo párrafo…"}
                className="block min-h-0 w-full flex-1 resize-none border-0 bg-transparent px-4 py-3 text-base leading-relaxed outline-none"
              />
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]" role="meter" aria-valuenow={words} aria-valuemin={0} aria-valuemax={400} aria-label="Palabras">
                <span className="absolute inset-y-0 left-0 rounded-full transition-all duration-300" style={{ width: `${Math.min(100, (words / 400) * 100)}%`, background: words >= 250 ? "#16a34a" : "#d97706" }} />
              </div>
              <span className="text-xs text-[var(--fg-muted)]">{words >= 250 ? "Buena longitud ✓" : "Se recomiendan al menos 250"}</span>
            </div>
            <p className="flex shrink-0 items-center gap-2 text-xs text-[var(--fg-muted)]">
              <BarChart3 size={13} className="shrink-0 text-[var(--accent)]" /> ¿Tiene cifras? En «Gráfica» la IA arma una y la ves antes de insertarla.
            </p>
          </Step>
        )}

        {current.key === "grafica" && (
          <Step ancho="xl" title="Gráfica con datos" hint="Opcional. La IA busca cifras en la web, las dibuja y tú eliges el tipo. La ves aquí antes de insertarla en la nota.">
            {/* Controles a la izquierda, la gráfica a la derecha: se ven a la vez, sin bajar. */}
            <div className="grid min-h-0 flex-1 gap-4 @2xl:grid-cols-2 @2xl:grid-rows-[minmax(0,1fr)]">
              <div className="flex flex-col gap-3 @2xl:self-start">
                <label className="flex flex-col gap-1.5">
                  <span className="lx-kicker text-[var(--fg-muted)]">¿Qué quieres graficar?</span>
                  <textarea
                    value={chartTopic}
                    onChange={(e) => setChartTopic(e.target.value)}
                    rows={2}
                    placeholder={title ? `Ej.: ${title}` : "Ej.: precio del novillo gordo por mes en 2026"}
                    className={`${input} resize-y text-sm`}
                  />
                </label>
                <div role="radiogroup" aria-label="Tipo de gráfica" className="flex flex-col gap-1.5">
                  <span className="lx-kicker text-[var(--fg-muted)]">Tipo de gráfica</span>
                  <div className="flex flex-wrap gap-1.5">
                    {TIPOS_GRAFICA.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        role="radio"
                        aria-checked={tipoGrafica === t.id}
                        title={t.hint}
                        onClick={() => cambiarTipo(t.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${tipoGrafica === t.id ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--border)] bg-[var(--bg-2)] hover:border-[var(--accent)]"}`}
                      >
                        {(() => { const I = ({ auto: Wand2, vertical: BarChart3, horizontal: BarChartHorizontal, histograma: BarChart4, line: LineChart, area: AreaChart, torta: PieChart, dona: Donut } as const)[t.id]; return <I size={13} aria-hidden />; })()}
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-[var(--fg-muted)]">{TIPOS_GRAFICA.find((t) => t.id === tipoGrafica)?.hint}. {chart ? "Cambiar el tipo redibuja la misma gráfica." : ""}</p>
                </div>
                <button type="button" onClick={makeChart} disabled={chartBusy} className="lx-btn self-start">
                  {chartBusy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  {chartBusy ? "Buscando datos y dibujando…" : chart ? "Buscar otros datos" : "Generar gráfica"}
                </button>
                {chartError && <p role="alert" className="text-sm text-[var(--danger,#b4442e)]">{chartError}</p>}
              </div>
              <div className="min-h-0 min-w-0">
                {chart ? (
                  <div className="flex h-full min-h-[14rem] flex-col gap-3">
                    <div className="min-h-0 flex-1">
                      <InteractiveChart key={`${chart.chart.type}-${chart.chart.variant ?? ""}-${chart.chart.title}`} spec={chart.chart} compacto />
                    </div>
                    <details className="text-xs text-[var(--fg-muted)]">
                      <summary className="cursor-pointer">
                        Datos que encontró la IA en la web: <strong>verifica las fuentes antes de publicar.</strong>
                      </summary>
                      <p className="mt-1.5">{chart.sourceNote}</p>
                      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                        {chart.sources.map((x) => (
                          <li key={x.url}><a href={x.url} target="_blank" rel="noreferrer" className="lx-link">{x.title} ↗</a></li>
                        ))}
                      </ul>
                    </details>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={insertChart} className="lx-btn">
                        <Check size={15} /> {tokenInsertado ? "Actualizar en la nota" : "Insertar en la nota"}
                      </button>
                      {tokenInsertado && (
                        <>
                          <span className="text-xs font-medium text-[#16a34a]">✓ Ya está en la nota</span>
                          <button type="button" onClick={quitarGrafica} className="lx-link text-xs">Quitar de la nota</button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid h-full min-h-[12rem] place-items-center rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)]/50 p-6 text-center text-sm text-[var(--fg-muted)]">
                    {chartBusy ? <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Buscando datos y dibujando…</span> : "Aquí verás la gráfica en cuanto la generes."}
                  </div>
                )}
              </div>
            </div>
          </Step>
        )}

        {current.key === "portada" && (
          <Step ancho="xl" title="Imagen de portada" hint="La foto que ilustra la nota en el sitio y al compartirla. Es opcional: sin ella se usa una ilustración con la sección.">
            {/* --- Imagen: la foto a la izquierda y sus ajustes a la derecha --- */}
            <section aria-labelledby="pt-imagen" className="grid gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] p-4 @2xl:grid-cols-[1.4fr_1fr] @2xl:items-start sm:p-5">
              <h3 id="pt-imagen" className="sr-only">Imagen de portada</h3>
              <div
                className="min-w-0"
              >
              <div
                onDragOver={(e) => { e.preventDefault(); setArrastre(true); }}
                onDragLeave={() => setArrastre(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setArrastre(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f && f.type.startsWith("image/")) void onCover(f);
                }}
                className={`relative aspect-[16/9] max-h-[min(24rem,45dvh)] w-full overflow-hidden rounded-[var(--radius)] border transition ${cover ? "border-[var(--border)]" : "border-dashed"} ${arrastre ? "border-[var(--accent)] bg-[var(--accent)]/10" : "bg-[var(--surface-2)]/60"}`}
              >
                {cover ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cover} alt="" className="size-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                      <label className="lx-btn cursor-pointer !px-3 !py-1.5 text-xs">
                        <ImagePlus size={13} /> Cambiar
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void onCover(f); }} />
                      </label>
                      <button type="button" onClick={makeCover} disabled={genImg || uploading} className="lx-btn lx-btn-ghost !border-white/40 !bg-white/10 !px-3 !py-1.5 text-xs !text-white">
                        <Sparkles size={13} /> Generar otra
                      </button>
                      <button type="button" onClick={() => { setCover(""); setCoverAlt(""); }} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-white/90 hover:text-white">
                        <Trash2 size={13} /> Quitar
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="grid size-full place-items-center p-4 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <ImagePlus size={28} className="text-[var(--fg-muted)]" aria-hidden />
                      <p className="text-sm font-medium">Arrastra una foto aquí</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        <label className="lx-btn cursor-pointer">
                          <ImagePlus size={15} /> Subir foto
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void onCover(f); }} />
                        </label>
                        <button type="button" onClick={makeCover} disabled={genImg || uploading} className="lx-btn lx-btn-ghost">
                          <Sparkles size={15} /> Generar con IA
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {(uploading || genImg) && (
                  <div role="status" className="absolute inset-0 grid place-items-center bg-black/55 text-sm font-medium text-white">
                    <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> {genImg ? "Generando la imagen… unos 20 segundos" : "Subiendo…"}</span>
                  </div>
                )}
              </div>
              </div>
              <div className="flex min-w-0 flex-col gap-3 text-sm">
                <p className="text-xs text-[var(--fg-muted)]">{cover ? "Se publica con esta imagen." : "Sin imagen todavía."}</p>
                {imgError && <p role="alert" className="text-sm text-[var(--danger,#b4442e)]">{imgError}</p>}
                {cover && (
                  <input value={coverAlt} onChange={(e) => setCoverAlt(e.target.value)} placeholder="Qué se ve en la foto (texto alternativo)" className={`${input} text-sm`} />
                )}
                <div className="flex flex-col gap-2">
                  <details className="min-w-0">
                    <summary className="lx-link cursor-pointer text-xs font-medium">Pegar la URL de una imagen</summary>
                    <input value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://…" className={`${input} mt-2 text-sm`} />
                  </details>
                  <details className="min-w-0">
                    <summary className="lx-link cursor-pointer text-xs font-medium">Describir la escena para la IA</summary>
                    <input value={sceneTxt} onChange={(e) => setSceneTxt(e.target.value)} placeholder="Si lo dejas vacío, la IA propone la escena" className={`${input} mt-2 text-sm`} />
                    <p className="mt-1.5 text-xs text-[var(--fg-muted)]">Imagen realista, estilo cine (16:9); no retrata personas reales y se publica rotulada «imagen generada con IA».</p>
                  </details>
                </div>
              </div>
            </section>
          </Step>
        )}

        {current.key === "seo" && (
          <Step ancho="xl" title="Cómo se verá en Google" hint="Opcional. Si lo dejas vacío se usan el título y el resumen.">
            <div className="grid gap-4 @2xl:grid-cols-2 @2xl:items-start">
            <div className="flex flex-col gap-3">
            <input
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              placeholder={title || "Título para buscadores"}
              className={input}
            />
            <Counter value={(metaTitle || title).length} min={15} max={65} />
            <textarea
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              rows={4}
              placeholder={excerpt || "Descripción para buscadores"}
              className={`${input} resize-none`}
            />
            <Counter value={(metaDescription || excerpt).length} min={70} max={155} />
            </div>
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-4 text-left shadow-sm">
              <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#70757a]">Así aparece en Google</p>
              <div className="flex items-center gap-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#f1f3f4] text-xs font-bold text-[#202124]">C</span>
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm text-[#202124]">CONtexto Ganadero</p>
                  <p className="truncate text-xs text-[#4d5156]">contextoganadero.com › articulo</p>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-[1.15rem] leading-snug text-[#1a0dab]">{metaTitle || title || "Título de la nota"}</p>
              <p className="mt-1 line-clamp-2 text-sm leading-snug text-[#4d5156]">{metaDescription || excerpt || "La descripción de la nota aparecerá aquí."}</p>
            </div>
            </div>
          </Step>
        )}

        {current.key === "vista" && (
          <div className="flex min-h-[24rem] flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={back} className="lx-link inline-flex items-center gap-1 text-sm">
                <ArrowLeft size={14} /> Volver a editar
              </button>
              {canPublish && (
                <div role="group" aria-label="Distintivos de la nota" className="flex flex-wrap items-center gap-2">
                  {([
                    [breaking, setBreaking, "⚡ Última hora", "Barra roja en la portada y aviso por notificación a quienes tienen la app, una sola vez al publicar."],
                    [live, setLive, "🔴 En desarrollo", "Etiqueta «En vivo» en las tarjetas y en la nota."],
                  ] as const).map(([activo, cambiar, texto, ayuda]) => (
                    <button key={texto} type="button" aria-pressed={activo} title={ayuda} onClick={() => cambiar(!activo)}
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium transition ${activo ? "border-[var(--accent)] bg-[var(--accent)]/12 text-[var(--accent)]" : "border-[var(--border)] hover:border-[var(--accent)]"}`}>
                      {texto}
                    </button>
                  ))}
                </div>
              )}
              <p className="lx-kicker ml-auto flex items-center gap-2 text-[var(--accent)]">
                <Eye size={14} /> Así se verá en el sitio
              </p>
            </div>
            {canPublish && (breaking || live) && (
              <p className="-mt-1 text-xs text-[var(--fg-muted)]">
                {breaking && "Última hora: barra roja en la portada y aviso por notificación a quienes tienen la app, una sola vez al publicar. "}
                {live && "En desarrollo: etiqueta «En vivo» en las tarjetas y en la nota."}
              </p>
            )}
            {site ? (
              <div className="min-h-0 flex-1">
                <SiteArticlePreview
                  chrome={site}
                  title={title}
                  excerpt={excerpt}
                  bodyHtml={bodyHtml}
                  cover={cover}
                  coverAlt={coverAlt}
                  category={categoryName}
                  author={authorName}
                  minutes={Math.max(1, Math.round(words / 200))}
                  tags={tags}
                />
              </div>
            ) : (
              <p className="text-sm text-[var(--fg-muted)]">Vista previa no disponible.</p>
            )}
          </div>
        )}

        {aiNote && current.key === STEPS[1].key && !aiNotaCerrada && (
          <p className="mx-auto mt-5 flex max-w-2xl items-start gap-2 rounded-[var(--radius)] bg-[var(--surface-2)] p-3 text-xs text-[var(--fg-muted)]">
            <Sparkles size={13} className="mt-0.5 shrink-0 text-[var(--accent)]" />
            <span className="flex-1">{aiNote}</span>
            <button type="button" onClick={() => setAiNotaCerrada(true)} aria-label="Cerrar aviso" className="shrink-0 text-[var(--fg-muted)] hover:text-[var(--fg)]">
              <X size={14} />
            </button>
          </p>
        )}
        {error && current.key !== "tema" && (
          <p role="alert" className="mx-auto mt-4 w-full max-w-2xl rounded-[var(--radius)] border border-[var(--danger,#b4442e)]/40 bg-[var(--danger,#b4442e)]/8 px-3 py-2 text-sm text-[var(--danger,#b4442e)]">
            {error}
          </p>
        )}
      </div>

      {current.key !== "vista" && current.key !== "tema" && <SeoPanel score={audit.score} items={audit.items} groups={audit.groups} capped={audit.capped} focus={tags[0]} />}
      </div>

      {/* --- Navegación --- */}
      <div className="sticky bottom-0 z-20 flex shrink-0 items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-md">
        {step > 0 || (current.key === "tema" && (enPantallaOpciones || subpantalla)) ? (
          <button type="button" onClick={back} className="lx-btn lx-btn-ghost">
            <ArrowLeft size={15} /> Atrás
          </button>
        ) : (
          <span />
        )}
        {/* Qué falta para seguir (o cómo va): evita que un botón apagado parezca roto. */}
        <p className="hidden min-w-0 flex-1 truncate text-center text-xs text-[var(--fg-muted)] sm:block" aria-live="polite">
          {current.key === "tema"
            ? !options
              ? topic.trim().length < 10 && material.length === 0
                ? "Escribe el tema (mínimo 10 caracteres) o carga una fuente para continuar."
                : "Listo: la IA propondrá títulos y enfoques."
              : enOpciones && title.trim().length < 5
                ? "Elige un título (o escribe el tuyo) para generar el borrador."
                : ""
            : `Paso ${step + 1} de ${STEPS.length} · ${current.label}`}
        </p>
        {isLast ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {savedAs && (
              <span className="text-sm font-medium text-[#16a34a]">
                ✓ {savedAs === "publicar" ? "Publicado" : savedAs === "programar" ? "Programado" : savedAs === "revision" ? "Enviado a revisión" : "Guardado"}
              </span>
            )}
            {canPublish && (
              <div className="relative">
                <input type="hidden" name="programarPara" value={progFecha} />
                <button type="button" onClick={() => setProgAbierto((v) => !v)} aria-expanded={progAbierto} className="lx-btn lx-btn-ghost">
                  <CalendarClock size={15} /> Programar
                </button>
                {progAbierto && (
                  <div className="absolute bottom-full right-0 z-30 mb-2 w-[min(25rem,calc(100vw-2rem))] rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg-2)] p-4 text-left shadow-[var(--shadow-hover)]">
                    <p className="text-sm font-semibold">Programar la publicación</p>
                    <p className="mt-1 text-xs text-[var(--fg-muted)]">La nota queda guardada con todo (foto, gráficas, fuentes) y se publica sola a la hora elegida. Hora de Colombia.</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => presetProgramacion("lunes")} className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium hover:border-[var(--accent)]">Próximo lunes · 8:00 p. m.</button>
                      <button type="button" onClick={() => presetProgramacion("manana-am")} className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium hover:border-[var(--accent)]">Mañana · 7:00 a. m.</button>
                      <button type="button" onClick={() => presetProgramacion("manana-pm")} className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium hover:border-[var(--accent)]">Mañana · 8:00 p. m.</button>
                    </div>
                    <input type="datetime-local" value={progFecha} onChange={(e) => setProgFecha(e.target.value)} aria-label="Fecha y hora de publicación" className={`${input} mt-3 text-sm`} />
                    <ul className="mt-3 flex flex-col gap-1 text-xs">
                      {[
                        [Boolean(cover), "Foto de portada"],
                        [bodyHtml.includes("[[GRAFICA"), "Gráfica con datos (si la nota tiene cifras)"],
                        [Boolean(authorId), "Firma (autor)"],
                        [audit.score >= 75, `Puntuación SEO ≥ 75 (ahora ${audit.score})`],
                      ].map(([ok, txt]) => (
                        <li key={String(txt)} className={ok ? "text-[#16a34a]" : "text-[var(--fg-muted)]"}>{ok ? "✓" : "○"} {txt as string}</li>
                      ))}
                    </ul>
                    <button type="submit" name="intent" value="programar" disabled={!progFecha} className="lx-btn mt-3 w-full justify-center disabled:opacity-50">
                      <CalendarClock size={15} /> Programar para {progFecha ? progFecha.replace("T", " · ") : "…"}
                    </button>
                  </div>
                )}
              </div>
            )}
            <button type="submit" name="intent" value="borrador" className="lx-btn lx-btn-ghost">
              <Save size={15} /> Guardar borrador
            </button>
            {canPublish ? (
              <button type="submit" name="intent" value="publicar" className="lx-btn">
                <Send size={15} /> {status === "publicado" ? "Guardar y actualizar" : "Publicar"}
              </button>
            ) : (
              <button type="submit" name="intent" value="revision" className="lx-btn">
                <Send size={15} /> Enviar a revisión
              </button>
            )}
          </div>
        ) : current.key === "tema" && !generated ? (
          <button
            type="button"
            onClick={next}
            disabled={generating || (!options ? topic.trim().length < 10 && material.length === 0 : enOpciones && title.trim().length < 5)}
            className="lx-btn disabled:cursor-not-allowed disabled:opacity-60 disabled:saturate-50"
          >
            {generating ? (
              <><Loader2 size={15} className="animate-spin" /> {options ? "Redactando…" : "Buscando…"}</>
            ) : (
              <><Sparkles size={15} /> {!options ? "Proponer títulos y contextos" : !enOpciones ? "Ver títulos y contextos" : "Generar borrador"}</>
            )}
          </button>
        ) : (
          <button type="button" onClick={next} disabled={generating && current.key === "tema"} className="lx-btn disabled:opacity-70">
            {generating && current.key === "tema" ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Generando…
              </>
            ) : (
              <>
                {STEPS[step + 1].key === "vista" ? "Ver vista previa" : <>Siguiente<span className="hidden opacity-75 sm:inline"> · {STEPS[step + 1].label}</span></>} <ArrowRight size={15} />
              </>
            )}
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * Estructura común de cada paso: título, una línea de ayuda y el contenido, con una entrada suave.
 * Ocupa el alto que deja la tarjeta (`flex-1`) y es un contenedor de consulta: los pasos que lo piden se parten en
 * dos columnas según SU ancho (`@2xl:`), no el de la ventana, porque el panel SEO le quita espacio a la derecha.
 */
function Step({ title, hint, children, ancho = "md", centrado = false }: { title: string; hint: React.ReactNode; children: React.ReactNode; ancho?: "md" | "lg" | "xl"; /** Pasos cortos: se centran en vertical en vez de quedar pegados arriba con un hueco debajo. */ centrado?: boolean }) {
  return (
    <div className={`lx-step @container mx-auto flex min-h-0 w-full flex-col gap-4 ${centrado ? "my-auto" : "flex-1"} ${ancho === "xl" ? "max-w-5xl" : ancho === "lg" ? "max-w-3xl" : "max-w-2xl"}`}>
      <header className="flex shrink-0 flex-col gap-1">
        <h2 className="lx-display text-2xl font-semibold tracking-tight">{title}</h2>
        <div className="text-sm leading-snug text-[var(--fg-muted)]">{hint}</div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3.5">{children}</div>
    </div>
  );
}

/** Punto de selección de las tarjetas de opciones (título y enfoque). */
function Punto({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={`mt-0.5 grid size-[1.1rem] shrink-0 place-items-center rounded-full border transition ${on ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--border-strong,var(--border))]"}`}>
      {on && <Check size={11} strokeWidth={3} />}
    </span>
  );
}

/** Contador con medidor: zona ideal sombreada, verde dentro del rango, ámbar si falta y rojo si se pasa. */
function Counter({ value, min, max }: { value: number; min: number; max: number }) {
  const ok = value >= min && value <= max;
  const limite = Math.round(max * 1.2);
  const color = ok ? "#16a34a" : value > max ? "#dc2626" : "#d97706";
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={limite} aria-label="Longitud">
        <span className="absolute inset-y-0 bg-[#16a34a]/25" style={{ left: `${(min / limite) * 100}%`, width: `${((max - min) / limite) * 100}%` }} />
        <span className="absolute inset-y-0 left-0 rounded-full transition-all duration-300" style={{ width: `${Math.min(100, (value / limite) * 100)}%`, background: color }} />
      </div>
      <span className="shrink-0 text-xs font-medium tabular-nums" style={{ color }}>
        {value}
        <span className="font-normal text-[var(--fg-muted)]"> / {min}–{max}</span>
        {ok ? " ✓" : ""}
      </span>
    </div>
  );
}

/** Paso del asistente donde se corrige cada criterio de la auditoría. */
const STEP_OF: Record<string, string> = {
  "title-len": "Título o Buscadores",
  "desc-len": "Resumen o Buscadores",
  "desc-prosa": "Resumen",
  excerpt: "Resumen",
  cuerpo: "Cuerpo",
  intertitulos: "Cuerpo",
  parrafos: "Cuerpo",
  frases: "Cuerpo",
  "tema-titulo": "Título",
  "tema-entrada": "Cuerpo",
  alt: "Cuerpo",
  enlaces: "Cuerpo",
  pendientes: "Cuerpo",
  etiquetas: "Palabras clave",
  fuentes: "Cuerpo",
  firma: "Sección y autor",
  portada: "Imagen",
  "portada-alt": "Imagen",
  "titulo-limpio": "Título",
  "desc-distinta": "Resumen o Buscadores",
};

/**
 * Barra de SEO en vivo, en una sola línea: nota real de la auditoría, la
 * siguiente mejora y un desplegable con todo lo que falta, por gravedad.
 */
function SeoBar({ score, items, focus }: { score: number; items: AuditItem[]; focus?: string }) {
  const [open, setOpen] = useState(false);
  const pending = items
    .filter((i) => !i.ok)
    .sort((a, b) => (a.severity === b.severity ? b.weight - a.weight : a.severity === "error" ? -1 : 1));
  const done = items.length - pending.length;
  const color = score >= 75 ? "#16a34a" : score >= 55 ? "#d97706" : "#dc2626";
  // Color del punto según la gravedad del criterio de la auditoría.
  const dot = (i: AuditItem) => (i.severity === "error" ? "#dc2626" : "#d97706");

  return (
    <div className="lx-card relative shrink-0 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="lx-kicker text-[var(--fg-muted)]">SEO</span>
        <span className="text-xl font-semibold tabular-nums" style={{ color }}>
          {score}
        </span>
        <span className="text-sm font-semibold" style={{ color }}>
          {scoreLabel(score)}
        </span>
        <div
          className="h-2 min-w-[6rem] flex-1 overflow-hidden rounded-full bg-[var(--border)]"
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Puntuación SEO"
        >
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${score}%`, background: color }} />
        </div>
        <span className="text-xs text-[var(--fg-muted)]">
          {done}/{items.length} criterios
        </span>
        {pending.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs font-medium transition hover:border-[var(--accent)]"
          >
            {open ? "Cerrar" : `Qué falta (${pending.length})`}
          </button>
        ) : (
          <span className="text-xs font-medium text-[#16a34a]">Todo en orden ✓</span>
        )}
      </div>
      {pending[0] && (
        <p className="mt-1 truncate text-xs text-[var(--fg-muted)]">
          <span className="mr-1.5 inline-block size-1.5 rounded-full align-middle" style={{ background: dot(pending[0]) }} />
          Siguiente mejora: {pending[0].text}
          {STEP_OF[pending[0].id] && <span className="text-[var(--accent)]"> · {STEP_OF[pending[0].id]}</span>}
          {!focus && " · añade palabras clave para medir la principal"}
        </p>
      )}
      {open && (
        <ul className="absolute inset-x-0 top-full z-40 mt-1 flex max-h-[50vh] flex-col gap-2 overflow-y-auto rounded-[var(--radius)] border border-[var(--border)] bg-white p-4 shadow-lg">
          {pending.map((i) => (
            <li key={i.id} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: dot(i) }} />
              <span>
                {i.text}
                {i.help && <span className="text-[var(--fg-muted)]"> — {i.help}</span>}
                {STEP_OF[i.id] && <span className="ml-1 text-xs text-[var(--accent)]">({STEP_OF[i.id]})</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Panel SEO lateral (escritorio): nota, barra y los criterios, por páginas (lo que falta y lo cumplido), sin desplazarse. */
function SeoPanel({ score, items, groups, capped, focus }: { score: number; items: AuditItem[]; groups: AuditResult["groups"]; capped: boolean; focus?: string }) {
  const [vista, setVista] = useState<"falta" | "cumplido">("falta");
  const alto = useAltoVentana();
  const pending = items
    .filter((i) => !i.ok)
    .sort((a, b) => (a.severity === b.severity ? b.weight - a.weight : a.severity === "error" ? -1 : 1));
  const passed = items.filter((i) => i.ok);
  const color = score >= 75 ? "#16a34a" : score >= 55 ? "#d97706" : "#dc2626";
  // Si no queda nada pendiente, se muestra lo cumplido.
  const mostrar = vista === "falta" && pending.length > 0 ? "falta" : "cumplido";

  return (
    <aside className="lx-card hidden min-h-0 w-72 shrink-0 flex-col p-0 lg:flex xl:w-80" style={{ transform: "none" }} aria-label="Puntuación SEO">
      <div className="shrink-0 border-b border-[var(--border)] p-4">
        <p className="lx-kicker text-[var(--fg-muted)]">SEO en vivo</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums" style={{ color }}>
            {score}
          </span>
          <span className="text-sm font-semibold" style={{ color }}>
            {scoreLabel(score)}
          </span>
          <span className="ml-auto text-xs text-[var(--fg-muted)]">
            {passed.length}/{items.length}
          </span>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--border)]"
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${score}%`, background: color }} />
        </div>
        {capped && (
          <p className="mt-2 text-xs font-medium text-[#b45309]">
            Falta un criterio crítico de Google (firma, fuentes, titular o datos por confirmar): la nota no puede pasar de «Bueno».
          </p>
        )}
        <ul className="mt-3 flex flex-col gap-1.5">
          {groups.filter((g) => g.score !== null).map((g) => (
            <li key={g.id} className="text-xs">
              <div className="flex justify-between gap-2"><span>{g.label}</span><span className="tabular-nums text-[var(--fg-muted)]">{g.score} %</span></div>
              <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-[var(--border)]">
                <div className="h-full rounded-full" style={{ width: `${g.score}%`, background: (g.score ?? 0) >= 75 ? "#16a34a" : (g.score ?? 0) >= 55 ? "#d97706" : "#dc2626" }} />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-[var(--fg-muted)]">
          {focus ? `Palabra clave: «${focus}»` : "Añade palabras clave para medir la principal."}
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-4">
        <div role="group" aria-label="Criterios" className="grid shrink-0 grid-cols-2 gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1">
          {([["falta", `Falta (${pending.length})`], ["cumplido", `Cumplido (${passed.length})`]] as const).map(([v, texto]) => (
            <button key={v} type="button" aria-pressed={mostrar === v} onClick={() => setVista(v)}
              className={`rounded-full px-2 py-1 text-xs font-semibold transition ${mostrar === v ? "bg-[var(--accent)] text-[var(--accent-fg,#fff)] shadow-sm" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>
              {texto}
            </button>
          ))}
        </div>
        <Carrusel
          key={mostrar}
          etiqueta={mostrar === "falta" ? "Criterios pendientes" : "Criterios cumplidos"}
          items={mostrar === "falta" ? pending : passed}
          filas={filasListas(alto, 245, 92, 2, 6)}
          maxColumnas={1}
          anchoMinimo={120}
          render={(i) =>
            mostrar === "falta" ? (
              <span className="flex items-start gap-2 text-sm leading-snug">
                <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: i.severity === "error" ? "#dc2626" : "#d97706" }} />
                <span>
                  {i.text}
                  {i.help && <span className="line-clamp-2 block text-xs text-[var(--fg-muted)]">{i.help}</span>}
                  {STEP_OF[i.id] && <span className="block text-xs text-[var(--accent)]">→ {STEP_OF[i.id]}</span>}
                </span>
              </span>
            ) : (
              <span className="flex items-start gap-2 text-xs text-[var(--fg-muted)]">
                <Check size={12} className="mt-0.5 shrink-0 text-[#16a34a]" /> {i.text}
              </span>
            )
          }
        />
      </div>
    </aside>
  );
}
