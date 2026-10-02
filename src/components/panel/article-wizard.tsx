"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarClock,
  Check,
  Eye,
  ImagePlus,
  Loader2,
  Lightbulb,
  Link2,
  Mic,
  RotateCcw,
  Save,
  Search,
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
import type { Material } from "@/lib/material-types";
import { SiteArticlePreview, type SitePreviewChrome } from "@/components/panel/site-article-preview";
import { decodeSpec, encodeSpec, renderChartSvg, svgDataUri } from "@/lib/chart-svg";
import { auditArticle, scoreLabel, type AuditItem, type AuditResult } from "@/lib/seo-audit";

type Option = { id: string; name: string };

const STATUS_LABEL: Record<string, string> = {
  borrador: "Borrador",
  en_revision: "En revisión",
  programado: "Programado",
  publicado: "Publicado",
  archivado: "Archivado",
};

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
};

const STEPS_MANUAL = [
  { key: "titulo", label: "Título" },
  { key: "resumen", label: "Resumen" },
  { key: "claves", label: "Palabras clave" },
  { key: "seccion", label: "Sección y autor" },
  { key: "cuerpo", label: "Cuerpo" },
  { key: "portada", label: "Portada" },
  { key: "seo", label: "Buscadores" },
  { key: "vista", label: "Vista previa" },
] as const;

type StepKey = (typeof STEPS_MANUAL)[number]["key"] | "tema";

// Con IA el primer paso pide título y contexto; el resto es igual, pero ya
// viene prellenado por el borrador para que el redactor lo revise.
const STEPS_IA: { key: StepKey; label: string }[] = [
  { key: "tema", label: "Título y contexto" },
  ...STEPS_MANUAL.slice(1),
];

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

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Convierte las URL escritas a mano en enlaces. */
const linkify = (s: string) =>
  s.replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (u) => `<a href="${u}" rel="noopener">${u}</a>`);

/**
 * Texto plano -> HTML: cada bloque separado por una línea en blanco es un
 * párrafo; una línea que empieza por "## " es un intertítulo. Si el redactor
 * ya escribió HTML, se respeta tal cual.
 */
function toHtml(text: string): string {
  if (/<\/?(p|h2|h3|ul|ol|figure|blockquote)\b/i.test(text)) return text;
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
  mode = "manual",
  initial,
  startStep,
  site,
  status,
  canPublish = false,
  savedAs,
}: {
  categories: Option[];
  authors: Option[];
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
  const [ideasOpen, setIdeasOpen] = useState(true);
  const [newsQuery, setNewsQuery] = useState("");
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [newsOpen, setNewsOpen] = useState(true);
  const [newsError, setNewsError] = useState("");
  const [refs, setRefs] = useState<NewsItem[]>([]);
  const [newsFiltro, setNewsFiltro] = useState<"todo" | NewsItem["type"]>("todo");
  const [searchingNews, startNews] = useTransition();
  const [enOpciones, setEnOpciones] = useState(false);
  const [fuente, setFuente] = useState<"ideas" | "noticias" | "entrevista" | "enlaces">("ideas");
  const [progAbierto, setProgAbierto] = useState(false);
  const [progFecha, setProgFecha] = useState("");
  const [material, setMaterial] = useState<Material[]>([]);
  const [audioError, setAudioError] = useState("");
  const [audioBusy, startAudio] = useTransition();
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
  const [chart, setChart] = useState<Extract<ChartResult, { ok: true }> | null>(null);
  const [chartBusy, startChart] = useTransition();
  const [chartError, setChartError] = useState("");
  const prompt = [topic.trim(), context.trim()].filter(Boolean).join("\n\n");
  // Un artículo reabierto ya tiene borrador: se puede revisar y regenerar.
  const [generated, setGenerated] = useState(!!initial);
  const [aiNote, setAiNote] = useState("");
  const [generating, startGenerating] = useTransition();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [authorId, setAuthorId] = useState(initial?.authorId ?? "");
  const [body, setBody] = useState(() => (initial?.body ? toText(initial.body) : ""));
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
  snapRef.current = snapshot;
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
  const authorName = authors.find((a) => a.id === authorId)?.name;

  // Qué impide avanzar desde cada paso (solo título y resumen son obligatorios).
  const blocker: Record<string, string | null> = {
    tema: !generated ? "Elige un título y un contexto y genera el borrador para continuar." : null,
    titulo: title.trim().length < 5 ? "Escribe un título de al menos 5 caracteres." : null,
    resumen: excerpt.trim().length < 20 ? "El resumen debe tener al menos 20 caracteres." : null,
  };
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

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
  function back() {
    setError("");
    // En la pantalla de títulos y enfoque, «Atrás» vuelve a elegir la fuente, no al paso anterior.
    if (current.key === "tema" && enOpciones) return setEnOpciones(false);
    setStep((s) => Math.max(s - 1, 0));
  }
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

  function addTags(raw: string) {
    const nuevos = raw
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t && !tags.includes(t));
    if (nuevos.length) setTags([...tags, ...nuevos].slice(0, 12));
    setTagDraft("");
  }

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
      setTitle(d.title || title);
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

  function makeChart() {
    setChartError("");
    setChart(null);
    startChart(async () => {
      const res = await generateChart({
        topic: chartTopic.trim() || title.trim(),
        section: categories.find((c) => c.id === categoryId)?.name,
      });
      if (!res.ok) return setChartError(res.error);
      setChart(res);
    });
  }
  function insertChart() {
    if (!chart) return;
    const fuente = `Fuente: ${chart.sourceNote || "Google Search"}. Consultado en: ${chart.sources.slice(0, 3).map((x) => x.title).join(", ")}.`;
    const alt = chart.chart.title.replace(/[|\]]/g, " ");
    setBody((b) => `${b.trimEnd()}\n\n[[GRAFICA ${encodeSpec(chart.chart)} | ${alt} | ${fuente.replace(/[|\]]/g, " ")}]]\n`);
    setChart(null);
    setChartTopic("");
    setChartError("");
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

  function subirEntrevista(f: File) {
    setAudioError("");
    startAudio(async () => {
      try {
        let res;
        if (f.size <= 3.5 * 1024 * 1024) {
          const fd = new FormData();
          fd.append("audio", f);
          res = await transcribirEntrevista(fd);
        } else {
          const c = await crearSubidaAudio({ name: f.name, type: f.type, size: f.size });
          if (!c.ok) return setAudioError(c.error);
          const put = await fetch(c.uploadUrl, { method: "PUT", headers: { "content-type": f.type || "audio/mpeg" }, body: f });
          if (!put.ok) return setAudioError(`No se pudo subir el audio (${put.status}).`);
          res = await transcribirEntrevistaSubida({ path: c.path, name: f.name });
        }
        if (!res.ok) return setAudioError(res.error);
        setMaterial((m) => [...m, res.material]);
        setOptions(null);
      } catch {
        setAudioError("No se pudo procesar el audio. Inténtalo de nuevo.");
      }
    });
  }
  function cargarEnlaces() {
    setUrlsError("");
    startUrls(async () => {
      const res = await leerEnlaces({ urls: urlsTxt });
      if (!res.ok) return setUrlsError(res.error);
      setMaterial((m) => [...m, ...res.materiales.filter((n) => !m.some((x) => x.url === n.url))]);
      setOptions(null);
      setUrlsTxt("");
      if (res.fallidos.length) setUrlsError(`No se pudieron leer: ${res.fallidos.join(", ")}`);
    });
  }

  function makeCover() {
    setImgError("");
    startImg(async () => {
      const res = await generateCoverImage({
        title,
        excerpt,
        section: categories.find((c) => c.id === categoryId)?.name,
        scene: sceneTxt,
      });
      if (!res.ok) return setImgError(res.error);
      setCover(res.url);
      setCoverAlt(res.alt);
    });
  }

  function findNews() {
    setNewsError("");
    startNews(async () => {
      const res = await searchNewsAbout({ query: newsQuery, section: categories.find((c) => c.id === categoryId)?.name });
      if (!res.ok) return setNewsError(res.error);
      setNews(res.items);
      setNewsOpen(true);
    });
  }
  const isRef = (n: NewsItem) => refs.some((r) => r.url === n.url);
  function toggleRef(n: NewsItem) {
    setRefs((r) => (r.some((x) => x.url === n.url) ? r.filter((x) => x.url !== n.url) : [...r, n]));
  }
  function elegirNoticiaComoTema(n: NewsItem) {
    setTopic(`${n.title}. ${n.summary} (Fuente: ${n.outlet}${n.date ? `, ${n.date}` : ""}).`);
    setOptions(null);
    setRefs((r) => (r.some((x) => x.url === n.url) ? r : [...r, n]));
    setNewsOpen(false);
  }

  function findIdeas() {
    setIdeasError("");
    startIdeas(async () => {
      const res = await suggestTopicIdeas({
        section: categories.find((c) => c.id === categoryId)?.name,
        focus: ideasFocus,
      });
      if (!res.ok) return setIdeasError(res.error);
      setIdeas({ ideas: res.ideas, sources: res.sources });
      setIdeasOpen(true);
    });
  }

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

  return (
    <form
      action={saveArticle}
      // Todo el asistente cabe en la ventana: solo la tarjeta del paso tiene
      // scroll interno si su contenido (cuerpo largo, vista previa) lo exige.
      className="-my-6 flex h-[calc(100dvh-var(--panel-header-h,61px)-5.75rem)] min-h-[30rem] flex-col gap-3"
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
      <input type="hidden" name="isBreaking" value="0" />
      <input type="hidden" name="isLive" value="0" />

      {/* --- Progreso --- */}
      <div className="lx-card shrink-0 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-sm font-semibold">
            {initial ? "Editar artículo" : heading} · Paso {step + 1} de {STEPS.length}: {current.label}
            {status && (
              <span className="ml-2 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs font-medium text-[var(--fg-muted)]">
                {STATUS_LABEL[status] ?? status}
              </span>
            )}
          </span>
          <ol className="hidden flex-1 flex-wrap gap-1 lg:flex">
            {STEPS.map((s, i) => (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.72rem] transition ${
                    i === step
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : i < step
                        ? "border-[var(--border-strong)] text-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--fg-muted)]"
                  }`}
                >
                  {i < step && <Check size={10} />} {s.label}
                </button>
              </li>
            ))}
          </ol>
          <span className="ml-auto flex items-center gap-3 text-xs">
            <span role="status" aria-live="polite" className="text-[var(--fg-muted)]">
              {autoEstado === "guardando" && "Guardando…"}
              {autoEstado === "guardado" && `✓ Borrador guardado · ${autoHora}`}
              {autoEstado === "error" && <span className="text-[var(--danger,#b4442e)]">No se pudo autoguardar</span>}
              {autoEstado === "omitido" && "Nota publicada: guarda con los botones"}
              {autoEstado === "idle" && title.trim().length < 5 && "Se guarda solo desde que escribas el título"}
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
              <ArrowLeft size={12} /> Volver a artículos
            </Link>
          </span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--border)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="lg:hidden">
        <SeoBar score={audit.score} items={audit.items} focus={tags[0]} />
      </div>

      {/* --- Pantalla del paso + panel SEO lateral (escritorio) --- */}
      <div className="flex min-h-0 flex-1 gap-3">
      <div className="lx-card min-h-0 flex-1 p-5 sm:p-6" style={{ overflowY: "auto", transform: "none" }}>
        {mode === "ia" && generated && PART_OF[current.key] && (
          <div className="mx-auto mb-4 flex max-w-2xl flex-wrap items-center gap-2 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-2)] px-3 py-2">
            <Sparkles size={14} className="text-[var(--accent)]" />
            <span className="mr-auto text-sm">Propuesta de la IA. ¿Te gusta?</span>
            <button
              type="button"
              onClick={() => regenerate(PART_OF[current.key]!)}
              disabled={generating}
              className="lx-btn lx-btn-ghost !py-1.5 text-xs"
            >
              {generating ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
              {generating ? "Regenerando…" : "Regenerar"}
            </button>
            <button type="button" onClick={next} disabled={generating} className="lx-btn !py-1.5 text-xs">
              <Check size={13} /> Me gusta
            </button>
          </div>
        )}
        {current.key === "tema" && (generating || error) && (
          <div
            role="status"
            className={`sticky top-0 z-10 mx-auto mb-4 flex max-w-2xl items-center gap-3 rounded-[var(--radius)] border px-4 py-3 text-sm font-medium shadow-md ${
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
            title={enOpciones && options ? "Elige el título y el enfoque" : "Tema, título y contexto"}
            hint={enOpciones && options ? "La IA propone varios títulos y enfoques a partir de tu material. Elige uno de cada uno (puedes editarlos) y genera el borrador." : "Describe el tema, o parte de una noticia, una entrevista o unos enlaces. La IA propone títulos y enfoques; tú eliges y revisas cada paso."}
          >
                        {!(enOpciones && options) && (
              <>
            <textarea
              autoFocus
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              placeholder="Cuéntale a la IA de qué trata la nota. Ej.: el precio del novillo gordo subió 4 % en Medellín en septiembre según la Central Ganadera; menor entrada de ganado del Magdalena Medio…"
              className={`${input} resize-y text-base leading-relaxed`}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={suggest} disabled={generating} className="lx-btn">
                {generating && !options ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {options ? "Proponer otras opciones" : "Proponer títulos y contextos"}
              </button>
              <span className="text-xs text-[var(--fg-muted)]">Nada se publica sin tu revisión.</span>
            </div>

            <div className="mt-2">
              <p className="lx-kicker text-[var(--fg-muted)]">¿Prefieres partir de otra cosa?</p>
              <div role="tablist" aria-label="Fuente para empezar" className="mt-2 flex gap-2 overflow-x-auto pb-1">
                <button type="button" role="tab" id="tab-ideas" aria-selected={fuente === "ideas"} aria-controls="panel-fuente" onClick={() => setFuente("ideas")} className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${fuente === "ideas" ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm" : "border-[var(--border)] bg-[var(--bg-2)] hover:border-[var(--accent)]"}`}>
                  <Lightbulb size={15} aria-hidden /> Ideas de la IA
                </button>
                <button type="button" role="tab" id="tab-noticias" aria-selected={fuente === "noticias"} aria-controls="panel-fuente" onClick={() => setFuente("noticias")} className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${fuente === "noticias" ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm" : "border-[var(--border)] bg-[var(--bg-2)] hover:border-[var(--accent)]"}`}>
                  <Search size={15} aria-hidden /> Buscar noticias
                </button>
                <button type="button" role="tab" id="tab-entrevista" aria-selected={fuente === "entrevista"} aria-controls="panel-fuente" onClick={() => setFuente("entrevista")} className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${fuente === "entrevista" ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm" : "border-[var(--border)] bg-[var(--bg-2)] hover:border-[var(--accent)]"}`}>
                  <Mic size={15} aria-hidden /> Entrevista de voz
                </button>
                <button type="button" role="tab" id="tab-enlaces" aria-selected={fuente === "enlaces"} aria-controls="panel-fuente" onClick={() => setFuente("enlaces")} className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${fuente === "enlaces" ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm" : "border-[var(--border)] bg-[var(--bg-2)] hover:border-[var(--accent)]"}`}>
                  <Link2 size={15} aria-hidden /> Enlaces
                </button>
              </div>
              <div id="panel-fuente" role="tabpanel" aria-labelledby={`tab-${fuente}`} className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] p-4">
                {fuente === "ideas" && <p className="mb-3 text-sm text-[var(--fg-muted)]">La IA busca en internet qué es tendencia en el sector, en Colombia y en el mundo, y te propone temas con sus fuentes.</p>}
                {fuente === "noticias" && <p className="mb-3 text-sm text-[var(--fg-muted)]">Escribe una persona, empresa o tema (p. ej. «Joaquín Manjarrés»): investiga en medios, YouTube y fuentes oficiales. Eliges cuáles <strong>referenciar</strong> o usar <strong>como tema</strong>.</p>}
                {fuente === "entrevista" && <p className="mb-3 text-sm text-[var(--fg-muted)]">Sube el audio y la IA lo transcribe. Puedes corregir el texto antes de redactar. MP3, M4A, WAV, OGG… hasta 20 MB.</p>}
                {fuente === "enlaces" && <p className="mb-3 text-sm text-[var(--fg-muted)]">Pega hasta 5 enlaces (uno por línea): la IA lee cada página y redacta con palabras propias, atribuyendo.</p>}
                {fuente === "ideas" && (
                  <div>
              
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={ideasFocus}
                  onChange={(e) => setIdeasFocus(e.target.value)}
                  placeholder="Opcional: enfoque (p. ej. leche, exportaciones, sanidad)"
                  className={`${input} min-w-0 flex-1 !py-2 text-sm`}
                />
                <button type="button" onClick={findIdeas} disabled={searchingIdeas || generating} className="lx-btn">
                  {searchingIdeas ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  {ideas ? "Buscar otros temas" : "Aconséjame temas"}
                </button>
              </div>
              {searchingIdeas && <p role="status" className="mt-3 text-xs text-[var(--fg-muted)]">Buscando tendencias en internet… puede tardar hasta un minuto.</p>}
              {ideasError && <p role="alert" className="mt-3 text-sm text-[var(--danger,#b4442e)]">{ideasError}</p>}
              {ideas && !ideasOpen && (
                <p className="mt-3 text-xs text-[var(--fg-muted)]">
                  Tema elegido: revisa el cuadro de abajo y pulsa «Proponer títulos y contextos».{" "}
                  <button type="button" onClick={() => setIdeasOpen(true)} className="lx-link font-semibold">Ver los temas sugeridos</button>
                </p>
              )}
              {ideas && ideasOpen && (
                <div className="mt-4 flex flex-col gap-2">
                  {ideas.ideas.map((i) => (
                    <button
                      key={i.title}
                      type="button"
                      onClick={() => {
                        setTopic(`${i.title}. ${i.angle}`);
                        setOptions(null);
                        setIdeasOpen(false);
                      }}
                      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] p-3 text-left transition hover:border-[var(--accent)]"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide ${i.scope === "local" ? "bg-[var(--accent)]/12 text-[var(--accent)]" : "bg-[var(--accent-2)]/15 text-[var(--accent-2)]"}`}>
                          {i.scope === "local" ? "Colombia" : "Internacional"}
                        </span>
                        <span className="font-semibold">{i.title}</span>
                      </span>
                      <span className="mt-1 block text-sm">{i.angle}</span>
                      <span className="mt-1 block text-xs text-[var(--fg-muted)]">Tendencia: {i.why}</span>
                    </button>
                  ))}
                  <p className="text-xs text-[var(--fg-muted)]">Pulsa un tema para usarlo; luego «Proponer títulos y contextos». Fuentes consultadas:</p>
                  <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {ideas.sources.map((x) => (
                      <li key={x.url}><a href={x.url} target="_blank" rel="noopener noreferrer" className="lx-link">{x.title}</a></li>
                    ))}
                  </ul>
                </div>
              )}
              </div>
                )}
                {fuente === "noticias" && (
                  <div>
                
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={newsQuery}
                    onChange={(e) => setNewsQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (!searchingNews && newsQuery.trim().length >= 3) findNews();
                      }
                    }}
                    placeholder="Persona, empresa o tema a investigar"
                    className={`${input} min-w-0 flex-1 !py-2 text-sm`}
                  />
                  <button type="button" onClick={findNews} disabled={searchingNews || generating || newsQuery.trim().length < 3} className="lx-btn">
                    {searchingNews ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                    {news ? "Buscar de nuevo" : "Buscar noticias"}
                  </button>
                </div>
                {searchingNews && <p role="status" className="mt-3 text-xs text-[var(--fg-muted)]">Investigando en la web… puede tardar hasta un minuto.</p>}
                {newsError && <p role="alert" className="mt-3 text-sm text-[var(--danger,#b4442e)]">{newsError}</p>}
                {refs.length > 0 && (
                  <p className="mt-3 text-xs text-[var(--fg-muted)]">
                    <strong className="text-[var(--fg)]">Referencias elegidas ({refs.length}):</strong>{" "}
                    {refs.map((r) => r.outlet || r.title).join(" · ")}. Irán enlazadas al final de la nota (los videos, además, incrustados).
                  </p>
                )}
                {news && !newsOpen && (
                  <p className="mt-3 text-xs text-[var(--fg-muted)]">
                    Tema elegido: revisa el cuadro de abajo y pulsa «Proponer títulos y contextos».{" "}
                    <button type="button" onClick={() => setNewsOpen(true)} className="lx-link font-semibold">Ver las noticias encontradas</button>
                  </p>
                )}
                {news && newsOpen && (
                  <div className="mt-3 flex flex-col gap-2">
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar resultados">
                      {(["todo", "noticia", "video", "oficial"] as const).map((f) => {
                        const cuantos = f === "todo" ? news.length : news.filter((n) => n.type === f).length;
                        if (f !== "todo" && cuantos === 0) return null;
                        return (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setNewsFiltro(f)}
                            aria-pressed={newsFiltro === f}
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${newsFiltro === f ? "border-[var(--accent)] bg-[var(--surface-2)]" : "border-[var(--border)] hover:border-[var(--accent)]"}`}
                          >
                            {f === "todo" ? "Todo" : f === "noticia" ? "Noticias" : f === "video" ? "Videos de YouTube" : "Oficiales y redes"} ({cuantos})
                          </button>
                        );
                      })}
                    </div>
                    {news.filter((n) => newsFiltro === "todo" || n.type === newsFiltro).map((n) => (
                      <div key={n.url} className={`flex gap-3 rounded-[var(--radius)] border bg-[var(--bg-2)] p-3 ${isRef(n) ? "border-[var(--accent)]" : "border-[var(--border)]"}`}>
                        {n.videoId && (
                          // eslint-disable-next-line @next/next/no-img-element -- miniatura externa de YouTube
                          <img src={`https://img.youtube.com/vi/${n.videoId}/mqdefault.jpg`} alt="" loading="lazy" className="hidden h-20 w-36 shrink-0 rounded-md object-cover sm:block" />
                        )}
                        <div className="min-w-0 flex-1">
                        <p className="text-xs text-[var(--fg-muted)]">
                          {n.type === "video" && <span className="mr-1.5 rounded-full bg-[#dc2626]/12 px-2 py-0.5 font-semibold text-[#b91c1c]">▶ Video</span>}
                          {n.type === "oficial" && <span className="mr-1.5 rounded-full bg-[var(--accent)]/12 px-2 py-0.5 font-semibold text-[var(--accent)]">Oficial</span>}
                          {n.outlet}{n.date ? ` · ${n.date}` : ""}
                        </p>
                        <p className="mt-0.5 font-semibold leading-snug">{n.title}</p>
                        <p className="mt-1 text-sm">{n.summary}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button type="button" onClick={() => elegirNoticiaComoTema(n)} className="lx-btn !py-1.5 text-xs">Escribir sobre esto</button>
                          <button type="button" onClick={() => toggleRef(n)} aria-pressed={isRef(n)} className="lx-btn lx-btn-ghost !py-1.5 text-xs">
                            {isRef(n) ? "✓ Referenciada" : n.type === "video" ? "Referenciar e incrustar" : "Referenciar"}
                          </button>
                          <a href={n.url} target="_blank" rel="noopener noreferrer" className="lx-link text-xs">{n.type === "video" ? "Ver en YouTube ↗" : "Abrir fuente ↗"}</a>
                        </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
                )}
                {fuente === "entrevista" && (
                  <div>
                  
                  <label className={`lx-btn cursor-pointer ${audioBusy ? "pointer-events-none opacity-60" : ""}`}>
                    {audioBusy ? <Loader2 size={15} className="animate-spin" /> : <Mic size={15} />}
                    {audioBusy ? "Transcribiendo…" : "Subir audio"}
                    <input
                      type="file"
                      accept="audio/*,.mp3,.m4a,.wav,.ogg,.opus,.webm,.aac,.flac"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) subirEntrevista(f);
                      }}
                    />
                  </label>
                  <p className="mt-1.5 text-xs text-[var(--fg-muted)]">MP3, M4A, WAV, OGG… hasta 20 MB. Puede tardar un par de minutos.</p>
                  {audioError && <p role="alert" className="mt-2 text-sm text-[var(--danger,#b4442e)]">{audioError}</p>}
                </div>
                )}
                {fuente === "enlaces" && (
                  <div>
                  
                  <textarea
                    value={urlsTxt}
                    onChange={(e) => setUrlsTxt(e.target.value)}
                    rows={2}
                    placeholder="https://…"
                    className={`${input} resize-y !py-2 text-sm`}
                  />
                  <button type="button" onClick={cargarEnlaces} disabled={urlsBusy || urlsTxt.trim().length < 8} className="lx-btn mt-2">
                    {urlsBusy ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
                    {urlsBusy ? "Leyendo…" : "Leer enlaces"}
                  </button>
                  {urlsError && <p role="alert" className="mt-2 text-sm text-[var(--danger,#b4442e)]">{urlsError}</p>}
                </div>
                )}
              </div>
              {material.length > 0 && (
                <ul className="mt-4 flex flex-col gap-2">
                  {material.map((m, i) => (
                    <li key={`${m.kind}-${i}-${m.title}`} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[var(--accent)]/12 px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--accent)]">
                          {m.kind === "entrevista" ? "Entrevista" : "Enlace"}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{m.title}</span>
                        <span className="text-xs text-[var(--fg-muted)]">{m.text.length.toLocaleString("es-CO")} car.</span>
                        <button type="button" onClick={() => { setMaterial((x) => x.filter((_, k) => k !== i)); setOptions(null); }} className="lx-link text-xs">Quitar</button>
                      </div>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-[var(--accent)]">Ver y corregir el texto</summary>
                        <textarea
                          value={m.text}
                          onChange={(e) => setMaterial((x) => x.map((y, k) => (k === i ? { ...y, text: e.target.value } : y)))}
                          rows={8}
                          className={`${input} mt-2 resize-y text-sm leading-relaxed`}
                        />
                        {m.url && <a href={m.url} target="_blank" rel="noopener noreferrer" className="lx-link mt-1 inline-block text-xs">Abrir enlace ↗</a>}
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </div>
              </>
            )}

            {options && enOpciones && (
              <>
                <div className="flex flex-wrap items-start gap-3 rounded-[var(--radius)] bg-[var(--surface-2)] p-3 text-sm">
                  <p className="min-w-0 flex-1 text-[var(--fg-muted)]">
                    <strong className="text-[var(--fg)]">Tema:</strong> {(topic.trim() || material[0]?.title || "—").slice(0, 160)}
                    {material.length > 0 && ` · ${material.length} material${material.length > 1 ? "es" : ""} cargado${material.length > 1 ? "s" : ""}`}
                  </p>
                  <button type="button" onClick={() => setEnOpciones(false)} className="lx-link inline-flex items-center gap-1 text-xs font-semibold">
                    <ArrowLeft size={12} /> Cambiar tema o fuente
                  </button>
                </div>
                <p className="lx-kicker mt-2 text-[var(--accent)]">1 · Elige un título</p>
                <div className="flex flex-col gap-2">
                  {options.titles.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTitle(t)}
                      aria-pressed={title === t}
                      className={`rounded-[var(--radius)] border px-4 py-3 text-left text-base font-semibold transition ${
                        title === t
                          ? "border-[var(--accent)] bg-[var(--surface-2)]"
                          : "border-[var(--border)] hover:border-[var(--accent)]"
                      }`}
                    >
                      {t} <span className="ml-1 text-xs font-normal text-[var(--fg-muted)]">{t.length} car.</span>
                    </button>
                  ))}
                </div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="O escribe el tuyo"
                  className={`${input} lx-display text-lg font-semibold`}
                />
                <Counter value={title.length} min={15} max={65} />

                <p className="lx-kicker mt-2 text-[var(--accent)]">2 · Elige un contexto (enfoque de la nota)</p>
                <div className="flex flex-col gap-2">
                  {options.contexts.map((c, i) => (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => {
                        setPickedContext(i);
                        setContext(c.text);
                      }}
                      aria-pressed={pickedContext === i}
                      className={`rounded-[var(--radius)] border px-4 py-3 text-left transition ${
                        pickedContext === i
                          ? "border-[var(--accent)] bg-[var(--surface-2)]"
                          : "border-[var(--border)] hover:border-[var(--accent)]"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{c.label}</span>
                      <span className="mt-1 block text-sm text-[var(--fg-muted)]">{c.text}</span>
                    </button>
                  ))}
                </div>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={3}
                  placeholder="El contexto elegido aparece aquí y lo puedes ajustar"
                  className={`${input} resize-y text-base leading-relaxed`}
                />

                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={generate} disabled={generating} className="lx-btn">
                    {generating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    {generating ? "Redactando…" : generated ? "Volver a generar" : "Generar borrador con esta selección"}
                  </button>
                  {generated && (
                    <span className="text-xs text-[var(--fg-muted)]">Ya hay un borrador: pulsa Siguiente para revisarlo.</span>
                  )}
                </div>
              </>
            )}
          </Step>
        )}

        {current.key === "titulo" && (
          <Step title="¿Cuál es el título?" hint="Claro y concreto: lo que verá el lector y Google. Ideal entre 15 y 65 caracteres.">
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
          <Step title="Resume la noticia" hint="Dos o tres líneas que expliquen por qué importa. Es la entradilla y, por defecto, la descripción en buscadores.">
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
          <Step title="Palabras clave" hint="Temas de la nota. Escribe una y pulsa Enter o coma. Ayudan a relacionar artículos y al buscador interno.">
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
            <p className="text-xs text-[var(--fg-muted)]">{tags.length} de 12 · recomendado entre 3 y 6.</p>
          </Step>
        )}

        {current.key === "seccion" && (
          <Step title="Sección y autor" hint="Dónde se publica y quién firma. Puedes dejarlo para después.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="lx-kicker text-[var(--fg-muted)]">Sección</span>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={input}>
                  <option value="">— Sin sección —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="lx-kicker text-[var(--fg-muted)]">Autor</span>
                <select value={authorId} onChange={(e) => setAuthorId(e.target.value)} className={input}>
                  <option value="">— Sin autor —</option>
                  {authors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Step>
        )}

        {current.key === "cuerpo" && (
          <Step
            title="Escribe el cuerpo"
            hint="Separa los párrafos con una línea en blanco. Empieza una línea con «## » para un intertítulo. Las direcciones https://… se convierten en enlaces."
          >
            <textarea
              autoFocus
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={11}
              placeholder={"Primer párrafo con lo más importante…\n\n## Qué explica el alza\n\nSegundo párrafo…"}
              className={`${input} resize-y text-base leading-relaxed`}
            />
            <details className="rounded-[var(--radius)] border border-[var(--border)] p-3">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                <BarChart3 size={15} className="text-[var(--accent)]" /> Agregar una gráfica con IA (Gemini)
              </summary>
              <div className="mt-3 flex flex-col gap-2.5">
                <input
                  value={chartTopic}
                  onChange={(e) => setChartTopic(e.target.value)}
                  placeholder={title ? `Ej.: ${title}` : "Qué quieres graficar, p. ej. precio del novillo gordo por mes en 2026"}
                  className={input}
                />
                <button type="button" onClick={makeChart} disabled={chartBusy} className="lx-btn self-start">
                  {chartBusy && !chart ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  {chartBusy && !chart ? "Buscando datos y dibujando…" : "Generar gráfica"}
                </button>
                {chartError && <p className="text-sm text-[var(--danger,#b4442e)]">{chartError}</p>}
                {chart && (
                  <div className="flex flex-col gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:image/svg+xml;utf8,${encodeURIComponent(chart.svg)}`}
                      alt={chart.chart.title}
                      className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-white"
                    />
                    <p className="text-xs text-[var(--fg-muted)]">
                      Datos que encontró la IA en la web: <strong>verifica las fuentes antes de publicar.</strong> {chart.sourceNote}
                    </p>
                    <ul className="text-xs">
                      {chart.sources.map((x) => (
                        <li key={x.url}>
                          <a href={x.url} target="_blank" rel="noreferrer" className="lx-link">
                            {x.title} ↗
                          </a>
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <button type="button" onClick={insertChart} className="lx-btn">
                        <Check size={15} /> Insertar en el artículo
                      </button>
                      <button type="button" onClick={makeChart} disabled={chartBusy} className="lx-btn lx-btn-ghost">
                        <RotateCcw size={14} /> Otra versión
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </details>
            <p className="text-xs text-[var(--fg-muted)]">
              {words} palabras · {Math.max(1, Math.round(words / 200))} min de lectura
              {words > 0 && words < 250 && " · se recomiendan al menos 250"}
            </p>
          </Step>
        )}

        {current.key === "portada" && (
          <Step title="Foto de portada" hint="Opcional. Si no subes ninguna, se usa una ilustración con el nombre de la sección.">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-[16rem_minmax(0,1fr)]">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface-2)]">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt="" className="size-full object-cover" />
                ) : (
                  <span className="grid size-full place-items-center text-sm text-[var(--fg-muted)]">
                    {uploading ? <Loader2 className="animate-spin" /> : "Sin foto"}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <label className="lx-btn cursor-pointer">
                    <ImagePlus size={15} /> {cover ? "Cambiar foto" : "Subir foto"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void onCover(f);
                      }}
                    />
                  </label>
                  {cover && (
                    <button type="button" onClick={() => setCover("")} className="lx-btn lx-btn-ghost">
                      <Trash2 size={15} /> Quitar
                    </button>
                  )}
                </div>
                <input
                  value={cover}
                  onChange={(e) => setCover(e.target.value)}
                  placeholder="…o pega la URL de la imagen"
                  className={`${input} text-sm`}
                />
                <input
                  value={coverAlt}
                  onChange={(e) => setCoverAlt(e.target.value)}
                  placeholder="Qué se ve en la foto (texto alternativo)"
                  className={`${input} text-sm`}
                />
              </div>
            </div>
            <div className="mt-5 rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)]/50 p-4">
              <p className="text-sm font-semibold">¿Sin foto? Genérala con IA</p>
              <p className="mt-1 text-xs text-[var(--fg-muted)]">
                Crea una imagen realista, con estética de fotograma de cine (16:9), a partir del título y el resumen. No retrata personas reales. Se publica rotulada «imagen generada con IA»; si la nota trata de un hecho real, es mejor usar una foto propia o de agencia.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={sceneTxt}
                  onChange={(e) => setSceneTxt(e.target.value)}
                  placeholder="Opcional: describe la escena (si lo dejas vacío, la IA la propone)"
                  className={`${input} min-w-0 flex-1 !py-2 text-sm`}
                />
                <button type="button" onClick={makeCover} disabled={genImg || uploading} className="lx-btn">
                  {genImg ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  {cover ? "Generar otra" : "Generar foto con IA"}
                </button>
              </div>
              {genImg && <p role="status" className="mt-3 text-xs text-[var(--fg-muted)]">Generando la imagen… puede tardar unos 20 segundos.</p>}
              {imgError && <p role="alert" className="mt-3 text-sm text-[var(--danger,#b4442e)]">{imgError}</p>}
            </div>
          </Step>
        )}

        {current.key === "seo" && (
          <Step title="Cómo se verá en Google" hint="Opcional. Si lo dejas vacío se usan el título y el resumen.">
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
              rows={3}
              placeholder={excerpt || "Descripción para buscadores"}
              className={`${input} resize-y`}
            />
            <Counter value={(metaDescription || excerpt).length} min={70} max={155} />
            <div className="rounded-[var(--radius)] border border-[var(--border)] bg-white p-4 text-left">
              <p className="text-xs text-[#4d5156]">contextoganadero.com › articulo</p>
              <p className="mt-1 truncate text-lg text-[#1a0dab]">{metaTitle || title}</p>
              <p className="line-clamp-2 text-sm text-[#4d5156]">{metaDescription || excerpt}</p>
            </div>
          </Step>
        )}

        {current.key === "vista" && (
          <div className="flex h-full min-h-[24rem] flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={back} className="lx-link inline-flex items-center gap-1 text-sm">
                <ArrowLeft size={14} /> Volver a editar
              </button>
              <p className="lx-kicker ml-auto flex items-center gap-2 text-[var(--accent)]">
                <Eye size={14} /> Así se verá en el sitio
              </p>
            </div>
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

        {aiNote && current.key !== "tema" && current.key !== "vista" && (
          <p className="mx-auto mt-5 flex max-w-2xl items-start gap-2 rounded-[var(--radius)] bg-[var(--surface-2)] p-3 text-xs text-[var(--fg-muted)]">
            <Sparkles size={13} className="mt-0.5 shrink-0 text-[var(--accent)]" /> {aiNote}
          </p>
        )}
        {error && current.key !== "tema" && <p className="mt-4 text-sm text-[var(--danger,#b4442e)]">{error}</p>}
      </div>

      {current.key !== "vista" && <SeoPanel score={audit.score} items={audit.items} groups={audit.groups} capped={audit.capped} focus={tags[0]} />}
      </div>

      {/* --- Navegación --- */}
      <div className="flex shrink-0 items-center justify-between gap-3">
        <button
          type="button"
          onClick={back}
          disabled={step === 0}
          className="lx-btn lx-btn-ghost disabled:opacity-40"
        >
          <ArrowLeft size={15} /> Atrás
        </button>
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
        ) : (
          <button type="button" onClick={next} disabled={generating && current.key === "tema"} className="lx-btn disabled:opacity-70">
            {generating && current.key === "tema" ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Generando…
              </>
            ) : (
              <>
                {STEPS[step + 1].key === "vista" ? "Ver vista previa" : "Siguiente"} <ArrowRight size={15} />
              </>
            )}
          </button>
        )}
      </div>
    </form>
  );
}

function Step({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-2">
      <h2 className="lx-display text-xl font-semibold sm:text-2xl">{title}</h2>
      <p className="text-sm text-[var(--fg-muted)]">{hint}</p>
      <div className="mt-2 flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function Counter({ value, min, max }: { value: number; min: number; max: number }) {
  const ok = value >= min && value <= max;
  return (
    <p className={`text-right text-xs ${ok ? "text-[var(--accent)]" : "text-[var(--fg-muted)]"}`}>
      {value} / {max} caracteres {ok ? "✓" : `(ideal ${min}–${max})`}
    </p>
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
  portada: "Portada",
  "portada-alt": "Portada",
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

/** Panel SEO lateral (escritorio): nota, barra y la lista completa de criterios. */
function SeoPanel({ score, items, groups, capped, focus }: { score: number; items: AuditItem[]; groups: AuditResult["groups"]; capped: boolean; focus?: string }) {
  const pending = items
    .filter((i) => !i.ok)
    .sort((a, b) => (a.severity === b.severity ? b.weight - a.weight : a.severity === "error" ? -1 : 1));
  const passed = items.filter((i) => i.ok);
  const color = score >= 75 ? "#16a34a" : score >= 55 ? "#d97706" : "#dc2626";

  return (
    <aside className="lx-card hidden w-80 shrink-0 flex-col overflow-hidden p-0 lg:flex" aria-label="Puntuación SEO">
      <div className="border-b border-[var(--border)] p-4">
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
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {pending.length > 0 && (
          <>
            <p className="lx-kicker mb-2 text-[var(--fg-muted)]">Qué falta ({pending.length})</p>
            <ul className="flex flex-col gap-2.5">
              {pending.map((i) => (
                <li key={i.id} className="flex items-start gap-2 text-sm leading-snug">
                  <span
                    className="mt-1.5 size-2 shrink-0 rounded-full"
                    style={{ background: i.severity === "error" ? "#dc2626" : "#d97706" }}
                  />
                  <span>
                    {i.text}
                    {i.help && <span className="block text-xs text-[var(--fg-muted)]">{i.help}</span>}
                    {STEP_OF[i.id] && <span className="block text-xs text-[var(--accent)]">→ {STEP_OF[i.id]}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        {passed.length > 0 && (
          <>
            <p className="lx-kicker mb-2 mt-4 text-[var(--fg-muted)]">Cumplido ({passed.length})</p>
            <ul className="flex flex-col gap-1.5">
              {passed.map((i) => (
                <li key={i.id} className="flex items-start gap-2 text-xs text-[var(--fg-muted)]">
                  <Check size={12} className="mt-0.5 shrink-0 text-[#16a34a]" /> {i.text}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}
