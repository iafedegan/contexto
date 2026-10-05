"use client";

import { ArrowRight, Check, TrendingUp } from "lucide-react";
import type { NewsItem, TopicIdea } from "@/app/panel/(app)/articulos/ai-actions";

/**
 * Tarjetas del primer paso del asistente: ideas de la IA y resultados de noticias.
 * Están pensadas para escanearse rápido: título con peso, descripción recortada y la acción a la vista.
 */

/** Ideas de la IA en dos columnas: etiqueta de ámbito, titular, enfoque (3 líneas) y por qué es tendencia (2). */
export function IdeaCards({ ideas, sources, picked, onPick }: { ideas: TopicIdea[]; sources: { title: string; url: string }[]; picked?: string | null; onPick: (i: TopicIdea) => void }) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <p className="text-xs text-[var(--fg-muted)]">
        <strong className="text-[var(--fg)]">{ideas.length} temas</strong> · pulsa uno para usarlo y luego «Proponer títulos y contextos».
      </p>
      <ul className="grid gap-2.5 md:grid-cols-2">
        {ideas.map((i) => {
          const local = i.scope === "local";
          const elegido = picked === i.title;
          return (
            <li key={i.title} className="flex">
              <button
                type="button"
                onClick={() => onPick(i)}
                aria-pressed={elegido}
                className={`group flex w-full flex-col gap-1.5 rounded-[var(--radius)] border p-3.5 text-left transition hover:-translate-y-px hover:border-[var(--accent)] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  elegido ? "border-[var(--accent)] bg-[var(--surface-2)]" : "border-[var(--border)] bg-[var(--bg-2)]"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${local ? "bg-[var(--accent)]/12 text-[var(--accent)]" : "bg-[var(--accent-2)]/15 text-[var(--accent-2)]"}`}>
                    {local ? "Colombia" : "Internacional"}
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                    {elegido ? <><Check size={12} /> Elegido</> : <>Usar este tema <ArrowRight size={12} /></>}
                  </span>
                </span>
                <span className="text-[0.95rem] font-semibold leading-snug">{i.title}</span>
                <span className="line-clamp-3 text-sm leading-snug text-[var(--fg-muted)]">{i.angle}</span>
                <span className="mt-auto flex items-start gap-1.5 border-t border-[var(--border)] pt-2 text-xs text-[var(--fg-muted)]" title={i.why}>
                  <TrendingUp size={12} className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden />
                  <span className="line-clamp-2">{i.why}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {sources.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-[var(--accent)]">Fuentes consultadas ({sources.length})</summary>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {sources.map((x) => (
              <li key={x.url}><a href={x.url} target="_blank" rel="noopener noreferrer" className="lx-link">{x.title}</a></li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// Filtro de resultados: todo o un tipo de noticia.
type Filtro = "todo" | NewsItem["type"];

/** Resultados de noticias: filtro segmentado y filas compactas con «Escribir sobre esto», «Referenciar» y la fuente. */
export function NewsCards({
  news, filtro, onFiltro, isRef, onTema, onRef,
}: {
  news: NewsItem[];
  filtro: Filtro;
  onFiltro: (f: Filtro) => void;
  isRef: (n: NewsItem) => boolean;
  onTema: (n: NewsItem) => void;
  onRef: (n: NewsItem) => void;
}) {
  const etiquetas: Record<Filtro, string> = { todo: "Todo", noticia: "Noticias", video: "Videos", oficial: "Oficiales y redes" };
  const lista = news.filter((n) => filtro === "todo" || n.type === filtro);
  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-2)] p-1" role="group" aria-label="Filtrar resultados">
        {(["todo", "noticia", "video", "oficial"] as const).map((f) => {
          const cuantos = f === "todo" ? news.length : news.filter((n) => n.type === f).length;
          if (f !== "todo" && cuantos === 0) return null;
          return (
            <button key={f} type="button" onClick={() => onFiltro(f)} aria-pressed={filtro === f}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${filtro === f ? "bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>
              {etiquetas[f]} <span className="opacity-70">{cuantos}</span>
            </button>
          );
        })}
      </div>
      <ul className="flex flex-col gap-2">
        {lista.map((n) => {
          const ref = isRef(n);
          return (
            <li key={n.url} className={`flex gap-3 rounded-[var(--radius)] border bg-[var(--bg-2)] p-3 transition ${ref ? "border-[var(--accent)]" : "border-[var(--border)]"}`}>
              {n.videoId && (
                // eslint-disable-next-line @next/next/no-img-element -- miniatura externa de YouTube
                <img src={`https://img.youtube.com/vi/${n.videoId}/mqdefault.jpg`} alt="" loading="lazy" className="hidden h-[4.5rem] w-32 shrink-0 rounded-md object-cover sm:block" />
              )}
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-[0.7rem] text-[var(--fg-muted)]">
                  {n.type === "video" && <span className="rounded-full bg-[#dc2626]/12 px-2 py-0.5 font-semibold text-[#b91c1c]">▶ Video</span>}
                  {n.type === "oficial" && <span className="rounded-full bg-[var(--accent)]/12 px-2 py-0.5 font-semibold text-[var(--accent)]">Oficial</span>}
                  <span className="font-medium text-[var(--fg)]">{n.outlet}</span>
                  {n.date && <span>· {n.date}</span>}
                </p>
                <p className="mt-0.5 text-[0.95rem] font-semibold leading-snug">{n.title}</p>
                <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-[var(--fg-muted)]">{n.summary}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => onTema(n)} className="lx-btn !px-3 !py-1.5 text-xs">Escribir sobre esto</button>
                  <button type="button" onClick={() => onRef(n)} aria-pressed={ref} className="lx-btn lx-btn-ghost !px-3 !py-1.5 text-xs">
                    {ref ? <><Check size={12} /> Referenciada</> : n.type === "video" ? "Referenciar e incrustar" : "Referenciar"}
                  </button>
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="lx-link ml-auto text-xs">{n.type === "video" ? "Ver en YouTube ↗" : "Abrir fuente ↗"}</a>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
