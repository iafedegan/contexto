"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import { CoverArt } from "@/components/cover-art";
import { ArticleBody } from "@/components/article-body";

export type SitePreviewChrome = {
  /** Plantilla activa (`data-theme`). */
  theme: string;
  /** Fondo elegido en /panel/portada. */
  style?: React.CSSProperties;
  /** Estilo por componente (CSS ya validado). */
  css?: string;
  /** Cabecera y pie reales de la plantilla, renderizados en el servidor. */
  header: React.ReactNode;
  footer: React.ReactNode;
};

/**
 * La nota tal como se verá en el sitio en un PC: se pinta a 1440 px con la
 * plantilla activa (cabecera, pie, colores, tipografías) y se reduce con
 * `zoom` hasta caber en el panel. Mismo marcado que la página del artículo.
 */
export const PREVIEW_STORAGE_KEY = "cg:vista-articulo";

export type Props = {
  chrome: SitePreviewChrome;
  title: string;
  excerpt: string;
  bodyHtml: string;
  cover: string;
  coverAlt: string;
  category?: string;
  author?: string;
  minutes: number;
  tags: string[];
};

/**
 * Vista previa en el paso del asistente; «Ampliar» la abre en una pestaña
 * nueva a pantalla completa. Los datos viajan por localStorage (la pestaña
 * nueva pone la cabecera y el pie reales por su cuenta) y se actualizan
 * mientras el asistente siga mostrando este paso.
 */
export function SiteArticlePreview(props: Props) {
  const { chrome: _chrome, ...data } = props;
  void _chrome;
  const serialized = JSON.stringify(data);
  useEffect(() => {
    try {
      localStorage.setItem(PREVIEW_STORAGE_KEY, serialized);
    } catch {
      /* sin almacenamiento: la pestaña nueva mostrará lo último guardado */
    }
  }, [serialized]);

  return (
    <div
      className="group relative h-full cursor-zoom-in"
      onClick={() => window.open("/panel/articulos/vista-previa", "_blank")}
      title="Clic para ver en una pestaña nueva"
    >
      <Frame {...props} />
      <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1.5 text-xs font-semibold text-white opacity-80 transition group-hover:opacity-100">
        <Maximize2 size={13} /> Ampliar
      </span>
    </div>
  );
}

export function Frame({
  chrome,
  title,
  excerpt,
  bodyHtml,
  cover,
  coverAlt,
  category,
  author,
  minutes,
  tags,
}: Props) {
  const WIDTH = 1440;
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const set = () => setScale(Math.min(1, el.clientWidth / WIDTH));
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const today = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" }).format(new Date());

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border)] shadow-[var(--shadow)]">
      {/* Barra de navegador */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 truncate rounded-md bg-[var(--surface)] px-3 py-0.5 text-[0.7rem] text-[var(--fg-muted)]">
          contextoganadero.com/articulo/…
        </span>
        <span className="ml-auto text-[0.68rem] text-[var(--fg-muted)]">
          Escritorio · {WIDTH} px · {Math.round(scale * 100)} %
        </span>
      </div>
      <div ref={frame} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div style={{ width: WIDTH, zoom: scale }}>
          <div data-theme={chrome.theme} data-site-root className="lx-shell lx-grain" style={chrome.style}>
            {chrome.css && <style dangerouslySetInnerHTML={{ __html: chrome.css }} />}
            {/* Los enlaces de la vista previa no navegan. */}
            <div className="contents" onClickCapture={(e) => (e.target as HTMLElement).closest("a") && e.preventDefault()}>
              {chrome.header}
              <main data-region="body" className="shell flex-1 py-14">
                <nav className="lx-ui flex flex-wrap items-center gap-2 text-[0.68rem] uppercase tracking-[0.2em] text-[var(--fg-muted)]">
                  <span>Inicio</span>
                  {category && (
                    <>
                      <span aria-hidden className="text-[var(--accent-2)]">/</span>
                      <span className="text-[var(--accent)]">{category}</span>
                    </>
                  )}
                </nav>
                <h1 className="lx-display mt-6 text-[3.4rem] font-semibold leading-[1.06] tracking-tight">{title}</h1>
                <p className="mt-5 text-[1.35rem] leading-relaxed text-[var(--fg-muted)]">{excerpt}</p>
                <hr className="lx-rule my-8" />
                <div className="flex flex-wrap items-center gap-4">
                  <span className="lx-display grid size-11 place-items-center rounded-full bg-[var(--accent)] text-base text-[var(--accent-fg)]">
                    {(author ?? "C").charAt(0)}
                  </span>
                  <div className="lx-ui text-sm">
                    <span className="font-semibold">{author ?? "Redacción"}</span>
                    <p className="mt-0.5 text-xs uppercase tracking-[0.16em] text-[var(--fg-muted)]">
                      {today} · {minutes} min de lectura
                    </p>
                  </div>
                </div>
                <figure className="lx-media lx-card relative mt-10 aspect-[16/9] w-full">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt={coverAlt || title} className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <CoverArt seed={title} label={category ?? title} className="text-[7rem]" />
                  )}
                </figure>
                {bodyHtml ? (
                  <ArticleBody className="prose prose-drop mt-12 !max-w-none" html={bodyHtml} />
                ) : (
                  <p className="mt-12 italic text-[var(--fg-muted)]">Sin cuerpo todavía.</p>
                )}
                {tags.length > 0 && (
                  <ul className="mt-12 flex flex-wrap gap-2">
                    {tags.map((t) => (
                      <li key={t} className="lx-chip">
                        {t}
                      </li>
                    ))}
                  </ul>
                )}
              </main>
              {chrome.footer}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
