"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import type { ArticleListItem } from "@/lib/content";
import { homeStyleImageScale, homeStyleTitleCss } from "@/lib/home-style";
import { cn, formatDate } from "@/lib/utils";
import { CoverArt } from "@/components/cover-art";
import { DEFAULT_LOCALE, INTL_LOCALE, categoryLabel, localePath, t, type Locale } from "@/lib/i18n";

type Variant = "lead" | "feature" | "compact";
const BASE_PX: Record<Variant, number> = { lead: 46, feature: 22, compact: 17 };

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

/**
 * Ficha de la plantilla Clásico ("broadsheet"): tipografía como protagonista,
 * numeración editorial real (orden de publicación, no decorativa), papel con
 * grano sutil. Deliberadamente sin fotografía en `compact` — contraste de
 * texto puro frente a las otras 3 plantillas, todas dominadas por imagen.
 */
export function BroadsheetCard({
  locale = DEFAULT_LOCALE,
  a,
  index,
  variant = "feature",
  priority = false,
  interactive = true,
  className,
}: {
  locale?: Locale;
  a: ArticleListItem;
  index: number;
  variant?: Variant;
  priority?: boolean;
  interactive?: boolean;
  className?: string;
}) {
  const Wrapper: React.ElementType = interactive ? Link : "div";
  const wrapperProps = interactive ? { href: localePath(locale, `/articulo/${a.slug}`) } : {};
  const titleStyle = homeStyleTitleCss(a.homeStyle, BASE_PX[variant], variant === "lead" ? 1.02 : 1.14);
  const imageScale = homeStyleImageScale(a.homeStyle);
  const num = String(index + 1).padStart(2, "0");

  if (variant === "compact") {
    return (
      <motion.article
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-40px" }}
        className={cn("group", className)}
      >
        <Wrapper {...wrapperProps} className="flex items-baseline gap-4 py-4">
          <span className="font-[family-name:var(--font-display)] text-[0.85rem] text-[color-mix(in_srgb,var(--brand-ink)_75%,transparent)]">
            {num}
          </span>
          <div className="min-w-0">
            {a.categoryName && <span className="kicker">{categoryLabel(locale, a.categorySlug, a.categoryName ?? "")}</span>}
            <h3
              className="mt-0.5 font-[family-name:var(--font-display)] font-medium text-[var(--ink)] group-hover:underline group-hover:decoration-[var(--brand)] group-hover:underline-offset-4"
              style={titleStyle}
            >
              {a.title}
            </h3>
          </div>
        </Wrapper>
      </motion.article>
    );
  }

  return (
    <motion.article
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      className={cn("group", className)}
    >
      <Wrapper {...wrapperProps} className="block">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-[var(--bw-rule,var(--rule))]" aria-hidden />
          <span className="font-[family-name:var(--font-display)] text-xs uppercase tracking-[0.16em] text-[var(--brand-ink)]">
            {t(locale, "card.number")} {num}
          </span>
          {a.categoryName && (
            <>
              <span className="text-[var(--ink-faint)]" aria-hidden>
                ·
              </span>
              <span className="kicker !text-[var(--ink-faint)]">{categoryLabel(locale, a.categorySlug, a.categoryName ?? "")}</span>
            </>
          )}
        </div>

        {(
          <div
            className={cn("media-frame mt-4", variant === "lead" ? "aspect-[16/8]" : "aspect-[16/10]")}
            style={imageScale !== 100 ? { width: `${imageScale}%`, marginInline: "auto" } : undefined}
          >
            {!a.coverImageUrl ? (
              <CoverArt seed={a.slug} label={a.categoryName ?? a.title} className="text-[5rem]" />
            ) : (
            <Image
              src={a.coverImageUrl}
              alt={a.coverImageAlt ?? a.title}
              width={variant === "lead" ? 1400 : 700}
              height={variant === "lead" ? 700 : 438}
              priority={priority}
              sizes={variant === "lead" ? "(min-width: 1024px) 65vw, 100vw" : "(min-width: 640px) 45vw, 100vw"}
              className="grayscale-[0.15] transition-[filter] duration-500 group-hover:grayscale-0"
            />
            )}
          </div>
        )}

        <h2
          className={cn(
            "font-[family-name:var(--font-display)] font-semibold text-[var(--ink)]",
            variant === "lead" ? "mt-5" : "mt-4",
          )}
          style={titleStyle}
        >
          {a.title}
        </h2>

        <p
          className={cn(
            "entry-dek mt-3",
            variant === "lead" ? "max-w-2xl text-[1.15rem] first-letter:float-left first-letter:mr-[0.09em] first-letter:mt-[0.02em] first-letter:font-[family-name:var(--font-display)] first-letter:text-[3.1em] first-letter:font-semibold first-letter:leading-[0.78] first-letter:text-[var(--brand-ink)]" : "line-clamp-3 text-[0.98rem]",
          )}
        >
          {a.excerpt}
        </p>

        <p className="meta mt-3">
          {a.authorName ? <span className="uppercase tracking-[0.06em]">{a.authorName}</span> : null}
          {a.authorName && a.publishedAt ? <span aria-hidden> · </span> : null}
          {a.publishedAt ? <time dateTime={new Date(a.publishedAt).toISOString()}>{formatDate(a.publishedAt, INTL_LOCALE[locale])}</time> : null}
        </p>
      </Wrapper>
    </motion.article>
  );
}
