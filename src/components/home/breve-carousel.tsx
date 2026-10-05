"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HomeCard } from "@/components/home/home-card";
import { EditableCard, type BuilderProps } from "@/components/home/editable-card";
import type { ArticleListItem } from "@/lib/content";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

// Ancho de cada tarjeta: un vistazo (peek) en móvil, exacto según columnas en
// escritorio. Clases completas y literales para que Tailwind las detecte.
const CARD_WIDTH: Record<number, string> = {
  2: "w-[78%] sm:w-[calc(50%-0.75rem)]",
  3: "w-[78%] sm:w-[calc(33.333%-1rem)]",
  4: "w-[78%] sm:w-[calc(25%-1.125rem)]",
};

/**
 * "En breve" en la plantilla Revista: carrusel horizontal con scroll-snap,
 * arrastrable con el mouse, con flechas para avanzar tarjeta a tarjeta.
 */
export function BreveCarousel({
  locale = DEFAULT_LOCALE,
  items,
  columns,
  interactive = true,
  indexOffset = 0,
  builderSelected,
  builderOverIndex,
  builderDragProps,
  builderHasStyle,
}: {
  locale?: Locale;
  items: ArticleListItem[];
  columns: number;
  interactive?: boolean;
  /** Los índices globales de estos ítems empiezan aquí, no en 0. */
  indexOffset?: number;
} & BuilderProps) {
  const track = useRef<HTMLDivElement>(null);

  // Desplaza el carrusel una tarjeta hacia un lado.
  function scrollBy(dir: 1 | -1) {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    const step = (card?.offsetWidth ?? el.clientWidth / columns) + 24;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  if (items.length === 0) return null;

  return (
    <div className="relative">
      <div
        ref={track}
        className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((a, i) => (
          <div key={a.slug} data-card className={`shrink-0 snap-start ${CARD_WIDTH[columns] ?? CARD_WIDTH[3]}`}>
            <EditableCard
              index={indexOffset + i}
              builderSelected={builderSelected}
              builderOverIndex={builderOverIndex}
              builderDragProps={builderDragProps}
              hasStyle={builderHasStyle?.(indexOffset + i)}
            >
              <HomeCard a={a} locale={locale} variant="feature" hover="zoom" interactive={interactive} />
            </EditableCard>
          </div>
        ))}
      </div>
      {items.length > columns && (
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => scrollBy(-1)}
            className="inline-flex size-[1.875rem] items-center justify-center rounded-full border border-[var(--rule)] text-[var(--ink-soft)] transition hover:border-[var(--brand)] hover:text-[var(--brand)] pointer-coarse:size-11"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            aria-label="Siguiente"
            onClick={() => scrollBy(1)}
            className="inline-flex size-[1.875rem] items-center justify-center rounded-full border border-[var(--rule)] text-[var(--ink-soft)] transition hover:border-[var(--brand)] hover:text-[var(--brand)] pointer-coarse:size-11"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
