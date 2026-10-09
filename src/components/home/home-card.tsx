import Link from "next/link";
import Image from "next/image";
import type { ArticleListItem } from "@/lib/content";
import { homeStyleImageBox, homeStyleTitleCss } from "@/lib/home-style";
import { cn, formatDate } from "@/lib/utils";
import { CoverArt } from "@/components/cover-art";
import { DEFAULT_LOCALE, INTL_LOCALE, categoryLabel, localePath, type Locale } from "@/lib/i18n";

// Variantes de la tarjeta.
type Variant = "lead" | "feature" | "compact";
// Tamaños de la tarjeta.
type Size = "sm" | "md" | "lg";

// Tamaño del titular según variante y tamaño.
const TITLE_SIZE_PX: Record<Variant, Record<Size, number>> = {
  lead: { sm: 24, md: 32, lg: 40 },
  feature: { sm: 16, md: 20, lg: 26 },
  compact: { sm: 15, md: 18, lg: 22 },
};
// Tamaño por defecto de cada variante.
const DEFAULT_SIZE: Record<Variant, Size> = { lead: "md", feature: "md", compact: "md" };

// Tamaño fijado a mano en /panel/portada (independiente de la sección donde
// caiga la tarjeta): controla cuánta imagen/resumen se muestra.
const BLOCK_LOOK: Record<Size, { image: boolean; aspect: string; dek: false | string }> = {
  sm: { image: false, aspect: "aspect-[3/2]", dek: false },
  md: { image: true, aspect: "aspect-[3/2]", dek: "line-clamp-3 text-[0.95rem]" },
  lg: { image: true, aspect: "aspect-[16/9]", dek: "line-clamp-4 text-base" },
};

// Línea de autor y fecha.
function Byline({ a, locale }: { a: ArticleListItem; locale: Locale }) {
  return (
    <p className="meta mt-2">
      {a.authorName ? <span className="uppercase tracking-[0.06em]">{a.authorName}</span> : null}
      {a.authorName && a.publishedAt ? <span aria-hidden> · </span> : null}
      {a.publishedAt ? <time dateTime={new Date(a.publishedAt).toISOString()}>{formatDate(a.publishedAt, INTL_LOCALE[locale])}</time> : null}
    </p>
  );
}

// Tarjeta de nota de la portada con su estilo manual.
export function HomeCard({
  locale = DEFAULT_LOCALE,
  a,
  variant = "feature",
  priority = false,
  interactive = true,
  hover = "underline",
  className,
}: {
  locale?: Locale;
  a: ArticleListItem;
  variant?: Variant;
  priority?: boolean;
  /** false = se usa en el editor de portada: mismo look, sin navegar. */
  interactive?: boolean;
  /** "underline" (Clásico) o "zoom" (Revista: la imagen se acerca y la tarjeta se alza). */
  hover?: "underline" | "zoom";
  className?: string;
}) {
  const style = a.homeStyle;
  const size = style?.size ?? null;
  // El tamaño fijado a mano manda sobre el look por defecto de la sección,
  // salvo en "lead" (la principal), que siempre muestra imagen y resumen.
  const look = variant !== "lead" && size ? BLOCK_LOOK[size] : null;

  const showImage = look ? look.image : variant !== "compact";
  const aspect = look ? look.aspect : variant === "lead" ? "aspect-[16/9]" : "aspect-[3/2]";
  const dekClass = look ? look.dek : variant !== "compact" && (variant === "lead" ? "text-[1.05rem]" : "line-clamp-3 text-[0.95rem]");

  const basePx = TITLE_SIZE_PX[variant][size ?? DEFAULT_SIZE[variant]];
  const titleStyle = homeStyleTitleCss(style, basePx, variant === "lead" ? 1.08 : 1.2);
  const imageBox = homeStyleImageBox(style).css;

  const Wrapper: React.ElementType = interactive ? Link : "div";
  const wrapperProps = interactive ? { href: localePath(locale, `/articulo/${a.slug}`) } : {};

  return (
    <article data-bs-root={a.slug} className={cn("group", hover === "zoom" && "hover-zoom", className)}>
      <Wrapper {...wrapperProps} className="entry-link block">
        {showImage && (
          <div
            className={cn("media-frame mb-3", aspect)}
            style={imageBox}
          >
            {!a.coverImageUrl ? (
              <CoverArt seed={a.slug} label={a.categoryName ?? a.title} className="text-[4rem]" />
            ) : (
            <Image
              src={a.coverImageUrl as string}
              alt={a.coverImageAlt ?? a.title}
              width={variant === "lead" ? 1120 : 640}
              height={variant === "lead" ? 630 : 427}
              priority={priority}
              fetchPriority={priority ? "high" : undefined}
              sizes={variant === "lead" ? "(min-width: 1024px) 62vw, 100vw" : "(min-width: 640px) 33vw, 100vw"}
            />
            )}
          </div>
        )}

        {a.categoryName && <span className="kicker">{categoryLabel(locale, a.categorySlug, a.categoryName ?? "")}</span>}

        <h3 className="entry-title mt-1" style={titleStyle}>
          {a.title}
        </h3>

        {dekClass && <p className={cn("entry-dek mt-2", dekClass)}>{a.excerpt}</p>}

        <Byline a={a} locale={locale} />
      </Wrapper>
    </article>
  );
}
