"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AlignLeft,
  CalendarClock,
  Check,
  ExternalLink,
  FileCode2,
  Hash,
  ImagePlus,
  Film,
  Loader2,
  Trash2,
  Save,
  Search,
  Gauge,
  Zap,
  Send,
  Sparkles,
  Tag,
  TriangleAlert,
  Upload,
  User,
  Wand2,
  X,
} from "lucide-react";
import { saveArticle } from "@/app/panel/(app)/articulos/actions";
import {
  generateArticleDraft,
  type GeneratedDraft,
} from "@/app/panel/(app)/articulos/ai-actions";
import { uploadMedia } from "@/app/panel/(app)/articulos/media-actions";
import { analizarConGoogle } from "@/app/panel/(app)/articulos/seo-actions";
import type { PsiReport } from "@/lib/psi-types";
import { embedHtml, parseEmbed } from "@/lib/embeds";
import { auditArticle, scoreLabel } from "@/lib/seo-audit";

type Option = { id: string; name: string };
type Initial = {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  categoryId: string | null;
  authorId: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  tags: string[];
  slug: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  isBreaking: boolean;
  isLive: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  nuevo: "Nuevo",
  borrador: "Borrador",
  en_revision: "En revisión",
  programado: "Programado",
  publicado: "Publicado",
  archivado: "Archivado",
};

export function ArticleEditor({
  initial,
  categories,
  authors,
  canPublish,
  publishAction,
  scheduleAction,
  submitForReviewAction,
  status,
  heading,
}: {
  initial: Initial;
  categories: Option[];
  authors: Option[];
  canPublish: boolean;
  publishAction: () => Promise<void>;
  scheduleAction: (iso: string) => Promise<void>;
  submitForReviewAction: () => Promise<void>;
  status: string;
  /** Título de la pantalla, debajo de la barra de acciones. */
  heading?: React.ReactNode;
}) {
  const [title, setTitle] = useState(initial.title);
  const [excerpt, setExcerpt] = useState(initial.excerpt);
  const [body, setBody] = useState(initial.body);
  const [metaTitle, setMetaTitle] = useState(initial.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(initial.metaDescription ?? "");
  const [tags, setTags] = useState(initial.tags.join(", "));
  const [schedule, setSchedule] = useState("");

  // Medios: portada del artículo y archivos insertados en el cuerpo.
  const [cover, setCover] = useState(initial.coverImageUrl ?? "");
  // Distintivos editoriales: última hora (H-05) y directo (AI-03).
  const [breaking, setBreaking] = useState(initial.isBreaking);
  const [live, setLive] = useState(initial.isLive);
  const [coverAlt, setCoverAlt] = useState(initial.coverImageAlt ?? "");
  const [subiendo, setSubiendo] = useState<"portada" | "cuerpo" | null>(null);
  const [urlVideo, setUrlVideo] = useState("");
  const [mediaError, setMediaError] = useState("");

  // Auditoría externa (Lighthouse, vía PageSpeed Insights de Google).
  const [psi, setPsi] = useState<PsiReport | null>(null);
  const [psiError, setPsiError] = useState("");
  const [psiPending, startPsi] = useTransition();

  function auditar(strategy: "mobile" | "desktop") {
    setPsiError("");
    startPsi(async () => {
      const res = await analizarConGoogle(initial.id, strategy);
      if (res.ok) setPsi(res.report);
      else {
        setPsi(null);
        setPsiError(res.error);
      }
    });
  }

  /** Sube un archivo y devuelve su URL pública, o null si algo falló. */
  async function subir(file: File, destino: "portada" | "cuerpo") {
    setMediaError("");
    setSubiendo(destino);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadMedia(fd);
      if (!res.ok) {
        setMediaError(res.error);
        return null;
      }
      return res;
    } catch {
      setMediaError("No se pudo subir el archivo.");
      return null;
    } finally {
      setSubiendo(null);
    }
  }

  /** Inserta un vídeo de YouTube o Vimeo al final del cuerpo (RT-09). */
  function insertarVideo() {
    const embed = parseEmbed(urlVideo);
    if (!embed) {
      setMediaError("No se reconoce la dirección. Pega un enlace de YouTube (incluido un directo) o de Vimeo.");
      return;
    }
    setMediaError("");
    const html = embedHtml(embed, title || "Vídeo");
    setBody((b) => (b.trimEnd() ? `${b.trimEnd()}\n\n${html}\n` : `${html}\n`));
    setUrlVideo("");
  }

  async function onPortada(file: File) {
    const res = await subir(file, "portada");
    if (!res) return;
    if (res.kind === "video") {
      setMediaError("La portada debe ser una imagen; el vídeo puedes insertarlo en el cuerpo.");
      return;
    }
    setCover(res.url);
  }

  /** Inserta la figura al final del cuerpo, lista para editar su pie. */
  async function onCuerpo(file: File) {
    const res = await subir(file, "cuerpo");
    if (!res) return;
    const html =
      res.kind === "video"
        ? `<figure>\n  <video src="${res.url}" controls playsinline preload="metadata"></video>\n  <figcaption>Pie del vídeo</figcaption>\n</figure>`
        : `<figure>\n  <img src="${res.url}" alt="Describe la imagen" loading="lazy" />\n  <figcaption>Pie de foto · Crédito</figcaption>\n</figure>`;
    setBody((b) => (b.trimEnd() ? `${b.trimEnd()}\n\n${html}\n` : `${html}\n`));
  }

  // Encargo para el asistente de redacción.
  const [prompt, setPrompt] = useState("");
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [seoOptions, setSeoOptions] = useState<GeneratedDraft["seoOptions"]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [generating, startGenerating] = useTransition();

  const tagList = useMemo(
    () => tags.split(",").map((t) => t.trim()).filter(Boolean),
    [tags],
  );

  // Auditoría real: mismas reglas con IA o sin ella, recalculadas al escribir.
  const audit = useMemo(
    () =>
      auditArticle({
        title,
        excerpt,
        body,
        metaTitle,
        metaDescription,
        tags: tagList,
        focus: prompt || title,
      }),
    [title, excerpt, body, metaTitle, metaDescription, tagList, prompt],
  );
  const score = audit.score;
  const words = audit.stats.words;
  const minutes = audit.stats.minutes;

  function generar() {
    setAiError(null);
    setAiNote(null);
    startGenerating(async () => {
      const res = await generateArticleDraft({ title, prompt });
      if (!res.ok) {
        setAiError(res.error);
        return;
      }
      const d = res.draft;
      setTitle(d.title);
      setExcerpt(d.excerpt);
      setBody(d.body);
      setMetaTitle(d.metaTitle);
      setMetaDescription(d.metaDescription);
      setTags(d.tags.join(", "));
      setSeoOptions(d.seoOptions);
      setKeywords(d.keywords);
      setAiNote(
        res.note ??
          "Borrador generado. Revísalo: los datos entre {{llaves}} son los que el modelo no pudo confirmar.",
      );
    });
  }

  return (
    <form action={saveArticle} className="flex flex-col gap-6">
      <input type="hidden" name="id" value={initial.id} />

      {/* Barra de trabajo: estado, métricas y la acción principal siempre a la
          vista, sin tener que bajar al final del formulario. */}
      <div className="sticky top-[4.4rem] z-30 flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow)]">
        <StatusChip status={status} />
        <span className="hidden items-center gap-1.5 text-xs text-[var(--fg-muted)] sm:flex">
          <AlignLeft size={13} /> {words.toLocaleString("es-CO")} palabras · {minutes} min
        </span>
        <ScoreDot score={score} />

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Mientras no esté publicado, la URL pública devuelve 404 a propósito:
              se enlaza la vista previa del panel, que sí muestra borradores. */}
          {initial.id && (
            <a
              href={
                status === "publicado" && initial.slug
                  ? `/articulo/${initial.slug}`
                  : `/vista-previa/${initial.id}`
              }
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              <ExternalLink size={13} />{" "}
              {status === "publicado" ? "Ver publicado" : "Vista previa"}
            </a>
          )}
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] shadow-sm transition hover:opacity-90"
          >
            <Save size={15} /> Guardar borrador
          </button>
        </div>
      </div>

      {heading}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        {/* ---------------------------------------------------- Redacción */}
        <div className="flex flex-col gap-5">
          {/* Encargo al asistente: el periodista pone el tema y sus notas; la
              IA devuelve un borrador que él revisa. Nunca publica sola. */}
          <section className="rounded-[var(--radius-lg)] border border-[var(--accent)]/35 bg-gradient-to-br from-[var(--surface)] to-[var(--surface-2)] p-5 shadow-[var(--shadow)]">
            <header className="mb-3 flex items-center gap-2">
              <span className="text-[var(--accent)]">
                <Sparkles size={14} />
              </span>
              <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">
                Redacción asistida
              </h2>
              <span className="ml-auto text-[0.65rem] text-[var(--fg-muted)]">
                Borrador para revisión humana
              </span>
            </header>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="¿De qué trata la noticia? Pega aquí tus notas, cifras, fuentes y declaraciones. Ej.: La Central Ganadera de Medellín reportó 9.850 $/kg en pie para el novillo gordo en la primera quincena de septiembre, 4 % sobre agosto; causas: menor entrada del Magdalena Medio y pedidos de plantas de Bogotá."
              className="w-full resize-y rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] p-3 text-[0.9rem] leading-relaxed outline-none transition focus:border-[var(--accent)] placeholder:text-[var(--fg-muted)]/55"
            />

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={generar}
                disabled={generating || prompt.trim().length < 20}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Wand2 size={15} />
                {generating ? "Redactando…" : "Generar borrador"}
              </button>
              <p className="text-[0.7rem] leading-snug text-[var(--fg-muted)]">
                Escribe sobre el título y el cuerpo actuales. Lo que no pueda confirmar queda
                marcado entre <code className="lx-mono">{"{{llaves}}"}</code>.
              </p>
            </div>

            {aiError && (
              <p className="mt-3 flex items-start gap-2 rounded-[var(--radius)] bg-[var(--danger)]/10 p-2.5 text-xs text-[var(--danger)]">
                <TriangleAlert size={13} className="mt-px shrink-0" /> {aiError}
              </p>
            )}
            {aiNote && (
              <p className="mt-3 rounded-[var(--radius)] bg-[var(--accent)]/10 p-2.5 text-xs leading-snug text-[var(--fg)]">
                {aiNote}
              </p>
            )}

            {keywords.length > 0 && (
              <div className="mt-3">
                <p className="meta mb-1.5 !text-[0.65rem]">Términos de búsqueda sugeridos</p>
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((k) => (
                    <span
                      key={k}
                      className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-[0.7rem]"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {seoOptions.length > 0 && (
              <div className="mt-4">
                <p className="meta mb-2 !text-[0.65rem]">Opciones de posicionamiento</p>
                <div className="flex flex-col gap-2">
                  {seoOptions.map((o, i) => {
                    const activa = metaTitle === o.metaTitle;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setMetaTitle(o.metaTitle);
                          setMetaDescription(o.metaDescription);
                        }}
                        className={`rounded-[var(--radius)] border p-3 text-left transition ${
                          activa
                            ? "border-[var(--accent)] bg-[var(--accent)]/10"
                            : "border-[var(--border)] bg-[var(--bg)] hover:border-[var(--border-strong)]"
                        }`}
                      >
                        <span className="block text-sm font-semibold">{o.metaTitle}</span>
                        <span className="mt-0.5 block text-[0.75rem] leading-snug text-[var(--fg-muted)]">
                          {o.metaDescription}
                        </span>
                        <span className="mt-1.5 flex items-center gap-1.5 text-[0.68rem] text-[var(--accent)]">
                          {activa ? <Check size={11} /> : <Sparkles size={11} />}
                          {activa ? "Aplicada" : o.rationale}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <Panel>
            <Field label="Título" hint="Lo que verá el lector y los buscadores">
              <input
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="El precio del novillo gordo sube 4 % en Medellín"
                className="w-full border-0 bg-transparent px-0 py-1 font-[family-name:var(--font-display)] text-[1.7rem] font-semibold leading-tight tracking-tight outline-none placeholder:text-[var(--fg-muted)]/45"
              />
              <Meter value={(metaTitle || title).length} min={15} max={65} />
            </Field>

            <Divider />

            <Field
              label="Resumen / entradilla"
              hint="Primer párrafo y, por defecto, la meta description"
            >
              <textarea
                name="excerpt"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={3}
                required
                placeholder="Dos o tres líneas que expliquen por qué importa la noticia."
                className="w-full resize-y border-0 bg-transparent px-0 py-1 text-[0.98rem] leading-relaxed outline-none placeholder:text-[var(--fg-muted)]/45"
              />
              <Meter value={(metaDescription || excerpt).length} min={70} max={155} />
            </Field>
          </Panel>

          <Panel
            title="Cuerpo"
            icon={<FileCode2 size={13} />}
            aside={<span className="lx-mono text-[0.7rem] text-[var(--fg-muted)]">HTML</span>}
          >
            <textarea
              name="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={18}
              placeholder="<p>Escribe aquí el cuerpo del artículo…</p>"
              className="lx-mono w-full resize-y rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] p-4 text-[0.85rem] leading-relaxed outline-none transition focus:border-[var(--accent)] placeholder:text-[var(--fg-muted)]/45"
            />
          </Panel>

          {/* ------------------------------------------------------ Medios */}
          <Panel
            title="Fotos y vídeo"
            icon={<ImagePlus size={13} />}
            aside={
              subiendo ? (
                <span className="flex items-center gap-1.5 text-[0.7rem] text-[var(--fg-muted)]">
                  <Loader2 size={12} className="animate-spin" /> Subiendo…
                </span>
              ) : null
            }
          >
            <input type="hidden" name="coverImageUrl" value={cover} />

            <div className="grid gap-5 sm:grid-cols-[13rem_minmax(0,1fr)]">
              {/* Portada */}
              <div>
                <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--bg-2)]">
                  {cover ? (
                    // Imagen local o remota: <img> evita configurar dominios en next/image.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center text-center text-[0.72rem] leading-relaxed text-[var(--fg-muted)]">
                      Sin foto de portada
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)]">
                    <ImagePlus size={13} /> {cover ? "Cambiar" : "Subir portada"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void onPortada(f);
                      }}
                    />
                  </label>
                  {cover && (
                    <button
                      type="button"
                      onClick={() => setCover("")}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--fg-muted)] transition hover:border-[var(--danger,#b4442e)] hover:text-[var(--danger,#b4442e)]"
                    >
                      <Trash2 size={13} /> Quitar
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <Field label="Texto alternativo" hint="Qué se ve en la foto · lo leen buscadores y lectores de pantalla">
                  <input
                    name="coverImageAlt"
                    value={coverAlt}
                    onChange={(e) => setCoverAlt(e.target.value)}
                    placeholder="Novillos pastando en una finca de Córdoba"
                    className="w-full border-0 bg-transparent px-0 py-1 text-[0.95rem] outline-none placeholder:text-[var(--fg-muted)]/45"
                  />
                </Field>

                <Field label="URL de la portada" hint="Si la foto ya está publicada en otro sitio">
                  <input
                    value={cover}
                    onChange={(e) => setCover(e.target.value)}
                    placeholder="https://…/foto.jpg"
                    className="lx-mono w-full border-0 bg-transparent px-0 py-1 text-[0.8rem] outline-none placeholder:text-[var(--fg-muted)]/45"
                  />
                </Field>

                <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] p-3">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">
                    Dentro del cuerpo
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--fg-muted)]">
                    El archivo se añade al final del cuerpo como una figura con su pie; muévela donde
                    quieras y escribe el crédito.
                  </p>
                  <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)]">
                    <Film size={13} /> Insertar foto o vídeo
                    <input
                      type="file"
                      accept="image/*,video/mp4,video/webm"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void onCuerpo(f);
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* YouTube / Vimeo / directos (RT-09). Se guarda el identificador,
                nunca el HTML que traiga pegado el redactor. */}
            <div className="mt-5 rounded-[var(--radius)] border border-[var(--border)] p-3">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">
                Vídeo de YouTube o Vimeo
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  value={urlVideo}
                  onChange={(e) => setUrlVideo(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=… o /live/…"
                  className="lx-mono min-w-[14rem] flex-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-[0.78rem] outline-none transition focus:border-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={insertarVideo}
                  disabled={!urlVideo.trim()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
                >
                  <Film size={13} /> Insertar vídeo
                </button>
              </div>
              <p className="mt-2 text-[0.68rem] leading-snug text-[var(--fg-muted)]">
                Se incrusta por youtube-nocookie: no deja cookies de seguimiento hasta que el lector
                pulsa play.
              </p>
            </div>

            {mediaError && (
              <p className="mt-3 flex items-start gap-2 text-xs text-[var(--danger,#b4442e)]">
                <TriangleAlert size={13} className="mt-0.5 shrink-0" /> {mediaError}
              </p>
            )}
            <p className="mt-3 text-[0.7rem] text-[var(--fg-muted)]">
              JPG, PNG, WebP, AVIF, GIF, MP4 o WebM · hasta 25 MB.
            </p>
          </Panel>

          <div className="grid gap-5 sm:grid-cols-2">
            <Panel title="Sección" icon={<Hash size={13} />}>
              <Select name="categoryId" defaultValue={initial.categoryId ?? ""} options={categories} empty="— Sin sección —" />
            </Panel>
            <Panel title="Autor" icon={<User size={13} />}>
              <Select name="authorId" defaultValue={initial.authorId ?? ""} options={authors} empty="— Sin autor —" />
            </Panel>
          </div>

          <Panel title="Posicionamiento" icon={<Search size={13} />}>
            <Field label="Meta title" hint="Opcional · por defecto, el título">
              <input
                name="metaTitle"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                placeholder={title || "Título para buscadores"}
                className="lx-input"
              />
            </Field>
            <Divider />
            <Field label="Meta description" hint="Opcional · por defecto, el resumen">
              <textarea
                name="metaDescription"
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                rows={2}
                placeholder={excerpt || "Descripción para el resultado de búsqueda"}
                className="lx-input resize-y"
              />
            </Field>
            <Divider />
            <Field label="Etiquetas" hint="Separadas por coma">
              <input
                name="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="precios, novillo gordo, antioquia"
                className="lx-input"
              />
              {tagList.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tagList.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[0.7rem]"
                    >
                      <Tag size={10} /> {t}
                    </span>
                  ))}
                </div>
              )}
            </Field>
          </Panel>
        </div>

        {/* ------------------------------------------------------- Columna */}
        <aside className="flex flex-col gap-5 lg:sticky lg:top-[9.5rem] lg:self-start">
          <Panel title="Calidad editorial" icon={<Check size={13} />}>
            <ScoreRing score={score} />
            <ul className="mt-4 flex flex-col gap-2">
              {audit.items.map((h) => (
                <li key={h.id} className="flex items-start gap-2 text-xs leading-snug">
                  <span
                    className={`mt-px grid size-4 shrink-0 place-items-center rounded-full ${
                      h.ok
                        ? "bg-[var(--accent-2)]/15 text-[var(--accent-2)]"
                        : h.severity === "aviso"
                          ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                          : "bg-[var(--danger)]/12 text-[var(--danger)]"
                    }`}
                    title={h.severity}
                  >
                    {h.ok ? <Check size={10} /> : <X size={10} />}
                  </span>
                  <span className="min-w-0">
                    <span className={h.ok ? "text-[var(--fg-muted)]" : "text-[var(--fg)]"}>
                      {h.text}
                    </span>
                    {!h.ok && h.help && (
                      <span className="mt-0.5 block text-[0.68rem] leading-snug text-[var(--fg-muted)]">
                        {h.help}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          {/* Auditoría de Google sobre el HTML real de la nota (vista previa
              firmada si aún es borrador). Es Lighthouse, no una heurística. */}
          {initial.id && (
            <Panel title="Análisis de Google" icon={<Gauge size={13} />}>
              <p className="text-xs leading-relaxed text-[var(--fg-muted)]">
                Lighthouse audita la página tal y como la verá el buscador.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={psiPending}
                  onClick={() => auditar("mobile")}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-60"
                >
                  {psiPending ? <Loader2 size={13} className="animate-spin" /> : <Gauge size={13} />}
                  Analizar móvil
                </button>
                <button
                  type="button"
                  disabled={psiPending}
                  onClick={() => auditar("desktop")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-60"
                >
                  Escritorio
                </button>
              </div>

              {psiError && (
                <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[var(--danger)]">
                  <TriangleAlert size={13} className="mt-0.5 shrink-0" /> {psiError}
                </p>
              )}

              {psi && (
                <div className="mt-4">
                  <div className="grid grid-cols-2 gap-2">
                    <PsiScore label="SEO" value={psi.scores.seo} />
                    <PsiScore label="Rendimiento" value={psi.scores.performance} />
                    <PsiScore label="Accesibilidad" value={psi.scores.accessibility} />
                    <PsiScore label="Buenas prácticas" value={psi.scores.bestPractices} />
                  </div>

                  {psi.failed.length > 0 ? (
                    <ul className="mt-4 flex flex-col gap-2">
                      {psi.failed.map((f) => (
                        <li key={f.id} className="flex items-start gap-2 text-xs leading-snug">
                          <span className="mt-px grid size-4 shrink-0 place-items-center rounded-full bg-[var(--danger)]/12 text-[var(--danger)]">
                            <X size={10} />
                          </span>
                          <span className="min-w-0">
                            <span className="text-[var(--fg)]">{f.title}</span>
                            <span className="mt-0.5 block text-[0.68rem] leading-snug text-[var(--fg-muted)]">
                              {f.description.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").slice(0, 190)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 flex items-center gap-2 text-xs text-[var(--accent-2)]">
                      <Check size={13} /> Supera las {psi.passedCount} comprobaciones de SEO.
                    </p>
                  )}

                  <p className="mt-3 break-all text-[0.62rem] leading-snug text-[var(--fg-muted)]">
                    {psi.strategy === "mobile" ? "Móvil" : "Escritorio"} ·{" "}
                    {new Date(psi.fetchedAt).toLocaleTimeString("es-CO")} · {psi.url}
                  </p>
                </div>
              )}
            </Panel>
          )}

          {/* Maqueta del resultado de Google: se ve el recorte real a 160 car. */}
          <Panel title="Así se verá en Google" icon={<Search size={13} />}>
            <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] p-3">
              <p className="flex items-center gap-1.5 text-[0.68rem] text-[var(--fg-muted)]">
                <span className="grid size-4 place-items-center rounded-full bg-[var(--accent)] text-[0.5rem] font-bold text-[var(--accent-fg)]">
                  CG
                </span>
                contextoganadero.com › articulo
              </p>
              <p className="mt-1 line-clamp-2 text-[0.95rem] font-medium text-[#1a0dab]">
                {metaTitle || title || "Sin título"}
              </p>
              <p className="mt-0.5 line-clamp-3 text-[0.78rem] leading-snug text-[var(--fg-muted)]">
                {(metaDescription || excerpt || "Sin descripción").slice(0, 160)}
              </p>
            </div>
          </Panel>

          <Panel title="Distintivos" icon={<Zap size={13} />}>
            <input type="hidden" name="isBreaking" value={breaking ? "1" : "0"} />
            <input type="hidden" name="isLive" value={live ? "1" : "0"} />
            <div className="flex flex-col gap-2.5">
              <Interruptor
                activo={breaking}
                onToggle={() => setBreaking((v) => !v)}
                titulo="Última hora"
                detalle="Barra roja en la portada. Solo se muestra la nota marcada más reciente."
              />
              <Interruptor
                activo={live}
                onToggle={() => setLive((v) => !v)}
                titulo="En vivo"
                detalle="Etiqueta de directo en las tarjetas y en el artículo."
              />
            </div>
          </Panel>

          {initial.id && (
            <Panel title="Flujo editorial" icon={<Send size={13} />}>
              <div className="flex flex-col gap-2.5">
                {!canPublish && (
                  <button
                    type="submit"
                    formAction={submitForReviewAction}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    <Send size={14} /> Enviar a revisión
                  </button>
                )}

                {canPublish && (
                  <>
                    <button
                      type="submit"
                      formAction={publishAction}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[var(--accent-2)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                    >
                      <Upload size={14} /> Publicar ahora
                    </button>

                    <div className="rounded-[var(--radius)] border border-[var(--border)] p-2.5">
                      <p className="mb-1.5 flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--fg-muted)]">
                        <CalendarClock size={12} /> Programar
                      </p>
                      <input
                        type="datetime-local"
                        value={schedule}
                        onChange={(e) => setSchedule(e.target.value)}
                        className="lx-input text-xs"
                      />
                      <button
                        type="button"
                        disabled={!schedule}
                        onClick={() => schedule && scheduleAction(new Date(schedule).toISOString())}
                        className="mt-2 w-full rounded-full border border-[var(--border-strong)] px-3 py-1.5 text-xs font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40"
                      >
                        Programar publicación
                      </button>
                    </div>
                  </>
                )}

                <p className="text-[0.7rem] leading-relaxed text-[var(--fg-muted)]">
                  Publicar regenera las rutas afectadas (ISR) y reindexa el artículo para el
                  asistente.
                </p>
              </div>
            </Panel>
          )}
        </aside>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ Piezas */

function Panel({
  title,
  icon,
  aside,
  children,
}: {
  title?: string;
  icon?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
      {title && (
        <header className="mb-3 flex items-center gap-2">
          <span className="text-[var(--accent)]">{icon}</span>
          <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">
            {title}
          </h2>
          {aside && <span className="ml-auto">{aside}</span>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Interruptor con etiqueta y explicación, para los distintivos editoriales. */
function Interruptor({
  activo,
  onToggle,
  titulo,
  detalle,
}: {
  activo: boolean;
  onToggle: () => void;
  titulo: string;
  detalle: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={onToggle}
      className={`flex items-start gap-3 rounded-[var(--radius)] border p-3 text-left transition ${
        activo
          ? "border-[var(--accent)] bg-[var(--accent)]/8"
          : "border-[var(--border)] hover:border-[var(--border-strong)]"
      }`}
    >
      <span
        aria-hidden
        className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${
          activo ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]"
        }`}
      >
        <span
          className={`size-4 rounded-full bg-white transition-transform ${activo ? "translate-x-4" : ""}`}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{titulo}</span>
        <span className="mt-0.5 block text-[0.7rem] leading-snug text-[var(--fg-muted)]">
          {detalle}
        </span>
      </span>
    </button>
  );
}

/** Marcador 0–100 con el código de color de Lighthouse. */
function PsiScore({ label, value }: { label: string; value: number | null }) {
  const tono =
    value === null
      ? "text-[var(--fg-muted)]"
      : value >= 90
        ? "text-[var(--accent-2)]"
        : value >= 50
          ? "text-[var(--accent)]"
          : "text-[var(--danger)]";
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2">
      <p className={`text-lg font-semibold leading-none ${tono}`}>{value ?? "—"}</p>
      <p className="mt-1 text-[0.62rem] uppercase tracking-[0.12em] text-[var(--fg-muted)]">{label}</p>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline gap-2">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">
          {label}
        </span>
        {hint && <span className="text-[0.7rem] text-[var(--fg-muted)]/75">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Divider() {
  return <hr className="my-4 border-0 border-t border-[var(--border)]" />;
}

/** Barra de longitud: verde dentro del rango recomendado, ámbar fuera. */
function Meter({ value, min, max }: { value: number; min: number; max: number }) {
  const ok = value >= min && value <= max;
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <span
          className="block h-full rounded-full transition-[width,background-color] duration-300"
          style={{
            width: `${pct}%`,
            background: ok ? "var(--accent-2)" : "var(--accent)",
          }}
        />
      </span>
      <span className="lx-mono text-[0.65rem] tabular-nums text-[var(--fg-muted)]">
        {value}/{max}
      </span>
    </div>
  );
}

function ScoreDot({ score }: { score: number }) {
  return (
    <span className="hidden items-center gap-1.5 text-xs text-[var(--fg-muted)] md:flex">
      <span
        className="size-2 rounded-full"
        style={{ background: score === 100 ? "var(--accent-2)" : "var(--accent)" }}
      />
      SEO {score}%
    </span>
  );
}

/** Aro de progreso: el estado de la ficha se lee de un vistazo. */
function ScoreRing({ score }: { score: number }) {
  const done = score === 100;
  return (
    <div className="flex items-center gap-4">
      <span
        className="grid size-16 shrink-0 place-items-center rounded-full"
        style={{
          background: `conic-gradient(${done ? "var(--accent-2)" : "var(--accent)"} ${score * 3.6}deg, var(--surface-2) 0deg)`,
        }}
      >
        <span className="grid size-12 place-items-center rounded-full bg-[var(--surface)] text-sm font-bold tabular-nums">
          {score}
        </span>
      </span>
      <p className="text-xs leading-snug text-[var(--fg-muted)]">
        <span className="font-semibold text-[var(--fg)]">{scoreLabel(score)}.</span>{" "}
        {done
          ? "Ficha completa: nada pendiente antes de publicar."
          : "Los puntos en rojo pesan más que los ámbar."}
      </p>
    </div>
  );
}

function Select({
  name,
  defaultValue,
  options,
  empty,
}: {
  name: string;
  defaultValue: string;
  options: Option[];
  empty: string;
}) {
  return (
    <div className="relative">
      <select
        name={name}
        defaultValue={defaultValue}
        className="lx-input w-full appearance-none pr-9 text-sm"
      >
        <option value="">{empty}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]"
      >
        ▾
      </span>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const live = status === "publicado";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
        live
          ? "bg-[var(--accent-2)]/15 text-[var(--accent-2)]"
          : "bg-[var(--surface-2)] text-[var(--fg-muted)]"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${live ? "bg-[var(--accent-2)]" : "bg-[var(--fg-muted)]"}`}
      />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
