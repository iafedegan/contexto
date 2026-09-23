"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useMotionTemplate, useSpring } from "framer-motion";
import type { ArticleListItem } from "@/lib/content";
import { homeStyleTitleCss } from "@/lib/home-style";
import { cn, formatDate } from "@/lib/utils";
import { CoverArt } from "@/components/cover-art";
import { DEFAULT_LOCALE, INTL_LOCALE, categoryLabel, localePath, type Locale } from "@/lib/i18n";

type Size = "xl" | "lg" | "md";

const TITLE_PX: Record<Size, number> = { xl: 34, lg: 22, md: 14.5 };

/**
 * Ficha de la plantilla Vanguardia: foto a sangre + degradado + texto en
 * blanco, esquinas muy redondeadas, e inclinación 3D "magnética" que sigue
 * el cursor (spring physics) con un brillo especular que se mueve con él —
 * el tipo de micro-interacción que separa un bento grid "de verdad" de una
 * cuadrícula con esquinas redondeadas.
 */
export function BentoTile({
  locale = DEFAULT_LOCALE,
  a,
  size = "md",
  interactive = true,
  priority = false,
  tilt,
  className,
}: {
  locale?: Locale;
  a: ArticleListItem;
  size?: Size;
  interactive?: boolean;
  priority?: boolean;
  tilt?: "left" | "right";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useSpring(0, { stiffness: 300, damping: 25 });
  const rotateY = useSpring(0, { stiffness: 300, damping: 25 });
  const glowX = useSpring(50, { stiffness: 200, damping: 30 });
  const glowY = useSpring(50, { stiffness: 200, damping: 30 });
  const glow = useMotionTemplate`radial-gradient(280px circle at ${glowX}% ${glowY}%, rgba(255,255,255,0.14), transparent 65%)`;

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const px = (e.clientX - box.left) / box.width;
    const py = (e.clientY - box.top) / box.height;
    rotateY.set((px - 0.5) * 10);
    rotateX.set((0.5 - py) * 10);
    glowX.set(px * 100);
    glowY.set(py * 100);
  }
  function handleLeave() {
    rotateX.set(0);
    rotateY.set(0);
  }

  const Wrapper: React.ElementType = interactive ? Link : "div";
  const wrapperProps = interactive ? { href: localePath(locale, `/articulo/${a.slug}`) } : {};
  const showDek = size !== "md";
  const titleStyle = homeStyleTitleCss(a.homeStyle, TITLE_PX[size], size === "xl" ? 1.05 : 1.2);

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      className={cn("group relative", tilt === "left" && "sm:-rotate-1", tilt === "right" && "sm:rotate-1", className)}
    >
      <Wrapper
        {...wrapperProps}
        className="relative flex h-full flex-col justify-end overflow-hidden rounded-[1.75rem] bg-[#14151a] shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]"
      >
        {!a.coverImageUrl && (
          <CoverArt seed={a.slug} label={a.categoryName ?? a.title} className="absolute inset-0 text-[7rem]" />
        )}
        {a.coverImageUrl && (
          <Image
            src={a.coverImageUrl}
            alt={a.coverImageAlt ?? a.title}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 40vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover opacity-90 transition-transform duration-700 ease-out group-hover:scale-[1.08] group-hover:opacity-100"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/25 to-black/5" />
        <motion.div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ backgroundImage: glow }} aria-hidden />
        <div className="pointer-events-none absolute inset-0 rounded-[1.75rem] opacity-0 shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.25)] transition-opacity duration-300 group-hover:opacity-100" aria-hidden />

        {a.categoryName && (
          <span className="glass absolute left-3 top-3 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white/90 sm:left-4 sm:top-4">
            {categoryLabel(locale, a.categorySlug, a.categoryName ?? "")}
          </span>
        )}

        <div className={cn("relative z-[1] p-3 sm:p-4", size === "xl" && "sm:p-6")}>
          <h3
            className="font-[family-name:var(--font-sans)] font-extrabold tracking-tight text-white"
            style={titleStyle}
          >
            {a.title}
          </h3>
          {showDek && (
            <p
              className={cn(
                "mt-2 max-w-md text-[0.8rem] text-white/70 transition-all duration-300",
                size === "xl" ? "line-clamp-2 sm:text-[0.95rem]" : "line-clamp-2",
                "max-h-0 -translate-y-1 opacity-0 group-hover:max-h-20 group-hover:translate-y-0 group-hover:opacity-100",
              )}
            >
              {a.excerpt}
            </p>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-white/50">
            {a.authorName && <span>{a.authorName}</span>}
            {a.authorName && a.publishedAt && <span aria-hidden>·</span>}
            {a.publishedAt && <time dateTime={new Date(a.publishedAt).toISOString()}>{formatDate(a.publishedAt, INTL_LOCALE[locale])}</time>}
          </p>
        </div>
      </Wrapper>
    </motion.div>
  );
}
