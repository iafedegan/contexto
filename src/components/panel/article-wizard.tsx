"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  ImagePlus,
  Loader2,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { saveArticle } from "@/app/panel/(app)/articulos/actions";
import { uploadMedia } from "@/app/panel/(app)/articulos/media-actions";

type Option = { id: string; name: string };

const STEPS = [
  { key: "titulo", label: "Título" },
  { key: "resumen", label: "Resumen" },
  { key: "claves", label: "Palabras clave" },
  { key: "seccion", label: "Sección y autor" },
  { key: "cuerpo", label: "Cuerpo" },
  { key: "portada", label: "Portada" },
  { key: "seo", label: "Buscadores" },
  { key: "vista", label: "Vista previa" },
] as const;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
    .map((b) =>
      b.startsWith("## ")
        ? `<h2>${escapeHtml(b.slice(3))}</h2>`
        : `<p>${escapeHtml(b).replace(/\n/g, "<br>")}</p>`,
    )
    .join("\n");
}

/** Creación manual de un artículo, una pantalla por paso, con vista previa final. */
export function ArticleWizard({ categories, authors }: { categories: Option[]; authors: Option[] }) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [authorId, setAuthorId] = useState("");
  const [body, setBody] = useState("");
  const [cover, setCover] = useState("");
  const [coverAlt, setCoverAlt] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const bodyHtml = toHtml(body);
  const categoryName = categories.find((c) => c.id === categoryId)?.name;
  const authorName = authors.find((a) => a.id === authorId)?.name;

  // Qué impide avanzar desde cada paso (solo título y resumen son obligatorios).
  const blocker: Record<string, string | null> = {
    titulo: title.trim().length < 5 ? "Escribe un título de al menos 5 caracteres." : null,
    resumen: excerpt.trim().length < 20 ? "El resumen debe tener al menos 20 caracteres." : null,
  };
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function next() {
    const b = blocker[current.key];
    if (b) return setError(b);
    setError("");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() {
    setError("");
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
    <form action={saveArticle} className="flex flex-col gap-5">
      {/* Todo viaja oculto: el formulario solo se envía desde la vista previa. */}
      <input type="hidden" name="id" value="" />
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
      <div className="lx-card p-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold">
            Paso {step + 1} de {STEPS.length} · {current.label}
          </span>
          <Link href="/panel/articulos/nuevo" className="lx-link text-xs">
            Cambiar modo
          </Link>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        <ol className="mt-3 hidden flex-wrap gap-1.5 md:flex">
          {STEPS.map((s, i) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => goTo(i)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
                  i === step
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : i < step
                      ? "border-[var(--border-strong)] text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--fg-muted)]"
                }`}
              >
                {i < step && <Check size={11} />} {s.label}
              </button>
            </li>
          ))}
        </ol>
      </div>

      {/* --- Pantalla del paso --- */}
      <div className="lx-card min-h-[22rem] p-6 sm:p-8">
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
              rows={4}
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
            <div className="grid gap-4 sm:grid-cols-2">
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
            hint="Separa los párrafos con una línea en blanco. Empieza una línea con «## » para un intertítulo."
          >
            <textarea
              autoFocus
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={16}
              placeholder={"Primer párrafo con lo más importante…\n\n## Qué explica el alza\n\nSegundo párrafo…"}
              className={`${input} resize-y text-base leading-relaxed`}
            />
            <p className="text-xs text-[var(--fg-muted)]">
              {words} palabras · {Math.max(1, Math.round(words / 200))} min de lectura
              {words > 0 && words < 250 && " · se recomiendan al menos 250"}
            </p>
          </Step>
        )}

        {current.key === "portada" && (
          <Step title="Foto de portada" hint="Opcional. Si no subes ninguna, se usa una ilustración con el nombre de la sección.">
            <div className="grid gap-5 sm:grid-cols-[16rem_minmax(0,1fr)]">
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
          <div>
            <p className="lx-kicker mb-4 flex items-center gap-2 text-[var(--accent)]">
              <Eye size={14} /> Vista previa · así lo verá el lector
            </p>
            <article className="mx-auto max-w-3xl">
              {categoryName && <p className="lx-kicker text-[var(--accent)]">{categoryName}</p>}
              <h2 className="lx-display mt-2 text-3xl font-semibold leading-tight sm:text-4xl">{title}</h2>
              <p className="mt-4 text-lg leading-relaxed text-[var(--fg-muted)]">{excerpt}</p>
              <p className="mt-4 text-sm text-[var(--fg-muted)]">
                Por {authorName ?? "Redacción"} · {Math.max(1, Math.round(words / 200))} min de lectura
              </p>
              {cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cover}
                  alt={coverAlt || title}
                  className="mt-6 aspect-[16/9] w-full rounded-[var(--radius)] object-cover"
                />
              )}
              {bodyHtml ? (
                <div className="prose mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
              ) : (
                <p className="mt-8 text-sm italic text-[var(--fg-muted)]">Sin cuerpo todavía.</p>
              )}
              {tags.length > 0 && (
                <ul className="mt-8 flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <li key={t} className="lx-chip">
                      {t}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-[var(--danger,#b4442e)]">{error}</p>}
      </div>

      {/* --- Navegación --- */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={back}
          disabled={step === 0}
          className="lx-btn lx-btn-ghost disabled:opacity-40"
        >
          <ArrowLeft size={15} /> Atrás
        </button>
        {isLast ? (
          <button type="submit" className="lx-btn">
            <Save size={15} /> Guardar borrador
          </button>
        ) : (
          <button type="button" onClick={next} className="lx-btn">
            {STEPS[step + 1].key === "vista" ? "Ver vista previa" : "Siguiente"} <ArrowRight size={15} />
          </button>
        )}
      </div>
    </form>
  );
}

function Step({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      <h2 className="lx-display text-2xl font-semibold">{title}</h2>
      <p className="text-sm text-[var(--fg-muted)]">{hint}</p>
      <div className="mt-2 flex flex-col gap-3">{children}</div>
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
