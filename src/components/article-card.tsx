import Link from "next/link";
import type { ArticleListItem } from "@/lib/content";
import { CardMedia } from "@/components/cover-art";
import { LiveBadge } from "@/components/live-badge";
import { formatDate } from "@/lib/utils";
import { homeStyleImageBox, homeStyleTitleCss } from "@/lib/home-style";
import { DEFAULT_LOCALE, INTL_LOCALE, categoryLabel, localePath, type Locale } from "@/lib/i18n";

// Variantes visuales de la tarjeta de nota.
export type CardVariant = "lead" | "gold" | "copper" | "pearl" | "rail";

/**
 * Tamaño base del titular por variante, en px. El estilo por tarjeta fijado en
 * /panel/portada (fuente, negrilla, cursiva, escala) se aplica SOBRE esta base,
 * así un mismo ajuste se ve proporcionado en la apertura y en la rejilla.
 */
const TITLE_PX: Record<CardVariant, number> = {
  lead: 44,
  gold: 20,
  copper: 24,
  pearl: 24,
  rail: 18,
};

/** Estilo resuelto de una tarjeta: titular, imagen y densidad del bloque. */
function cardStyle(a: ArticleListItem, variant: CardVariant) {
  const size = a.homeStyle?.size ?? null;
  return {
    title: homeStyleTitleCss(a.homeStyle, TITLE_PX[variant], variant === "lead" ? 1.08 : 1.2),
    // Caja de la imagen elegida en el panel (porcentaje o medidas exactas) y si trae alto fijo.
    // Dónde va el texto sobre la foto (solo la nota principal): abajo a lo ancho, o arriba en una esquina.
    textArriba: a.homeStyle?.textPos === "arriba-izq" || a.homeStyle?.textPos === "arriba-der",
    textDerecha: a.homeStyle?.textPos === "arriba-der",
    imageBox: homeStyleImageBox(a.homeStyle).css,
    imageAlto: homeStyleImageBox(a.homeStyle).alto,
    // "S" comprime el bloque (sin imagen ni resumen); "L" lo abre.
    hideMedia: size === "sm",
    hideExcerpt: size === "sm",
    excerptClamp: size === "lg" ? "line-clamp-4" : "line-clamp-2",
  };
}

// Propiedades de la tarjeta: nota, variante, tamaño y estilo manual.
type Props = {
  a: ArticleListItem;
  variant?: CardVariant;
  priority?: boolean;
  index?: number;
  /** Idioma de la interfaz: fechas, «Por» y nombres de sección. */
  locale?: Locale;
  /** En el celular la tarjeta se compacta para ir de a dos por fila (solo variante «gold»): sin resumen, titular menor. */
  compact?: boolean;
};

/** Tarjeta editorial. Cada plantilla usa la variante que le corresponde. */
export function ArticleCard({
  a,
  variant = "gold",
  priority = false,
  index,
  locale = DEFAULT_LOCALE,
  compact = false,
}: Props) {
  switch (variant) {
    case "lead":
      return <LeadCard a={a} priority={priority} locale={locale} />;
    case "copper":
      return <CopperCard a={a} index={index} locale={locale} />;
    case "pearl":
      return <PearlCard a={a} locale={locale} />;
    case "rail":
      return <RailCard a={a} index={index} locale={locale} />;
    default:
      return <GoldCard a={a} priority={priority} locale={locale} compact={compact} />;
  }
}

// Línea de datos de la nota: autor y fecha.
function Meta({
  a,
  locale,
  className = "",
  compact = false,
}: {
  a: ArticleListItem;
  locale: Locale;
  className?: string;
  /** En el celular, y en una tarjeta compacta, solo la fecha: el autor no cabe en media pantalla. */
  compact?: boolean;
}) {
  return (
    <p className={`text-xs text-[var(--fg-muted)] ${className}`}>
      {a.authorName && <span className={compact ? "max-sm:hidden" : undefined}>{`${a.authorName} · `}</span>}
      {a.publishedAt ? formatDate(a.publishedAt, INTL_LOCALE[locale]) : ""}
    </p>
  );
}

// Rótulo sobre el titular: la sección, o la etiqueta «En vivo» cuando la nota es un directo.
function Kicker({
  a,
  locale,
  className = "",
}: {
  a: ArticleListItem;
  locale: Locale;
  className?: string;
}) {
  // La etiqueta de directo sustituye visualmente a la sección cuando aplica:
  // dos distintivos compitiendo en el mismo sitio restan fuerza a ambos.
  if (a.isLive) {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        <LiveBadge locale={locale} />
        {a.categorySlug && (
          <Link href={localePath(locale, `/categoria/${a.categorySlug}`)} className="lx-kicker relative z-[4] -my-[5.5px] inline-flex min-h-6 items-center pointer-coarse:before:absolute pointer-coarse:before:inset-x-0 pointer-coarse:before:-inset-y-3.5 pointer-coarse:before:content-['']">
            {categoryLabel(locale, a.categorySlug, a.categoryName ?? "")}
          </Link>
        )}
      </span>
    );
  }
  if (!a.categorySlug) return null;
  return (
    <Link
      href={localePath(locale, `/categoria/${a.categorySlug}`)}
      className={`lx-kicker relative z-[4] -my-[5.5px] inline-flex min-h-6 items-center pointer-coarse:before:absolute pointer-coarse:before:inset-x-0 pointer-coarse:before:-inset-y-3.5 pointer-coarse:before:content-[''] ${className}`}
    >
      {categoryLabel(locale, a.categorySlug, a.categoryName ?? "")}
    </Link>
  );
}

/* --------------------------------------------- Portada: pieza de apertura */
function LeadCard({ a, priority, locale }: { a: ArticleListItem; priority?: boolean; locale: Locale }) {
  const st = cardStyle(a, "lead");
  return (
    /* El texto va SOBRE la foto, en la misma celda de cuadrícula, en todos los tamaños: la tarjeta mide lo que
       mida lo mayor entre la foto y el texto, y la foto se estira para llenarla. En el celular la foto es vertical
       (4:5) y el titular sale encima, como en una app de noticias; antes la foto iba arriba y el texto debajo, y la
       portada era una pila de rectángulos iguales. Antes el texto era `absolute` sobre un alto fijo: un titular largo
       se salía por arriba, recortado.
       La columna es `minmax(0,1fr)`: con `auto` y un titular largo (más alto que el 16:11 de la foto), la foto
       estirada trasladaba su alto a ancho y la columna se hacía más ancha que la tarjeta, recortando el texto por la derecha.
       La nota de apertura (con `priority`) no hace la animación de entrada: con opacidad 0 al inicio, el LCP
       esperaba a que terminara. */
    <article data-bs-root={a.slug} className={`lx-card ${priority ? "" : "lx-reveal"} group relative grid grid-cols-[minmax(0,1fr)] [&>*]:col-start-1 [&>*]:row-start-1`}>
      <div className="lx-shine pointer-events-none absolute inset-0 z-[3]" />
      <div className="lx-inlay pointer-events-none absolute inset-0 z-[2]" />
      <Link
        href={localePath(locale, `/articulo/${a.slug}`)}
        className="block"
        aria-label={a.title}
        tabIndex={-1}
        style={st.imageBox}
      >
        <CardMedia
          src={a.coverImageUrl}
          alt={a.coverImageAlt ?? a.title}
          seed={a.slug}
          label={a.categoryName ?? a.title}
          ratio="aspect-[4/5] h-full sm:aspect-[16/11]"
          priority={priority}
          sizes="(min-width: 1280px) 900px, (min-width: 768px) 60vw, 100vw"
        />
      </Link>
      {/* El degradado que da lectura al texto va del lado donde está el texto. */}
      <div className={`pointer-events-none absolute inset-x-0 h-[66%] from-[var(--bg)] via-[var(--bg)]/75 to-transparent md:h-3/4 md:via-[var(--bg)]/80 ${st.textArriba ? "top-0 bg-gradient-to-b" : "bottom-0 bg-gradient-to-t"}`} />
      <div className={`relative z-[4] p-5 md:p-9 ${st.textArriba ? "self-start md:max-w-[62%]" : "self-end"} ${st.textDerecha ? "justify-self-end text-right" : ""}`}>
        <Kicker a={a} locale={locale} className="text-[var(--accent)]" />
        <h2
          className="lx-display mt-2.5 text-2xl font-semibold leading-[1.12] tracking-tight sm:text-3xl md:mt-3 md:text-[2.75rem]"
          style={st.title}
        >
          <Link href={localePath(locale, `/articulo/${a.slug}`)} className="transition-colors hover:text-[var(--link)] after:absolute after:inset-0 after:z-[2]">
            {a.title}
          </Link>
        </h2>
        {!st.hideExcerpt && (
          <p
            className={`mt-3 hidden max-w-xl text-sm leading-relaxed text-[var(--fg-muted)] sm:block md:text-base ${st.excerptClamp} ${st.textDerecha ? "ml-auto" : ""}`}
          >
            {a.excerpt}
          </p>
        )}
        <Meta a={a} locale={locale} className="mt-3 md:mt-4" />
      </div>
    </article>
  );
}

/* ------------------------------------------- Portada: rejilla pan de oro */
function GoldCard({ a, priority, locale, compact = false }: { a: ArticleListItem; priority?: boolean; locale: Locale; compact?: boolean }) {
  const st = cardStyle(a, "gold");
  return (
    <article data-bs-root={a.slug} className={`lx-card ${priority ? "" : "lx-reveal"} group flex h-full flex-col`}>
      <div className="lx-shine pointer-events-none absolute inset-0 z-[3]" />
      {!st.hideMedia && (
        <Link
          href={localePath(locale, `/articulo/${a.slug}`)}
          className="relative block"
          style={st.imageBox}
        >
          <CardMedia
            src={a.coverImageUrl}
            alt={a.coverImageAlt ?? a.title}
            seed={a.slug}
            label={a.categoryName ?? a.title}
            priority={priority}
            ratio={st.imageAlto ? "h-full" : undefined}
            // De a dos por fila en el celular la imagen mide la mitad de la pantalla, no toda.
            sizes={compact ? "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 48vw" : undefined}
          />
        </Link>
      )}
      {/* `!`: el titular y el rótulo traen su tamaño en línea o en una clase sin capa, y en media pantalla deben ceder. */}
      <div className={`flex flex-1 flex-col gap-2.5 p-5 ${compact ? "max-sm:gap-1.5 max-sm:p-3" : ""}`}>
        <Kicker a={a} locale={locale} className={`text-[var(--accent)] ${compact ? "max-sm:!text-[0.6rem] max-sm:!tracking-[0.14em] max-sm:leading-snug" : ""}`} />
        <h3 className={`lx-display text-xl font-semibold leading-snug ${compact ? "max-sm:!text-[0.95rem] max-sm:!leading-[1.25]" : ""}`} style={st.title}>
          <Link href={localePath(locale, `/articulo/${a.slug}`)} className="transition-colors hover:text-[var(--link)] after:absolute after:inset-0 after:z-[2]">
            {a.title}
          </Link>
        </h3>
        {!st.hideExcerpt && (
          <p className={`text-sm leading-relaxed text-[var(--fg-muted)] ${st.excerptClamp} ${compact ? "max-sm:hidden" : ""}`}>
            {a.excerpt}
          </p>
        )}
        <Meta a={a} locale={locale} className="mt-auto pt-3 max-sm:pt-1.5" compact={compact} />
      </div>
    </article>
  );
}

/* ------------------------------------------------- Portada: columna lateral */
function RailCard({ a, index, locale }: { a: ArticleListItem; index?: number; locale: Locale }) {
  const st = cardStyle(a, "rail");
  const lado = { w: a.homeStyle?.imageWidth ?? a.homeStyle?.imageHeight, h: a.homeStyle?.imageHeight ?? a.homeStyle?.imageWidth };
  const medidasMiniatura: React.CSSProperties | undefined = lado.w && lado.h ? { width: `${lado.w}px`, height: `${lado.h}px` } : undefined;
  return (
    <article data-bs-root={a.slug} className="lx-reveal group flex gap-3 border-b border-[var(--border)] pb-4 last:border-0 sm:gap-4">
      {typeof index === "number" && (
        <span className="lx-display w-6 shrink-0 text-xl font-semibold text-[var(--accent)] opacity-90 sm:w-8 sm:text-2xl">
          {String(index + 1).padStart(2, "0")}
        </span>
      )}
      <div className="min-w-0 flex-1 leading-snug">
        <Kicker a={a} locale={locale} className="text-xs text-[var(--fg-muted)]" />
        <h3 className="lx-display mt-1.5 text-lg font-medium leading-snug" style={st.title}>
          <Link href={localePath(locale, `/articulo/${a.slug}`)} className="lx-link">
            {a.title}
          </Link>
        </h3>
        <Meta a={a} locale={locale} className="mt-2" />
      </div>
      {/* La miniatura también va en el celular: sin ella «Lo último» era una lista de texto plano. */}
      {!st.hideMedia && (
      <Link href={localePath(locale, `/articulo/${a.slug}`)} className="block max-w-[45%] shrink-0" aria-hidden tabIndex={-1}>
        {/* La miniatura es cuadrada; con medidas exactas en el panel toma esas (si solo hay una, es el lado del cuadrado) y el texto, al lado, se acomoda. */}
        <span className={`lx-media block overflow-hidden rounded-[var(--radius)] ${medidasMiniatura ? "max-w-full" : "size-[5.25rem] sm:size-20"}`} style={medidasMiniatura}>
          <CardMedia
            src={a.coverImageUrl}
            alt=""
            seed={a.slug}
            label={a.categoryName ?? a.title}
            ratio={medidasMiniatura ? "h-full" : "aspect-square"}
            sizes="84px"
          />
        </span>
      </Link>
      )}
    </article>
  );
}

/* ------------------------------------------------------- Sección: cobre */
function CopperCard({ a, index, locale }: { a: ArticleListItem; index?: number; locale: Locale }) {
  const st = cardStyle(a, "copper");
  return (
    <article data-bs-root={a.slug} className="lx-card lx-reveal group flex h-full flex-col">
      <div className="lx-shine pointer-events-none absolute inset-0 z-[3]" />
      <Link
        href={localePath(locale, `/articulo/${a.slug}`)}
        className="relative block"
        style={st.imageBox}
      >
        <CardMedia
          src={a.coverImageUrl}
          alt={a.coverImageAlt ?? a.title}
          seed={a.slug}
          label={a.categoryName ?? a.title}
          ratio={st.imageAlto ? "h-full" : "aspect-[4/3]"}
        />
        {typeof index === "number" && (
          <span className="lx-display absolute left-4 top-4 z-[4] grid size-10 place-items-center rounded-full bg-[var(--bg)]/70 text-sm font-bold text-[var(--accent)] backdrop-blur-md">
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-6">
        <Kicker a={a} locale={locale} className="text-[var(--accent-2)]" />
        <h3
          className="lx-display text-2xl font-extrabold leading-[1.1] tracking-tight"
          style={st.title}
        >
          <Link href={localePath(locale, `/articulo/${a.slug}`)} className="transition-colors hover:text-[var(--accent)] after:absolute after:inset-0 after:z-[2]">
            {a.title}
          </Link>
        </h3>
        {!st.hideExcerpt && (
          <p className={`text-sm leading-relaxed text-[var(--fg-muted)] ${st.excerptClamp}`}>
            {a.excerpt}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-4">
          <Meta a={a} locale={locale} />
          <span
            aria-hidden
            className="lx-ui text-lg text-[var(--accent)] transition-transform duration-500 group-hover:translate-x-1"
          >
            →
          </span>
        </div>
      </div>
    </article>
  );
}

/* --------------------------------------------------------- Autor: perla */
function PearlCard({ a, locale }: { a: ArticleListItem; locale: Locale }) {
  const st = cardStyle(a, "pearl");
  return (
    <article data-bs-root={a.slug} className="lx-card lx-reveal group flex h-full flex-col rounded-[var(--radius-lg)]">
      <div className="lx-shine pointer-events-none absolute inset-0 z-[3]" />
      <Link href={localePath(locale, `/articulo/${a.slug}`)} className="relative block px-3 pt-3">
        <span className="block overflow-hidden rounded-[calc(var(--radius-lg)-0.5rem)]">
          <CardMedia
            src={a.coverImageUrl}
            alt={a.coverImageAlt ?? a.title}
            seed={a.slug}
            label={a.categoryName ?? a.title}
            ratio="aspect-[5/3]"
          />
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-6 text-center">
        <Kicker a={a} locale={locale} className="text-[var(--accent)]" />
        <h3 className="lx-display text-2xl font-light leading-tight" style={st.title}>
          <Link href={localePath(locale, `/articulo/${a.slug}`)} className="transition-colors hover:text-[var(--accent)] after:absolute after:inset-0 after:z-[2]">
            {a.title}
          </Link>
        </h3>
        {!st.hideExcerpt && (
          <p className={`text-sm font-light leading-relaxed text-[var(--fg-muted)] ${st.excerptClamp}`}>
            {a.excerpt}
          </p>
        )}
        <Meta a={a} locale={locale} className="mt-auto pt-3" />
      </div>
    </article>
  );
}
