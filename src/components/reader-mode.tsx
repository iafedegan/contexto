"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, ChevronLeft, ChevronRight, Minus, Plus, Settings2, X } from "lucide-react";
import { ListenArticle } from "@/components/listen-article";
import { ArticleBody } from "@/components/article-body";

/**
 * Modo revista: la nota a pantalla completa, paginada en columnas como en una
 * tableta. El lector elige fondo, tamaño y tipografía; la elección se recuerda
 * en su navegador (solo es una preferencia de lectura).
 */

const THEMES = {
  papel: { label: "Papel", bg: "#ffffff", fg: "#1c1917", muted: "#57534e", rule: "#e7e5e4" },
  sepia: { label: "Sepia", bg: "#f4ecd8", fg: "#3b2f1e", muted: "#6b5a43", rule: "#e3d5b8" },
  gris: { label: "Gris", bg: "#e7e7e9", fg: "#18181b", muted: "#52525b", rule: "#d4d4d8" },
  noche: { label: "Noche", bg: "#121212", fg: "#e7e5e4", muted: "#a8a29e", rule: "#2e2e2e" },
} as const;

// Tipografías disponibles en el modo lectura.
const FONTS = {
  serif: { label: "Serif", css: "var(--f-source-serif, Georgia), Georgia, serif" },
  clasica: { label: "Clásica", css: "var(--f-playfair, Georgia), Georgia, serif" },
  sans: { label: "Sans", css: "var(--f-inter, system-ui), system-ui, sans-serif" },
  redonda: { label: "Redonda", css: "var(--f-outfit, system-ui), system-ui, sans-serif" },
} as const;

// Identificador de un tema de lectura.
type ThemeId = keyof typeof THEMES;
// Identificador de una tipografía de lectura.
type FontId = keyof typeof FONTS;
// Preferencias de lectura: tema, tipografía y tamaño.
type Prefs = { theme: ThemeId; font: FontId; size: number };

// Preferencias por defecto.
const DEFAULT: Prefs = { theme: "papel", font: "serif", size: 20 };
// Clave donde se guardan las preferencias.
const KEY = "cg:modo-revista";

// Lee las preferencias guardadas, o las de defecto.
function loadPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Prefs> | null;
    if (!raw) return DEFAULT;
    return {
      theme: raw.theme && raw.theme in THEMES ? raw.theme : DEFAULT.theme,
      font: raw.font && raw.font in FONTS ? raw.font : DEFAULT.font,
      size: typeof raw.size === "number" ? Math.min(30, Math.max(15, raw.size)) : DEFAULT.size,
    };
  } catch {
    return DEFAULT;
  }
}

// Modo lectura a pantalla completa con tema, tipografía y tamaño ajustables.
export function ReaderMode({
  title,
  excerpt,
  body,
  cover,
  coverAlt,
  byline,
  kicker,
  lang = "es-CO",
}: {
  title: string;
  excerpt: string;
  /** HTML ya sanitizado (el mismo que pinta el artículo). */
  body: string;
  cover?: string | null;
  coverAlt?: string | null;
  byline?: string;
  kicker?: string;
  lang?: string;
}) {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);
  const [panel, setPanel] = useState(false);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);

  // Preferencias guardadas: se leen al abrir, no en el render del servidor.
  function openReader() {
    setPrefs(loadPrefs());
    setPage(0);
    setOpen(true);
  }

  // Cambia las preferencias y las guarda.
  function update(p: Partial<Prefs>) {
    setPrefs((prev) => {
      const next = { ...prev, ...p };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* sin almacenamiento: la preferencia dura lo que la sesión */
      }
      return next;
    });
  }

  // Número de páginas = ancho total de las columnas / ancho de una página.
  // Una página avanza el ancho visible más el hueco entre columnas.
  const GAP = 64;
  const [cols, setCols] = useState(1);
  const measure = useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    setCols(el.clientWidth >= 900 ? 2 : 1);
    const stride = el.clientWidth + GAP;
    const total = Math.max(1, Math.ceil((el.scrollWidth + GAP) / stride - 0.01));
    setPages(total);
    setPage((p) => Math.min(p, total - 1));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    const ro = new ResizeObserver(measure);
    if (viewport.current) ro.observe(viewport.current);
    // Las imágenes cambian el alto de las columnas al terminar de cargar.
    const imgs = viewport.current?.querySelectorAll("img") ?? [];
    imgs.forEach((i) => i.addEventListener("load", measure));
    return () => {
      ro.disconnect();
      imgs.forEach((i) => i.removeEventListener("load", measure));
    };
  }, [open, prefs, measure]);

  useEffect(() => {
    const el = viewport.current;
    if (el) el.scrollTo({ left: page * (el.clientWidth + GAP), behavior: "smooth" });
  }, [page, pages, cols]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Atajos de teclado del modo lectura.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        setPage((p) => Math.min(p + 1, pages - 1));
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") setPage((p) => Math.max(p - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, pages]);

  // Deslizar con el dedo, como en una tableta.
  const touchX = useRef<number | null>(null);

  const t = THEMES[prefs.theme];
  const font = FONTS[prefs.font].css;

  return (
    <>
      <button
        type="button"
        onClick={openReader}
        className="lx-ui inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        <BookOpen size={16} /> Leer en modo revista
      </button>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Modo revista: ${title}`}
            className="fixed inset-0 z-[100] flex flex-col pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]"
            style={{ background: t.bg, color: t.fg, transition: "background .3s, color .3s" }}
          >
            {/* Barra superior */}
            <div className="flex items-center gap-3 px-4 py-3 sm:px-8" style={{ borderBottom: `1px solid ${t.rule}` }}>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full hover:opacity-70 pointer-coarse:size-11">
                <X size={20} />
              </button>
              <span className="min-w-0 flex-1 truncate text-sm" style={{ color: t.muted }}>
                {title}
              </span>
              {/* Colores de ListenArticle vienen de --border/--fg-muted/--accent
                  (el resto del sitio); aquí no aplican esos tokens, así que se
                  igualan a la paleta que el lector eligió en este momento. */}
              <div
                style={{
                  ["--border" as string]: t.rule,
                  ["--fg-muted" as string]: t.muted,
                  ["--accent" as string]: "#b45309",
                  color: t.fg,
                }}
              >
                <ListenArticle title={title} excerpt={excerpt} body={body} lang={lang} />
              </div>
              <button
                type="button"
                onClick={() => setPanel((v) => !v)}
                aria-expanded={panel}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium pointer-coarse:min-h-11"
                style={{ border: `1px solid ${t.rule}` }}
              >
                <Settings2 size={16} /> Aa
              </button>
            </div>

            {/* Formulario de lectura */}
            {panel && (
              <div
                className="absolute right-4 top-16 z-10 w-[min(22rem,calc(100vw-2rem))] rounded-2xl p-5 shadow-2xl sm:right-8"
                style={{ background: t.bg, border: `1px solid ${t.rule}` }}
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: t.muted }}>
                  Fondo
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(THEMES) as ThemeId[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => update({ theme: id })}
                      aria-pressed={prefs.theme === id}
                      className="flex flex-col items-center gap-1 text-xs"
                    >
                      <span
                        className="grid size-10 place-items-center rounded-full text-sm font-semibold"
                        style={{
                          background: THEMES[id].bg,
                          color: THEMES[id].fg,
                          border: `2px solid ${prefs.theme === id ? "#b45309" : THEMES[id].rule}`,
                        }}
                      >
                        Aa
                      </span>
                      {THEMES[id].label}
                    </button>
                  ))}
                </div>

                <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-widest" style={{ color: t.muted }}>
                  Tamaño de letra
                </p>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => update({ size: Math.max(15, prefs.size - 1) })} aria-label="Letra más pequeña" className="rounded-full p-2" style={{ border: `1px solid ${t.rule}` }}>
                    <Minus size={14} />
                  </button>
                  <input
                    type="range"
                    min={15}
                    max={30}
                    value={prefs.size}
                    onChange={(e) => update({ size: Number(e.target.value) })}
                    aria-label="Tamaño de letra"
                    className="flex-1 accent-[#b45309]"
                  />
                  <button type="button" onClick={() => update({ size: Math.min(30, prefs.size + 1) })} aria-label="Letra más grande" className="rounded-full p-2" style={{ border: `1px solid ${t.rule}` }}>
                    <Plus size={14} />
                  </button>
                  <span className="w-10 text-right text-sm tabular-nums">{prefs.size}px</span>
                </div>

                <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-widest" style={{ color: t.muted }}>
                  Fuente
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(FONTS) as FontId[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => update({ font: id })}
                      aria-pressed={prefs.font === id}
                      className="rounded-xl px-3 py-2 text-base"
                      style={{
                        fontFamily: FONTS[id].css,
                        border: `2px solid ${prefs.font === id ? "#b45309" : t.rule}`,
                      }}
                    >
                      {FONTS[id].label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Páginas: columnas del alto de la pantalla que se recorren en horizontal */}
            <div className="min-h-0 flex-1 px-6 py-8 sm:px-12 lg:px-20">
            <div
              ref={viewport}
              className="h-full overflow-hidden"
              onClick={() => panel && setPanel(false)}
              onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
              onTouchEnd={(e) => {
                if (touchX.current === null) return;
                const dx = e.changedTouches[0].clientX - touchX.current;
                if (dx < -50) setPage((p) => Math.min(p + 1, pages - 1));
                if (dx > 50) setPage((p) => Math.max(p - 1, 0));
                touchX.current = null;
              }}
              style={{
                columnCount: cols,
                columnGap: GAP,
                columnFill: "auto",
                height: "100%",
                fontFamily: font,
                fontSize: prefs.size,
                lineHeight: 1.65,
                ["--reader-muted" as string]: t.muted,
                ["--reader-rule" as string]: t.rule,
              }}
            >
              {kicker && (
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: "#b45309", fontFamily: "system-ui" }}>
                  {kicker}
                </p>
              )}
              <h1 className="mb-4 font-semibold leading-tight" style={{ fontSize: "1.9em", breakAfter: "avoid" }}>
                {title}
              </h1>
              <p className="mb-5" style={{ color: t.muted, fontSize: "1.1em" }}>
                {excerpt}
              </p>
              {byline && (
                <p className="mb-6 text-sm" style={{ color: t.muted, fontFamily: "system-ui" }}>
                  {byline}
                </p>
              )}
              {cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt={coverAlt ?? ""} className="mb-6 w-full rounded-lg object-cover" style={{ maxHeight: "45vh", breakInside: "avoid" }} />
              )}
              <ArticleBody className="reader-body" html={body} />
            </div>
            </div>

            {/* Paginación */}
            <div className="flex items-center justify-center gap-6 px-4 py-3" style={{ borderTop: `1px solid ${t.rule}` }}>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(p - 1, 0))}
                disabled={page === 0}
                aria-label="Página anterior"
                className="grid size-10 place-items-center rounded-full disabled:opacity-30 pointer-coarse:size-12"
              >
                <ChevronLeft size={22} />
              </button>
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-sm tabular-nums" style={{ color: t.muted }}>
                  {page + 1} / {pages}
                </span>
                <div className="h-1 w-40 overflow-hidden rounded-full" style={{ background: t.rule }}>
                  <div className="h-full rounded-full bg-[#b45309] transition-all" style={{ width: `${((page + 1) / pages) * 100}%` }} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(p + 1, pages - 1))}
                disabled={page >= pages - 1}
                aria-label="Página siguiente"
                className="grid size-10 place-items-center rounded-full disabled:opacity-30 pointer-coarse:size-12"
              >
                <ChevronRight size={22} />
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
