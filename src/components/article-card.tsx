import Link from "next/link";
import type { ArticleListItem } from "@/lib/content";
import { CardMedia } from "@/components/cover-art";
import { LiveBadge } from "@/components/live-badge";
import { formatDate } from "@/lib/utils";
import { estiloFijo, factorTamano, homeStyleImageBox, homeStyleTitleCss } from "@/lib/home-style";
import { DEFAULT_LOCALE, INTL_LOCALE, categoryLabel, localePath, type Locale } from "@/lib/i18n";
import { hrefNota } from "@/lib/ruta-nota";

// Variantes visuales de la tarjeta de nota.
export type CardVariant = "lead" | "gold" | "copper" | "pearl" | "rail" | "cine" | "destacada" | "ultimo" | "mosaico" | "leido";

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
  // Apertura de Esmeralda: la principal «de cine», las dos destacadas bajo ella y la lista «Lo último».
  cine: 44,
  destacada: 18,
  ultimo: 17,
  mosaico: 22,
  leido: 16,
};

/** Estilo resuelto de una tarjeta: titular, imagen y densidad del bloque. */
function cardStyle(a: ArticleListItem, variant: CardVariant) {
  const fijo = estiloFijo(a.homeStyle);
  const size = fijo?.size ?? null;
  return {
    title: homeStyleTitleCss(a.homeStyle, TITLE_PX[variant] * factorTamano(a.homeStyle), variant === "lead" || variant === "cine" ? 1.08 : 1.2),
    // Caja de la imagen elegida en el panel (porcentaje o medidas exactas) y si trae alto fijo.
    // Dónde va el texto sobre la foto (solo la nota principal): abajo a lo ancho, o arriba en una esquina.
    textArriba: fijo?.textPos === "arriba-izq" || fijo?.textPos === "arriba-der",
    textDerecha: fijo?.textPos === "arriba-der",
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
  /** Solo «rail»: lista limpia, solo texto, en pantallas anchas (la columna es angosta y la miniatura le roba la mitad al titular). */
  soloTexto?: boolean;
};

/** Tarjeta editorial. Cada plantilla usa la variante que le corresponde. */
export function ArticleCard({
  a,
  variant = "gold",
  priority = false,
  index,
  locale = DEFAULT_LOCALE,
  compact = false,
  soloTexto = false,
}: Props) {
  switch (variant) {
    case "lead":
      return <LeadCard a={a} priority={priority} locale={locale} />;
    case "cine":
      return <CineCard a={a} priority={priority} locale={locale} />;
    case "destacada":
      return <DestacadaCard a={a} locale={locale} />;
    case "ultimo":
      return <UltimoCard a={a} index={index} locale={locale} />;
    case "mosaico":
      return <MosaicoCard a={a} locale={locale} />;
    case "leido":
      return <LeidoCard a={a} index={index} locale={locale} />;
    case "copper":
      return <CopperCard a={a} index={index} locale={locale} />;
    case "pearl":
      return <PearlCard a={a} locale={locale} />;
    case "rail":
      return <RailCard a={a} index={index} locale={locale} soloTexto={soloTexto} />;
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
  const posicionPanel = `${st.textArriba ? "self-start" : "self-end"} ${st.textDerecha ? "justify-self-end text-right" : "justify-self-start"}`;
  // Lo que se revela al pasar el puntero: el resumen y la firma.
  const detalle = (
    <>
      {!st.hideExcerpt && (
        <p data-cg-resumen
          className={`mt-3 hidden max-w-xl text-sm leading-relaxed text-[var(--fg-muted)] sm:block md:text-base ${st.excerptClamp} ${st.textDerecha ? "ml-auto" : ""}`}
        >
          {a.excerpt}
        </p>
      )}
      <Meta a={a} locale={locale} className="mt-3 md:mt-4" />
    </>
  );
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
        href={hrefNota(locale, a)}
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
          ratio="aspect-[4/5] h-full sm:aspect-[16/11] xl:aspect-[16/9]"
          priority={priority}
          sizes="(min-width: 1280px) 900px, (min-width: 768px) 60vw, 100vw"
        />
      </Link>
      {/* El texto va en un panel de vidrio esmerilado (fondo translúcido con desenfoque) solo detrás de sí mismo: da lectura al titular sin tapar
          la foto, que antes quedaba lavada bajo un degradado que cubría casi toda la tarjeta. El panel se pega al lado donde está el texto. */}
      {/* Con ratón solo se ve la categoría y el titular; el resumen y el autor aparecen al pasar el puntero (o al enfocar un enlace con el teclado).
          En pantallas táctiles no hay "pasar el puntero": todo queda visible. Para que la tarjeta no cambie de alto al revelar el texto (empujaría
          la portada entera), una copia invisible del texto completo reserva el alto que ya tenía; nadie la ve, la oyen ni la enfocan. */}
      <div
        aria-hidden
        data-cg-panel className={`pointer-events-none invisible m-3 rounded-[var(--radius-lg)] border border-transparent p-4 md:m-5 md:max-w-[40rem] md:p-6 [@media(hover:none)]:hidden ${posicionPanel}`}
      >
        <Kicker a={a} locale={locale} className="text-[var(--accent)]" />
        <div className="lx-display mt-2.5 text-2xl font-semibold leading-[1.12] tracking-tight sm:text-3xl md:mt-3 md:text-[2.75rem]" style={st.title}>
          {a.title}
        </div>
        {detalle}
      </div>
      <div data-cg-panel className={`relative z-[4] m-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)]/70 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.14)] backdrop-blur-[3px] backdrop-saturate-150 max-sm:backdrop-blur-none max-sm:backdrop-saturate-100 [&_.lead-detalle_:is(p,span,time)]:!text-[color-mix(in_srgb,var(--fg)_90%,transparent)] md:m-5 md:max-w-[40rem] md:p-6 ${posicionPanel}`}>
        <Kicker a={a} locale={locale} className="text-[var(--accent)]" />
        <h2
          className="lead-titulo lx-display mt-2.5 text-2xl font-semibold leading-[1.12] tracking-tight sm:text-3xl md:mt-3 md:text-[2.75rem]"
          // El tamaño elegido es el que se ve al pasar el puntero; en reposo el titular va más pequeño (ver .lead-titulo).
          style={{ ...st.title, fontSize: undefined, ["--lead-fs" as string]: st.title.fontSize }}
        >
          <Link href={hrefNota(locale, a)} className="transition-colors hover:text-[var(--link)] after:absolute after:inset-0 after:z-[2]">
            {a.title}
          </Link>
        </h2>
        <div className="lead-detalle">
          <div className="min-h-0 overflow-hidden">{detalle}</div>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------ Portada Esmeralda: apertura «de cine» */
/**
 * La nota principal a toda la foto, con una tarjeta de vidrio (blur) encima. En reposo solo se ve la sección y un titular pequeño, así la foto se aprecia;
 * al pasar el ratón (o el foco) aparecen el resumen, la firma y el botón, y el titular crece. En pantallas táctiles todo está siempre a la vista.
 */
function CineCard({ a, priority, locale }: { a: ArticleListItem; priority?: boolean; locale: Locale }) {
  const st = cardStyle(a, "cine");
  const posicion = `${st.textArriba ? "self-start" : "self-end"} ${st.textDerecha ? "justify-self-end items-end text-right" : "justify-self-start"}`;
  return (
    <article data-bs-root={a.slug} className={`lx-card lead-cine ${priority ? "" : "lx-reveal"} group relative grid h-full grid-cols-[minmax(0,1fr)] [&>*]:col-start-1 [&>*]:row-start-1`}>
      <div className="lx-shine pointer-events-none absolute inset-0 z-[3]" />
      <Link href={hrefNota(locale, a)} className="block" aria-label={a.title} tabIndex={-1} style={st.imageBox}>
        <CardMedia
          src={a.coverImageUrl}
          alt={a.coverImageAlt ?? a.title}
          seed={a.slug}
          label={a.categoryName ?? a.title}
          ratio="aspect-[16/10] h-full xl:aspect-auto xl:min-h-[16rem]"
          priority={priority}
          sizes="(min-width: 1280px) 900px, (min-width: 768px) 60vw, 100vw"
        />
      </Link>
      {/* Velo: oscurece solo la franja donde va el texto y deja limpia el resto de la foto. */}
      <div aria-hidden className={`lead-cine-velo pointer-events-none z-[1] ${st.textArriba ? "lead-cine-velo-arriba" : ""}`} />
      <div
        data-cg-panel
        className={`relative z-[4] m-3 flex w-fit max-w-[40rem] flex-col rounded-[var(--radius-lg)] border border-white/10 bg-[rgba(3,12,8,0.5)] p-4 text-white shadow-[0_12px_36px_rgba(0,0,0,0.35)] backdrop-blur-[3px] backdrop-saturate-150 [--fg-muted:rgba(255,255,255,0.84)] [--fg:#ffffff] max-sm:backdrop-blur-none md:m-5 md:p-6 ${posicion}`}
      >
        {/* Si no caben en un renglón (celular), la fecha baja entera: ni la pastilla ni la fecha se parten. */}
        <span className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${st.textDerecha ? "justify-end" : ""}`}>
          <Kicker a={a} locale={locale} className="whitespace-nowrap rounded-full bg-[var(--accent)] px-3 !text-[0.66rem] !tracking-[0.18em] text-[var(--accent-fg,#0b1a12)] shadow-[0_6px_18px_-6px_rgba(0,0,0,0.6)]" />
          {a.publishedAt && (
            <>
              <span aria-hidden className="h-px w-7 bg-white/45 max-sm:hidden" />
              <time dateTime={a.publishedAt.toISOString()} className="lx-ui whitespace-nowrap text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/85">
                {formatDate(a.publishedAt, INTL_LOCALE[locale])}
              </time>
            </>
          )}
        </span>
        <h2
          className="lead-titulo lx-display mt-3.5 font-semibold tracking-tight [text-shadow:0_2px_18px_rgba(0,0,0,0.55)] md:mt-4"
          style={{ ...st.title, fontSize: undefined, color: st.title.color ?? "#ffffff", ["--lead-fs" as string]: st.title.fontSize }}
        >
          <Link href={hrefNota(locale, a)} className="decoration-[var(--accent)] decoration-2 underline-offset-[6px] after:absolute after:inset-0 after:z-[2] group-hover:underline">
            {a.title}
          </Link>
        </h2>
        {/* Con ratón, en reposo solo se ve la sección y el titular; el resumen y la firma aparecen al pasar el puntero (en pantallas táctiles, siempre). */}
        <div className="lead-detalle">
          <div className="min-h-0 overflow-hidden">
          {!st.hideExcerpt && (
            <p data-cg-resumen className={`mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-white/85 max-sm:line-clamp-3 md:text-base ${st.excerptClamp} ${st.textDerecha ? "ml-auto" : ""}`}>
              {a.excerpt}
            </p>
          )}
          <span className={`mt-4 flex items-center gap-4 md:mt-5 ${st.textDerecha ? "flex-row-reverse" : ""}`}>
            {/* El botón es un adorno: toda la tarjeta ya es el enlace del titular. */}
            <span aria-hidden className="inline-flex items-center gap-2.5 rounded-full border border-[var(--accent)] px-5 py-2.5 text-[0.95rem] font-semibold text-white transition-colors duration-300 group-hover:bg-[var(--accent)] group-hover:text-[var(--accent-fg,#0b1a12)]">
              {locale === "en" ? "Read full story" : "Leer nota completa"}
              <span className="transition-transform duration-500 group-hover:translate-x-1">→</span>
            </span>
            {a.authorName && (
              <span className="lx-ui min-w-0 text-[0.8rem] leading-tight text-white/85">
                <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/60">{locale === "en" ? "By" : "Por"}</span>
                <span className="block truncate font-semibold text-white">{a.authorName}</span>
              </span>
            )}
          </span>
          </div>
        </div>
      </div>
    </article>
  );
}

/* -------------------- Portada Esmeralda: destacadas bajo la principal */
/** Tarjeta apaisada: la foto a la izquierda y, al lado, sección, titular y firma. Van de a dos bajo la nota principal. */
function DestacadaCard({ a, locale }: { a: ArticleListItem; locale: Locale }) {
  const st = cardStyle(a, "destacada");
  return (
    <article data-bs-root={a.slug} className="lx-card lx-reveal group flex h-full items-stretch">
      <div className="lx-shine pointer-events-none absolute inset-0 z-[3]" />
      {!st.hideMedia && (
        <Link href={hrefNota(locale, a)} className="relative block w-[38%] max-w-[13rem] shrink-0" aria-hidden tabIndex={-1}>
          <CardMedia src={a.coverImageUrl} alt="" seed={a.slug} label={a.categoryName ?? a.title} ratio="h-full min-h-[7.5rem]" sizes="(min-width: 640px) 210px, 38vw" />
        </Link>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-4 sm:p-5">
        <Kicker a={a} locale={locale} className="!text-[0.66rem] text-[var(--accent)]" />
        <h3 className="lx-display line-clamp-4 text-lg font-semibold leading-snug" style={st.title}>
          <Link href={hrefNota(locale, a)} className="transition-colors hover:text-[var(--link)] after:absolute after:inset-0 after:z-[2]">
            {a.title}
          </Link>
        </h3>
        {/* Una sola línea: la firma se corta con puntos suspensivos antes que partir la fecha en dos renglones. */}
        <p className="mt-auto truncate pt-2 text-xs text-[var(--fg-muted)]">
          {a.publishedAt ? formatDate(a.publishedAt, INTL_LOCALE[locale]) : ""}
          {a.authorName && ` · ${a.authorName}`}
        </p>
      </div>
    </article>
  );
}

/* ----------------------------- Portada Esmeralda: lista «Lo último» */
/** Renglón de la lista: número, sección, titular y fecha, con una miniatura a la derecha. El número se enciende al pasar el puntero. */
function UltimoCard({ a, index, locale }: { a: ArticleListItem; index?: number; locale: Locale }) {
  const st = cardStyle(a, "ultimo");
  return (
    <article data-bs-root={a.slug} className="lx-reveal group relative flex items-start gap-3.5 py-4 sm:gap-4">
      {typeof index === "number" && (
        <span aria-hidden className="lx-display w-8 shrink-0 text-[1.7rem] font-semibold leading-none text-[color-mix(in_srgb,var(--accent)_55%,transparent)] transition-colors duration-300 [font-variant-numeric:lining-nums] group-hover:text-[var(--accent)]">
          {String(index + 1).padStart(2, "0")}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <Kicker a={a} locale={locale} className="!text-[0.64rem] text-[var(--accent)]" />
        <h3 className="lx-display mt-1 line-clamp-3 text-[1.0625rem] font-medium leading-snug" style={st.title}>
          <Link href={hrefNota(locale, a)} className="transition-colors hover:text-[var(--link)] after:absolute after:inset-0 after:z-[2]">
            {a.title}
          </Link>
        </h3>
        <Meta a={a} locale={locale} className="mt-1.5" compact />
      </div>
      {!st.hideMedia && (
        <span className="lx-media block w-[5.5rem] shrink-0 overflow-hidden rounded-[var(--radius)] ring-1 ring-[var(--border)] sm:w-24">
          <CardMedia src={a.coverImageUrl} alt="" seed={a.slug} label={a.categoryName ?? a.title} ratio="aspect-[4/3]" sizes="96px" />
        </span>
      )}
    </article>
  );
}

/* ------------------- Portada Esmeralda: tres notas bajo la apertura (mosaico) */
/** Foto a toda la tarjeta con el velo oscuro abajo: sección en pastilla, titular y una flecha circular. */
function MosaicoCard({ a, locale }: { a: ArticleListItem; locale: Locale }) {
  const st = cardStyle(a, "mosaico");
  return (
    <article data-bs-root={a.slug} className="lx-card lx-reveal group relative grid h-full grid-cols-[minmax(0,1fr)] overflow-hidden [&>*]:col-start-1 [&>*]:row-start-1">
      <div className="lx-shine pointer-events-none absolute inset-0 z-[3]" />
      <Link href={hrefNota(locale, a)} className="block" aria-label={a.title} tabIndex={-1} style={st.imageBox}>
        <CardMedia src={a.coverImageUrl} alt={a.coverImageAlt ?? a.title} seed={a.slug} label={a.categoryName ?? a.title} ratio="aspect-[16/9] h-full" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
      </Link>
      <div aria-hidden className="pointer-events-none z-[1] bg-gradient-to-t from-[rgba(2,22,20,0.94)] via-[rgba(2,22,20,0.42)] to-transparent" />
      <div className="relative z-[4] flex items-end justify-between gap-3 self-end p-4 text-white sm:p-5">
        <div className="flex min-w-0 flex-col items-start gap-2">
          <Kicker a={a} locale={locale} className="whitespace-nowrap rounded-full bg-[var(--accent)] px-3 !text-[0.64rem] !tracking-[0.16em] text-[var(--accent-fg,#0b1a12)]" />
          <h3 className="lx-display line-clamp-3 text-balance font-semibold leading-tight [text-shadow:0_2px_14px_rgba(0,0,0,0.5)]" style={{ ...st.title, color: st.title.color ?? "#ffffff" }}>
            <Link href={hrefNota(locale, a)} className="after:absolute after:inset-0 after:z-[2]">
              {a.title}
            </Link>
          </h3>
        </div>
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full border border-white/70 text-lg transition-all duration-500 group-hover:translate-x-1 group-hover:border-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-[var(--accent-fg,#0b1a12)]">
          →
        </span>
      </div>
    </article>
  );
}

/* ------------------------------------ Portada Esmeralda: «Lo más leído» */
/** Renglón compacto: número dorado, titular y miniatura. */
function LeidoCard({ a, index, locale }: { a: ArticleListItem; index?: number; locale: Locale }) {
  const st = cardStyle(a, "leido");
  return (
    <article data-bs-root={a.slug} className="group relative flex items-center gap-3 px-4 py-2">
      {typeof index === "number" && (
        <span aria-hidden className="lx-display w-8 shrink-0 text-[1.5rem] font-semibold leading-none text-[var(--accent)] [font-variant-numeric:lining-nums]">
          {String(index + 1).padStart(2, "0")}
        </span>
      )}
      <h3 className="lx-ui line-clamp-2 min-w-0 flex-1 font-medium leading-snug" style={{ ...st.title, fontSize: "0.88rem" }}>
        <Link href={hrefNota(locale, a)} className="transition-colors hover:text-[var(--link)] after:absolute after:inset-0 after:z-[2]">
          {a.title}
        </Link>
      </h3>
      <span className="lx-media block w-16 shrink-0 overflow-hidden rounded-[var(--radius)] ring-1 ring-[var(--border)] sm:w-[4.5rem]">
        <CardMedia src={a.coverImageUrl} alt="" seed={a.slug} label={a.categoryName ?? a.title} ratio="aspect-[4/3]" sizes="72px" />
      </span>
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
          href={hrefNota(locale, a)}
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
        <Kicker a={a} locale={locale} className={`text-[var(--accent)] ${compact ? "max-sm:!text-[0.66rem] max-sm:!tracking-[0.12em] max-sm:leading-snug" : ""}`} />
        <h3 className={`lx-display text-xl font-semibold leading-snug ${compact ? "max-sm:!text-[length:var(--cg-t-px,calc(0.95rem*var(--cg-t-esc,1)))] max-sm:!leading-[1.25]" : ""}`} style={st.title}>
          <Link href={hrefNota(locale, a)} className="transition-colors hover:text-[var(--link)] after:absolute after:inset-0 after:z-[2]">
            {a.title}
          </Link>
        </h3>
        {!st.hideExcerpt && (
          <p data-cg-resumen className={`text-sm leading-relaxed text-[var(--fg-muted)] ${st.excerptClamp} ${compact ? "max-sm:hidden" : ""}`}>
            {a.excerpt}
          </p>
        )}
        <Meta a={a} locale={locale} className="mt-auto pt-3 max-sm:pt-1.5" compact={compact} />
      </div>
    </article>
  );
}

/* ------------------------------------------------- Portada: columna lateral */
function RailCard({ a, index, locale, soloTexto = false }: { a: ArticleListItem; index?: number; locale: Locale; soloTexto?: boolean }) {
  const st = cardStyle(a, "rail");
  // Sin medidas exactas, el porcentaje del panel encoge la miniatura (140 px es su ancho normal).
  const fijo = estiloFijo(a.homeStyle);
  const pct = fijo?.imageScale && fijo.imageScale !== 100 ? Math.round((140 * fijo.imageScale) / 100) : undefined;
  const lado = { w: fijo?.imageWidth ?? fijo?.imageHeight ?? pct, h: fijo?.imageHeight ?? fijo?.imageWidth ?? pct };
  const medidasMiniatura: React.CSSProperties | undefined = lado.w && lado.h ? { width: `${lado.w}px`, height: `${lado.h}px` } : undefined;
  return (
    <article data-bs-root={a.slug} className={`lx-reveal group flex gap-3 border-b border-[var(--border)] pb-4 last:border-0 sm:gap-4 ${soloTexto ? "xl:pb-4" : ""}`}>
      {typeof index === "number" && (
        <span className={`lx-display w-6 shrink-0 text-xl font-semibold text-[var(--accent)] opacity-90 [font-variant-numeric:lining-nums] sm:w-8 sm:text-2xl ${soloTexto ? "xl:w-7 xl:pt-0.5 xl:text-lg xl:opacity-70" : ""}`}>
          {String(index + 1).padStart(2, "0")}
        </span>
      )}
      <div className="min-w-0 flex-1 leading-snug">
        <Kicker a={a} locale={locale} className="text-xs text-[var(--fg-muted)]" />
        {/* En la columna ancha, todos los titulares a 17 px (también los que traen tamaño del panel): la lista se lee pareja y la foto principal,
            que iguala su alto, no queda casi cuadrada. */}
        <h3 className={`lx-display mt-1.5 text-lg font-medium leading-snug ${soloTexto ? "xl:!text-[1.0625rem] xl:!leading-snug" : ""}`} style={st.title}>
          <Link href={hrefNota(locale, a)} className="lx-link">
            {a.title}
          </Link>
        </h3>
        <Meta a={a} locale={locale} className="mt-2" />
      </div>
      {/* La miniatura también va en el celular: sin ella «Lo último» era una lista de texto plano. */}
      {!st.hideMedia && (
      <Link href={hrefNota(locale, a)} className={`block max-w-[46%] shrink-0 self-start ${soloTexto ? "xl:hidden" : ""}`} aria-hidden tabIndex={-1}>
        {/* La miniatura es apaisada (4:3, más grande en el celular); con medidas exactas en el panel toma esas (si solo hay una, es el lado del cuadrado) y el texto, al lado, se acomoda. */}
        <span className={`lx-media block overflow-hidden rounded-[var(--radius)] ${medidasMiniatura ? "max-w-full" : "aspect-[4/3] w-[8.75rem] sm:w-28"}`} style={a.homeStyle?.pantallas ? ({ ["--cg-mini-foto" as string]: "1" } as React.CSSProperties) : medidasMiniatura}>
          <CardMedia
            src={a.coverImageUrl}
            alt=""
            seed={a.slug}
            label={a.categoryName ?? a.title}
            ratio={medidasMiniatura ? "h-full" : "aspect-[4/3]"}
            sizes="140px"
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
        href={hrefNota(locale, a)}
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
          <Link href={hrefNota(locale, a)} className="transition-colors hover:text-[var(--accent)] after:absolute after:inset-0 after:z-[2]">
            {a.title}
          </Link>
        </h3>
        {!st.hideExcerpt && (
          <p data-cg-resumen className={`text-sm leading-relaxed text-[var(--fg-muted)] ${st.excerptClamp}`}>
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
      <Link href={hrefNota(locale, a)} className="relative block px-3 pt-3">
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
          <Link href={hrefNota(locale, a)} className="transition-colors hover:text-[var(--accent)] after:absolute after:inset-0 after:z-[2]">
            {a.title}
          </Link>
        </h3>
        {!st.hideExcerpt && (
          <p data-cg-resumen className={`text-sm font-light leading-relaxed text-[var(--fg-muted)] ${st.excerptClamp}`}>
            {a.excerpt}
          </p>
        )}
        <Meta a={a} locale={locale} className="mt-auto pt-3" />
      </div>
    </article>
  );
}
