"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import type { Item } from "@/components/panel/portada-types";

/**
 * Las notas de la portada en una lista: elegir una para editarla y subirla o
 * bajarla con botones. Es la alternativa a arrastrar sobre la página, y la que
 * se puede usar con el teclado (el lienzo es una página dentro de un marco).
 */
export function NotasLista({
  items,
  selected,
  onSelect,
  onMove,
}: {
  items: Item[];
  selected: number | null;
  onSelect: (index: number) => void;
  onMove: (from: number, to: number) => void;
}) {
  const btn =
    "inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--fg-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--fg-muted)]";
  return (
    <div>
      <p className="mb-2 text-xs leading-relaxed text-[var(--fg-muted)]">
        De la más destacada a la menos. Elige una para editarla; también puedes arrastrarlas en la página.
      </p>
      <ol className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
        {items.map((it, i) => (
          <li
            key={it.slug}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${
              selected === i ? "border-[var(--accent)] bg-[var(--surface-2)]" : "border-[var(--border)]"
            }`}
          >
            <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-[var(--fg-muted)]">{i + 1}</span>
            <button
              type="button"
              onClick={() => onSelect(i)}
              aria-current={selected === i ? "true" : undefined}
              title={it.title}
              className="min-w-0 flex-1 truncate text-left text-sm"
            >
              {it.title}
            </button>
            {it.homeStyle && (
              <span className="size-2 shrink-0 rounded-full bg-[#c9a227]" title="Tiene estilo propio" aria-label="Tiene estilo propio" />
            )}
            <button type="button" className={btn} disabled={i === 0} onClick={() => onMove(i, i - 1)} aria-label={`Subir la nota ${i + 1}: ${it.title}`}>
              <ArrowUp size={13} />
            </button>
            <button type="button" className={btn} disabled={i === items.length - 1} onClick={() => onMove(i, i + 1)} aria-label={`Bajar la nota ${i + 1}: ${it.title}`}>
              <ArrowDown size={13} />
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
