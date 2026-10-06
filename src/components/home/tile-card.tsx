"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import type { ArticleListItem } from "@/lib/content";
import { homeStyleTitleCss } from "@/lib/home-style";
import { cn, formatDate } from "@/lib/utils";
import { CoverArt } from "@/components/cover-art";
import { DEFAULT_LOCALE, INTL_LOCALE, categoryLabel, localePath, type Locale } from "@/lib/i18n";

// Paleta fija por categoría (elección editorial, no del esquema): refuerza el
// escaneo rápido tipo "panel de datos" — cada tema se reconoce por color
// antes de leer el texto.
const ACCENT: Record<string, string> = {
  "economia-y-mercados": "#b45309",
  regiones: "#0f766e",
  sostenibilidad: "#15803d",
  "politica-gremial": "#1d4ed8",
  "ciencia-y-tecnologia": "#7c3aed",
  opinion: "#be123c",
};
// Color de acento por defecto de la ficha.
const DEFAULT_ACCENT = "#2563eb";

/**
 * Ficha de la plantilla Compacto: panel denso tipo dashboard/terminal.
 * Bordes finos, chip de categoría a color sólido, metadatos en monoespaciada
 * tabular, transición casi instantánea (nada de "cine" — esto es escaneo
 * rápido de datos, no lectura pausada).
 */
export function TileCard({
  locale = DEFAULT_LOCALE,
  a,
  index,
  size = "md",
  interactive = true,
  priority = false,
  className,
}: {
  locale?: Locale;
  a: ArticleListItem;
  index: number;
  size?: "md" | "lg";
  interactive?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const Wrapper: React.ElementType = interactive ? Link : "div";
  const wrapperProps = interactive ? { href: localePath(locale, `/articulo/${a.slug}`) } : {};
  const accent = a.categorySlug ? (ACCENT[a.categorySlug] ?? DEFAULT_ACCENT) : DEFAULT_ACCENT;
  const titleStyle = homeStyleTitleCss(a.homeStyle, size === "lg" ? 22 : 14.5, 1.28);

  return (
    <motion.article data-bs-root={a.slug}
      // Visible desde el HTML del servidor: una animación de entrada dejaba la
      // noticia invisible hasta cargar el JS (mala señal = portada en blanco).
      className={cn("group border border-[var(--rule)] bg-[var(--paper)] transition-colors duration-150", className)}
      style={{ ["--tile-accent" as string]: accent }}
    >
      <Wrapper {...wrapperProps} className="block h-full">
        <div className={cn("relative overflow-hidden bg-[var(--paper-2)]", size === "lg" ? "aspect-[16/10]" : "aspect-[4/3]")}>
          {!a.coverImageUrl && (
            <CoverArt seed={a.slug} label={a.categoryName ?? a.title} className="absolute inset-0 text-[4rem]" />
          )}
          {a.coverImageUrl && (
            <Image
              src={a.coverImageUrl}
              alt={a.coverImageAlt ?? a.title}
              fill
              priority={priority}
              fetchPriority={priority ? "high" : undefined}
              sizes="(min-width: 1024px) 24vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover transition-[filter,transform] duration-150 ease-out group-hover:scale-[1.015] group-hover:brightness-[1.03]"
            />
          )}
          <span
            className="absolute left-0 top-0 max-w-[calc(100%-3rem)] truncate px-2 py-1 text-[0.72rem] font-bold uppercase tracking-[0.06em] text-white"
            style={{ background: accent }}
          >
            {categoryLabel(locale, a.categorySlug, a.categoryName ?? "General")}
          </span>
          <span className="absolute right-0 top-0 bg-black/55 px-1.5 py-1 font-mono text-[0.72rem] tabular-nums text-white/85">
            #{String(index + 1).padStart(2, "0")}
          </span>
          <span
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] scale-x-0 transition-transform duration-150 ease-out group-hover:scale-x-100"
            style={{ background: accent, transformOrigin: "left" }}
            aria-hidden
          />
        </div>
        <div className="p-2.5">
          <h3
            className="font-[family-name:var(--font-sans)] font-bold text-[var(--ink)] group-hover:text-[var(--tile-accent)]"
            style={titleStyle}
          >
            {a.title}
          </h3>
          <p className="mt-1.5 font-mono text-xs tabular-nums text-[var(--ink-faint)]">
            {a.publishedAt ? formatDate(a.publishedAt, INTL_LOCALE[locale]) : ""}
            {a.authorName ? ` · ${a.authorName}` : ""}
          </p>
        </div>
      </Wrapper>
    </motion.article>
  );
}
