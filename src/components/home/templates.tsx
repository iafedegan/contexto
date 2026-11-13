"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { BarChart3, BookOpen, CloudSun, ShieldCheck, Wallet } from "lucide-react";
import { HomeCard } from "@/components/home/home-card";
import { ArticleCard } from "@/components/article-card";
import { BreveCarousel } from "@/components/home/breve-carousel";
import { EditableCard, type BuilderProps } from "@/components/home/editable-card";
import { NewsletterForm } from "@/components/newsletter-form";
import { CoverArt } from "@/components/cover-art";
import { estiloFijo, homeStyleTitleCss } from "@/lib/home-style";
import type { ArticleListItem } from "@/lib/content";
import { BREVE_COLS, RIVER_COLS, anchaEnCelular, type HomeTemplateId } from "@/lib/home-layout";
import type { HomeLayoutConfig } from "@/db/schema";
import { cn, formatDate } from "@/lib/utils";
import { VARIABLES_BLANCO } from "@/lib/portada-franja-blanca";
import { DEFAULT_LOCALE, INTL_LOCALE, categoryLabel, localePath, t, type Locale } from "@/lib/i18n";
import { hrefNota } from "@/lib/ruta-nota";
import { ImagenSitio } from "@/components/ui/imagen-sitio";

/**
 * Estos cuatro usan Framer Motion (~160 KB) para sus animaciones. Solo UNA
 * plantilla está activa a la vez, pero al importarse arriba de forma
 * estática los seis componentes de este archivo terminaban en el mismo
 * paquete — Framer Motion se descargaba y ejecutaba en TODAS las portadas,
 * aunque la plantilla activa (p. ej. Clásico o Gremial) no la necesite.
 * `next/dynamic` los separa en su propio fragmento, cargado solo cuando la
 * plantilla que realmente los usa se renderiza.
 */
const HeroCarousel = dynamic(() => import("@/components/home/hero-carousel").then((m) => m.HeroCarousel));
// Tarjeta de mosaico, cargada solo cuando la plantilla la usa.
const TileCard = dynamic(() => import("@/components/home/tile-card").then((m) => m.TileCard));
// Tarjeta de periódico, cargada solo cuando la plantilla la usa.
const BroadsheetCard = dynamic(() => import("@/components/home/broadsheet-card").then((m) => m.BroadsheetCard));
// Mosaico asimétrico, cargado solo cuando la plantilla lo usa.
const BentoTile = dynamic(() => import("@/components/home/bento-tile").then((m) => m.BentoTile));

// Notas repartidas por zona de la portada: principal, segunda, columna y río.
type Slots = {
  lead?: ArticleListItem;
  second?: ArticleListItem;
  rail: ArticleListItem[];
  river: ArticleListItem[];
};

/** Ancho de la columna de la nota principal frente a «Lo último» (lo elige el editor en /panel/portada). Clases completas, para que Tailwind las vea. */
const ANCHO_PRINCIPAL: Record<string, string> = {
  normal: "xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]",
  ancha: "xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]",
  muyAncha: "xl:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)]",
};

// Propiedades de una plantilla: las zonas, el diseño, el idioma y los indicadores.
type TemplateProps = Slots &
  BuilderProps & {
    layout: Required<HomeLayoutConfig>;
    /** false = dentro del editor de portada (sin navegar ni autoplay). */
    interactive?: boolean;
    /** Idioma de la interfaz (rótulos y fechas). */
    locale?: Locale;
    /** Bloque que va justo debajo de la nota principal (en el celular, la columna del Dr. Lafaurie). Compacto y Vanguardia no lo usan: es una cuadrícula. */
    trasPrincipal?: React.ReactNode;
    /** Solo Esmeralda: carruseles que van en el hueco bajo las dos destacadas (de a dos, compactos). */
    hueco?: React.ReactNode[];
    /** Solo Esmeralda: hay columna destacada arriba de «Lo último» (decide cuántas notas van en la lista y cuántas bajo la principal). */
    conColumna?: boolean;
    /** Barra lateral del sitio (solo Esmeralda): va junto a «Lo más reciente», no junto a la apertura, para que arriba haya dos columnas y no tres. */
    lateral?: React.ReactNode;
    /** Solo Esmeralda: las notas más leídas (las tres primeras van en la columna derecha de la apertura). */
    masLeidas?: ArticleListItem[];
    /**
     * Indicadores ya formateados para la cabecera de Gremial (el resto de
     * plantillas lo ignora). Van pre-formateados desde el servidor: este
     * archivo es "use client" y `@/lib/market-data` es `server-only`, así
     * que no puede importar su formateador ni su tipo.
     */
    market?: { key: "trm" | "cattle"; label: string; value: string }[];
  };

/**
 * Clásico → "Broadsheet": tipografía como protagonista, papel cálido con
 * grano, numeración editorial real. Sin fotografía en la lista "En breve" —
 * a propósito, contraste de texto puro frente a las otras 3 plantillas.
 */
export function ClasicoTemplate({
  lead,
  second,
  rail,
  river,
  layout,
  interactive = true,
  trasPrincipal,
  locale = DEFAULT_LOCALE,
  builderSelected,
  builderOverIndex,
  builderDragProps,
  builderHasStyle,
}: TemplateProps) {
  if (!lead) return null;
  const horizontal = layout.breveDirection === "horizontal";
  const all = [lead, second, ...rail, ...river].filter((a): a is ArticleListItem => Boolean(a));
  // Posición de una nota dentro de la lista completa.
  const indexOf = (a: ArticleListItem) => all.findIndex((x) => x.slug === a.slug);
  // Envuelve una nota con su marca de edición para el editor.
  const wrap = (a: ArticleListItem, node: React.ReactNode, className?: string) => {
    const i = indexOf(a);
    return (
      <EditableCard key={a.slug} index={i} builderSelected={builderSelected} builderOverIndex={builderOverIndex} builderDragProps={builderDragProps} hasStyle={builderHasStyle?.(i)} className={className}>
        {node}
      </EditableCard>
    );
  };

  const leadBlock = (
    <div className="flex flex-col gap-8">
      {wrap(lead, <BroadsheetCard a={lead} locale={locale} index={indexOf(lead)} variant="lead" priority interactive={interactive} />)}
      {second && wrap(second, <BroadsheetCard a={second} locale={locale} index={indexOf(second)} variant="feature" interactive={interactive} />)}
      {trasPrincipal}
    </div>
  );

  return (
    <div className="grain tpl-broadsheet px-5 py-8 sm:px-10 sm:py-12">
      {horizontal ? (
        <>
          {leadBlock}
          {rail.length > 0 && (
            <section className="mt-10 border-t-2 border-[var(--brand-ink)] pt-6">
              <h2 className="kicker mb-5">{t(locale, "home.brief")}</h2>
              <div className={cn("grid gap-x-10 gap-y-2 divide-y divide-[var(--bw-rule,var(--rule))] sm:divide-y-0", BREVE_COLS[layout.breveColumns] ?? BREVE_COLS[2])}>
                {rail.map((a) => wrap(a, <BroadsheetCard a={a} locale={locale} index={indexOf(a)} variant="compact" interactive={interactive} />))}
              </div>
            </section>
          )}
        </>
      ) : (
        <section className="grid grid-cols-1 gap-x-10 gap-y-8 xl:grid-cols-[minmax(0,1.8fr)_1px_minmax(0,1fr)]">
          {leadBlock}
          <div className="hidden bg-[var(--bw-rule,var(--rule))] xl:block" aria-hidden />
          <aside className="flex flex-col divide-y divide-[var(--bw-rule,var(--rule))]">
            <h2 className="kicker border-b-2 border-[var(--brand-ink)] pb-2">{t(locale, "home.brief")}</h2>
            {rail.map((a) => wrap(a, <BroadsheetCard a={a} locale={locale} index={indexOf(a)} variant="compact" interactive={interactive} />))}
          </aside>
        </section>
      )}

      {river.length > 0 && (
        <section className="mt-12 border-t-2 border-[var(--brand-ink)] pt-8">
          <h2 className="kicker mb-6">{t(locale, "home.recent")}</h2>
          <div className={cn("grid gap-x-10 gap-y-10", RIVER_COLS[layout.riverColumns] ?? RIVER_COLS[3])}>
            {river.map((a) =>
              wrap(
                a,
                <BroadsheetCard a={a} locale={locale} index={indexOf(a)} variant="feature" interactive={interactive} />,
                estiloFijo(a.homeStyle)?.span === 2 ? "sm:col-span-2" : undefined,
              ),
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Revista → "Cinematográfica": hero a sangre completa con efecto Ken Burns +
 * banda de titular sólida montada sobre la foto, carrusel de arrastre en "En
 * breve", río con tarjetas que se alzan.
 */
export function RevistaTemplate({
  lead,
  second,
  rail,
  river,
  layout,
  interactive = true,
  trasPrincipal,
  locale = DEFAULT_LOCALE,
  builderSelected,
  builderOverIndex,
  builderDragProps,
  builderHasStyle,
}: TemplateProps) {
  if (!lead) return null;
  const heroItems = [lead, second, ...rail].filter((a): a is ArticleListItem => Boolean(a)).slice(0, 4);

  return (
    <>
      <EditableCard index={0} builderSelected={builderSelected} builderOverIndex={builderOverIndex} builderDragProps={builderDragProps} hasStyle={builderHasStyle?.(0)}>
        <HeroCarousel locale={locale} items={heroItems} interactive={interactive} />
      </EditableCard>
      {trasPrincipal && <div className="mt-8">{trasPrincipal}</div>}

      {rail.length > 0 && (
        <section className="mt-12 border-t-2 border-[var(--rule-strong)] pt-6">
          <h2 className="kicker mb-4">{t(locale, "home.brief")}</h2>
          <BreveCarousel locale={locale}
            items={rail}
            columns={layout.breveColumns}
            interactive={interactive}
            indexOffset={2}
            builderSelected={builderSelected}
            builderOverIndex={builderOverIndex}
            builderDragProps={builderDragProps}
            builderHasStyle={builderHasStyle}
          />
        </section>
      )}

      {river.length > 0 && (
        <section className="mt-10 border-t-2 border-[var(--rule-strong)] pt-5">
          <h2 className="kicker mb-6">{t(locale, "home.recent")}</h2>
          <div className={cn("grid gap-x-6 gap-y-10", RIVER_COLS[layout.riverColumns] ?? RIVER_COLS[3])}>
            {river.map((a, i) => (
              <EditableCard
                key={a.slug}
                index={6 + i}
                builderSelected={builderSelected}
                builderOverIndex={builderOverIndex}
                builderDragProps={builderDragProps}
                hasStyle={builderHasStyle?.(6 + i)}
                className={estiloFijo(a.homeStyle)?.span === 2 ? "sm:col-span-2" : undefined}
              >
                <HomeCard a={a} locale={locale} variant="feature" hover="zoom" interactive={interactive} />
              </EditableCard>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/**
 * Compacto → "Dashboard": barra de estado tipo panel de datos, cuadrícula
 * densa con chips de color por categoría y metadatos en monoespaciada.
 */
export function CompactoTemplate({
  lead,
  second,
  rail,
  river,
  layout,
  interactive = true,
  locale = DEFAULT_LOCALE,
  builderSelected,
  builderOverIndex,
  builderDragProps,
  builderHasStyle,
}: TemplateProps) {
  if (!lead) return null;
  const rest = [second, ...rail, ...river].filter((a): a is ArticleListItem => Boolean(a));
  const cols = Math.max(layout.breveColumns, 3);
  const colsClass = BREVE_COLS[cols] ?? BREVE_COLS[4];
  const total = rest.length + 1;
  const latest = [lead, ...rest].reduce<Date | null>((max, a) => {
    if (!a.publishedAt) return max;
    const d = new Date(a.publishedAt);
    return !max || d > max ? d : max;
  }, null);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rule)] pb-2 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--ink-faint)]">
        <span className="tabular-nums">{total} notas en pantalla</span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" style={{ boxShadow: "0 0 0 3px color-mix(in srgb, var(--brand) 20%, transparent)" }} aria-hidden />
          actualizado {latest ? formatDate(latest) : "—"}
        </span>
      </div>
      <div className={cn("grid gap-3", colsClass)}>
        <EditableCard
          index={0}
          builderSelected={builderSelected}
          builderOverIndex={builderOverIndex}
          builderDragProps={builderDragProps}
          hasStyle={builderHasStyle?.(0)}
          className="col-span-2 row-span-2"
        >
          <TileCard a={lead} index={0} size="lg" priority interactive={interactive} className="h-full" />
        </EditableCard>
        {rest.map((a, i) => (
          <EditableCard
            key={a.slug}
            index={i + 1}
            builderSelected={builderSelected}
            builderOverIndex={builderOverIndex}
            builderDragProps={builderDragProps}
            hasStyle={builderHasStyle?.(i + 1)}
            className={estiloFijo(a.homeStyle)?.span === 2 ? "col-span-2" : undefined}
          >
            <TileCard a={a} locale={locale} index={i + 1} size="md" interactive={interactive} className="h-full" />
          </EditableCard>
        ))}
      </div>
    </div>
  );
}

/**
 * Vanguardia: cuadrícula "bento" oscura, asimétrica, con orbes de gradiente
 * de ambiente, esquinas muy redondeadas y fichas que revelan resumen y brillo
 * de marca al pasar el mouse. El tamaño de cada ficha sigue siendo jerarquía
 * editorial (la principal es la más grande), no decoración al azar.
 */
export function VanguardiaTemplate({
  lead,
  second,
  rail,
  river,
  interactive = true,
  builderSelected,
  builderOverIndex,
  builderDragProps,
  builderHasStyle,
}: TemplateProps) {
  if (!lead) return null;
  const rest = [...rail, ...river];

  return (
    <div className="grain relative overflow-hidden rounded-[2rem] bg-[#0a0b0d] p-3 sm:p-5">
      <div
        aria-hidden
        className="mesh-orb pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full opacity-30 blur-[100px]"
        style={{ background: "var(--brand, #d81e05)" }}
      />
      <div
        aria-hidden
        className="mesh-orb delay pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full opacity-25 blur-[110px]"
        style={{ background: "#8b5cf6" }}
      />

      <div className="relative grid auto-rows-[minmax(9.5rem,auto)] grid-cols-2 gap-3 sm:auto-rows-[minmax(11rem,auto)] sm:grid-cols-6 sm:gap-4">
        <EditableCard
          index={0}
          builderSelected={builderSelected}
          builderOverIndex={builderOverIndex}
          builderDragProps={builderDragProps}
          hasStyle={builderHasStyle?.(0)}
          className="col-span-2 row-span-2 sm:col-span-4"
        >
          <BentoTile a={lead} size="xl" priority interactive={interactive} className="h-full" />
        </EditableCard>
        {second && (
          <EditableCard
            index={1}
            builderSelected={builderSelected}
            builderOverIndex={builderOverIndex}
            builderDragProps={builderDragProps}
            hasStyle={builderHasStyle?.(1)}
            className="col-span-2 row-span-2"
          >
            <BentoTile a={second} size="lg" interactive={interactive} className="h-full" />
          </EditableCard>
        )}
        {rest.map((a, i) => (
          <EditableCard
            key={a.slug}
            index={2 + i}
            builderSelected={builderSelected}
            builderOverIndex={builderOverIndex}
            builderDragProps={builderDragProps}
            hasStyle={builderHasStyle?.(2 + i)}
            className={estiloFijo(a.homeStyle)?.span === 2 ? "col-span-2 sm:col-span-4" : "col-span-1 sm:col-span-2"}
          >
            <BentoTile
              a={a}
              size="md"
              interactive={interactive}
              tilt={i % 4 === 0 ? "left" : i % 4 === 2 ? "right" : undefined}
              className="h-full"
            />
          </EditableCard>
        ))}
      </div>
    </div>
  );
}

/** Un solo lugar donde mapear `templateId` -> componente. Añadir una
 * plantilla nueva es agregar una entrada aquí. */

/**
 * Esmeralda Real → la portada "deluxe" del sistema de plantillas de ruta:
 * apertura a sangre con degradado y lámina de oro, columna «Lo último»
 * numerada y cuadrícula de tarjetas con barrido de luz.
 */
export function EsmeraldaTemplate({
  lead,
  second,
  rail,
  river,
  layout,
  interactive = true,
  trasPrincipal,
  hueco,
  lateral,
  masLeidas,
  locale = DEFAULT_LOCALE,
  builderSelected,
  builderOverIndex,
  builderDragProps,
  builderHasStyle,
}: TemplateProps) {
  if (!lead) return lateral ? <>{lateral}</> : null;
  const all = [lead, second, ...rail, ...river].filter((a): a is ArticleListItem => Boolean(a));
  // Posición de una nota dentro de la lista completa.
  const indexOf = (a: ArticleListItem) => all.findIndex((x) => x.slug === a.slug);
  // Envuelve una nota con su marca de edición para el editor.
  const wrap = (a: ArticleListItem, node: React.ReactNode, className?: string) => (
    <EditableCard
      key={a.slug}
      index={indexOf(a)}
      builderSelected={builderSelected}
      builderOverIndex={builderOverIndex}
      builderDragProps={builderDragProps}
      hasStyle={builderHasStyle?.(indexOf(a))}
      className={className}
    >
      {node}
    </EditableCard>
  );
  // Apertura: la principal a la izquierda; a la derecha, la columna destacada y «Lo más leído». Debajo, tres notas en mosaico a todo el ancho.
  const base = [second, ...rail, ...river].filter((a): a is ArticleListItem => Boolean(a));
  const mosaico = base.slice(0, 3);
  const colsRio = Number(layout.riverColumns) || 3;
  const restoRio = base.slice(mosaico.length);
  // La cuadrícula de abajo se recorta a filas completas.
  const rio = restoRio.length > colsRio ? restoRio.slice(0, restoRio.length - (restoRio.length % colsRio)) : restoRio;
  const leidas = (masLeidas ?? []).slice(0, 3);

  return (
    <div className="flex flex-col gap-12 sm:gap-20">
      <div className="flex flex-col gap-5 sm:gap-6">
      <section className={`grid grid-cols-1 gap-7 sm:gap-8 xl:items-stretch xl:gap-5 ${ANCHO_PRINCIPAL[layout.anchoPrincipal] ?? ANCHO_PRINCIPAL.ancha}`}>
        {/* En pantallas anchas es la columna izquierda (la principal crece hasta igualar a la derecha; debajo, las destacadas). En el celular
            la columna se «disuelve» (contents) para poder ordenar: principal, columna derecha y, al final, las destacadas. */}
        <div className="flex min-w-0 flex-col gap-5 max-xl:contents xl:self-stretch">
          <div className="min-w-0 max-xl:order-1 xl:flex-1 [&>*]:h-full">{wrap(lead, <ArticleCard a={lead} locale={locale} variant="cine" priority={interactive} />)}</div>
        </div>
        <aside className="flex min-w-0 flex-col gap-4 max-xl:order-2">
          {/* La columna destacada (opinión) va primero en la columna derecha, antes de «Lo último», en el celular y en el computador. */}
          {trasPrincipal && <div className="hidden has-[section]:block">{trasPrincipal}</div>}
          {leidas.length > 0 && (
            <div className="cg-leidas flex flex-1 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg-2)]">
              <header className="border-b border-[var(--border)] px-4 py-2.5">
                <h2 className="lx-kicker flex items-center gap-2.5 !text-[0.85rem] text-[var(--accent)]">
                  <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M4 20V11h4v9zm6 0V4h4v16zm6 0v-6h4v6z" /></svg>
                  {locale === "en" ? "Most read" : "Lo más leído"}
                </h2>
              </header>
              <div className="flex flex-1 flex-col justify-between divide-y divide-[var(--border)]">
                {leidas.map((a, i) => wrap(a, <ArticleCard a={a} locale={locale} variant="leido" index={i} />))}
              </div>
            </div>
          )}
        </aside>
      </section>

      {mosaico.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
          {mosaico.map((a) => wrap(a, <ArticleCard a={a} locale={locale} variant="mosaico" />))}
        </div>
      )}
      {hueco && hueco.length > 0 && (
        // Los carruseles del hueco miden todos lo mismo (ver `.cg-hueco` en globals.css), así van parejos aunque vengan de fuentes distintas.
        <div className={`cg-hueco grid min-w-0 grid-cols-1 content-start items-start gap-4 sm:gap-5 ${hueco.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {hueco.map((n, i) => <div key={i} className="min-w-0">{n}</div>)}
        </div>
      )}
      </div>


      {/* La rejilla de abajo usa las MISMAS columnas que la apertura: la barra lateral cae justo bajo «Lo último», con su mismo filete. */}
      {/* «Lo más reciente» + «Para leer»: franja de fondo BLANCO a todo el ancho; las franjas por sección que siguen alternan (verde, blanco…). */}
      <div className="lx-fullbleed -mb-8 py-10 sm:-mb-12 sm:py-14" style={VARIABLES_BLANCO} data-fondo="blanco" data-region="franja-reciente">
      <div className="shell">
      <div className={lateral ? `grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_19rem] ${ANCHO_PRINCIPAL[layout.anchoPrincipal] ?? ANCHO_PRINCIPAL.ancha}` : ""}>
      {rio.length > 0 && (
        <section className="min-w-0">
          <div className="border-b border-[var(--border)] pb-4">
            <p className="lx-kicker text-[var(--accent)]">{t(locale, "home.current")}</p>
            <h2 className="lx-display mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
              {t(locale, "home.recent")}
            </h2>
          </div>
          {/* Celular: de a dos por fila, con la primera a todo el ancho como nota destacada; desde sm, la rejilla de siempre. */}
          <div className={cn("mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-x-7 sm:gap-y-10", RIVER_COLS[layout.riverColumns] ?? RIVER_COLS[3])}>
            {rio.map((a, i) => {
              const ancha = anchaEnCelular(i, rio.length);
              return wrap(
                a,
                <ArticleCard a={a} locale={locale} compact={!ancha} />,
                cn(ancha && "max-sm:col-span-2", estiloFijo(a.homeStyle)?.span === 2 && "sm:col-span-2"),
              );
            })}
          </div>
        </section>
      )}
      {lateral && (
        <div className="min-w-0 xl:border-l xl:border-[var(--border)] xl:pl-8">
          {/* Mismo encabezado que «Lo más reciente»: las dos columnas arrancan y cortan a la misma altura. */}
          <div className="mb-6 border-b border-[var(--border)] pb-4 sm:mb-8">
            <p className="lx-kicker text-[var(--accent)]">{locale === "en" ? "Opinion" : "Opinión"}</p>
            <h2 className="lx-display mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{locale === "en" ? "Worth reading" : "Para leer"}</h2>
          </div>
          {lateral}
        </div>
      )}
      </div>
      </div>
      </div>
    </div>
  );
}

/** Color de la etiqueta de categoría en Gremial — cada sección un color fijo,
 * como en el mockup (roja/verde/teal/café), no el acento único del resto de
 * plantillas. */
const GREMIAL_TAG: Record<string, { bg: string; fg: string }> = {
  ganaderia: { bg: "#2f6b3f", fg: "#ffffff" },
  economia: { bg: "#1f6e73", fg: "#ffffff" },
  colombia: { bg: "#7a2530", fg: "#ffffff" },
  "sistemas-pecuarios": { bg: "#8a5a2f", fg: "#ffffff" },
  mundo: { bg: "#3d4f8a", fg: "#ffffff" },
  opinion: { bg: "#5b4a8a", fg: "#ffffff" },
};
// Colores por defecto de la etiqueta de la plantilla gremial.
const GREMIAL_TAG_DEFAULT = { bg: "#c0392b", fg: "#ffffff" };

// Etiqueta de sección de la plantilla gremial.
function GremialTag({ a, locale }: { a: ArticleListItem; locale: Locale }) {
  if (!a.categorySlug) return null;
  const c = GREMIAL_TAG[a.categorySlug] ?? GREMIAL_TAG_DEFAULT;
  return (
    <span
      className="inline-block max-w-full truncate rounded px-2 py-0.5 align-bottom text-[0.72rem] font-bold uppercase tracking-wider"
      style={{ background: c.bg, color: c.fg }}
    >
      {a.categoryName ?? categoryLabel(locale, a.categorySlug, a.categoryName ?? "")}
    </span>
  );
}

/** Igual al patrón `interactive` del resto de plantillas (BroadsheetCard,
 * HomeCard, TileCard…): dentro del editor de portada (`interactive=false`)
 * no debe navegar — un <a> real sacaría al usuario del panel al hacer clic
 * para seleccionar o arrastrar la tarjeta. */
function GremialCardLink({
  a,
  locale,
  interactive,
  className,
  children,
}: {
  a: ArticleListItem;
  locale: Locale;
  interactive: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const Wrapper: React.ElementType = interactive ? Link : "div";
  const wrapperProps = interactive ? { href: hrefNota(locale, a) } : {};
  return (
    <Wrapper {...wrapperProps} className={className}>
      {children}
    </Wrapper>
  );
}

// Miniatura de la plantilla gremial.
function GremialThumb({ a, sizes, priority = false }: { a: ArticleListItem; sizes: string; priority?: boolean }) {
  if (!a.coverImageUrl) return <CoverArt seed={a.slug} label={a.title} className="text-3xl" />;
  return (
    // Miniaturas dentro del editor de portada (sin dominio conocido en build); en el
    // sitio público next/image ya sirve estas mismas URLs en otras plantillas.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={a.coverImageUrl} alt={a.coverImageAlt ?? a.title} sizes={sizes} width={640} height={360} className="size-full object-cover" loading={priority ? "eager" : "lazy"} />
  );
}

/**
 * Gremial — mockup del cliente, reproducido tal cual: apertura a sangre con
 * texto sobre la foto, 3 destacadas en miniatura, cuadrícula de "Últimas
 * noticias" con etiqueta de color por sección, accesos rápidos por sección,
 * "Ganadería sostenible", columnistas con foto y boletín en franja verde.
 * Los 5 accesos ("Para el ganadero") enlazan a secciones existentes; no hay
 * páginas propias de precios/clima todavía, así que dos de ellos comparten
 * destino con la cabecera de indicadores de esta misma portada.
 */
export function GremialTemplate({
  lead,
  second,
  rail,
  river,
  layout,
  interactive = true,
  trasPrincipal,
  locale = DEFAULT_LOCALE,
  market = [],
  builderSelected,
  builderOverIndex,
  builderDragProps,
  builderHasStyle,
}: TemplateProps) {
  if (!lead) return null;
  const all = [lead, second, ...rail, ...river].filter((a): a is ArticleListItem => Boolean(a));
  // Posición de una nota dentro de la lista completa.
  const indexOf = (a: ArticleListItem) => all.findIndex((x) => x.slug === a.slug);
  // Envuelve una nota con su marca de edición para el editor.
  const wrap = (a: ArticleListItem, node: React.ReactNode, className?: string) => (
    <EditableCard
      key={a.slug}
      index={indexOf(a)}
      builderSelected={builderSelected}
      builderOverIndex={builderOverIndex}
      builderDragProps={builderDragProps}
      hasStyle={builderHasStyle?.(indexOf(a))}
      className={className}
    >
      {node}
    </EditableCard>
  );

  const destacadas = [second, ...rail].filter((a): a is ArticleListItem => Boolean(a)).slice(0, 3);
  const usadas = new Set([lead.slug, ...destacadas.map((a) => a.slug)]);
  const restantes = all.filter((a) => !usadas.has(a.slug));
  const noticias = restantes.slice(0, 4);
  const columnistas = restantes.filter((a) => a.categorySlug === "opinion").slice(0, 3);
  const columnistasFinal = columnistas.length > 0 ? columnistas : restantes.slice(4, 7);
  const sostenible = restantes.find((a) => a.categorySlug === "ganaderia" && !noticias.includes(a)) ?? restantes[7];

  const trm = market.find((m) => m.key === "trm");
  const ganado = market.find((m) => m.key === "cattle");
  const indicadoresHref = "#indicadores";

  const herramientas = [
    { icon: Wallet, color: "#7a2530", label: t(locale, "home.tools.prices"), href: indicadoresHref },
    { icon: CloudSun, color: "#2b5f9e", label: t(locale, "home.tools.weather"), href: indicadoresHref },
    { icon: BarChart3, color: "#2f6b3f", label: t(locale, "home.tools.markets"), href: localePath(locale, "/categoria/economia") },
    { icon: ShieldCheck, color: "#8a5a2f", label: t(locale, "home.tools.health"), href: localePath(locale, "/categoria/ganaderia") },
    { icon: BookOpen, color: "#1f6e73", label: t(locale, "home.tools.manual"), href: localePath(locale, "/categoria/sistemas-pecuarios") },
  ];

  return (
    <div className="flex flex-col gap-12">
      {/* Cabecera de indicadores: solo los dos que el sitio realmente mide
          (el mockup también pedía leche y clima, que no existen como fuente
          de datos todavía). */}
      {(trm ?? ganado) && (
        <div id="indicadores" className="-mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[var(--border)] pb-4 text-sm scroll-mt-24">
          {ganado && (
            <span className="font-semibold">
              {ganado.label} <span className="font-bold text-[var(--accent-2)]">{ganado.value}</span>
            </span>
          )}
          {trm && (
            <span className="font-semibold">
              {trm.label} <span className="font-bold text-[var(--accent-2)]">{trm.value}</span>
            </span>
          )}
        </div>
      )}

      {/* Apertura a sangre + 3 destacadas en miniatura */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        {wrap(
          lead,
          /* Foto, degradado y texto comparten UNA celda: la tarjeta mide lo que mida lo
             mayor entre el 16:9 (separador) y el texto. Con alto fijo y el texto anclado
             abajo, un titular largo se salía por arriba y quedaba recortado. */
          <GremialCardLink a={lead} locale={locale} interactive={interactive} className="cg-reveal group relative grid min-h-[21rem] overflow-hidden rounded-[var(--radius-lg)] bg-[#0b0d10] sm:min-h-0 [&>*]:col-start-1 [&>*]:row-start-1">
            <div className="absolute inset-0">
              <GremialThumb a={lead} sizes="(min-width: 1024px) 60vw, 100vw" priority={interactive} />
            </div>
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
            <div aria-hidden className="hidden w-full sm:block sm:aspect-[16/9]" />
            {/* Tarjeta de vidrio: titular pequeño en reposo; al pasar el puntero crece y salen el resumen y el botón. */}
            <div className="cg-vidrio relative m-3 max-w-[46rem] self-end justify-self-start rounded-[var(--radius-lg)] border border-white/10 bg-[rgba(3,12,8,0.5)] p-4 shadow-[0_12px_36px_rgba(0,0,0,0.35)] backdrop-blur-[3px] backdrop-saturate-150 max-sm:backdrop-blur-none sm:m-5 sm:p-6">
              <GremialTag a={lead} locale={locale} />
              <h1 className="lead-titulo lx-display mt-3 font-bold leading-tight text-white" style={{ ...homeStyleTitleCss(lead.homeStyle, 36, 1.25), fontSize: undefined, ["--lead-fs" as string]: homeStyleTitleCss(lead.homeStyle, 36, 1.25).fontSize }}>{lead.title}</h1>
              <div className="lead-detalle">
                <div className="min-h-0 overflow-hidden">
                  <p className="mt-3 hidden max-w-2xl line-clamp-2 text-sm text-white/85 sm:block sm:text-base">{lead.excerpt}</p>
                  <span className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] transition group-hover:opacity-90">
                    {t(locale, "home.readNews")} →
                  </span>
                </div>
              </div>
            </div>
          </GremialCardLink>,
        )}
        <div className="flex flex-col gap-4">
          {destacadas.map((a) =>
            wrap(
              a,
              <GremialCardLink a={a} locale={locale} interactive={interactive} className="group flex gap-3 rounded-[var(--radius)] p-1 transition hover:bg-[var(--surface-2)]">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-[var(--radius)]">
                  <GremialThumb a={a} sizes="80px" />
                </div>
                <div className="min-w-0">
                  <GremialTag a={a} locale={locale} />
                  <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug transition group-hover:text-[var(--accent)]" style={homeStyleTitleCss(a.homeStyle, 14, 1.375)}>
                    {a.title}
                  </p>
                </div>
              </GremialCardLink>,
            ),
          )}
        </div>
      </section>

      {trasPrincipal}

      {/* Últimas noticias */}
      {noticias.length > 0 && (
        <section>
          <div className="flex items-end justify-between border-b border-[var(--border-strong)] pb-3">
            <h2 className="lx-display text-xl font-bold tracking-tight sm:text-2xl">{t(locale, "home.recent")}</h2>
            <Link href={localePath(locale, "/buscar")} className="lx-link text-sm font-semibold text-[var(--accent)]">
              {t(locale, "home.viewAll")} →
            </Link>
          </div>
          <div className={cn("mt-6 grid gap-6", RIVER_COLS[layout.riverColumns] ?? RIVER_COLS[4])}>
            {noticias.map((a) =>
              wrap(
                a,
                <GremialCardLink a={a} locale={locale} interactive={interactive} className="group flex flex-col">
                  <div className="relative aspect-[3/2] overflow-hidden rounded-[var(--radius)]">
                    <GremialThumb a={a} sizes="(min-width: 1024px) 25vw, 50vw" />
                    <div className="absolute left-2 top-2">
                      <GremialTag a={a} locale={locale} />
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 text-[0.95rem] font-semibold leading-snug transition group-hover:text-[var(--accent)]" style={homeStyleTitleCss(a.homeStyle, 15, 1.375)}>
                    {a.title}
                  </p>
                  <p className="mt-1.5 text-xs text-[var(--fg-muted)]">
                    {a.authorName}
                    {a.authorName && a.publishedAt ? " · " : ""}
                    {a.publishedAt && formatDate(a.publishedAt, INTL_LOCALE[locale])}
                  </p>
                </GremialCardLink>,
              ),
            )}
          </div>
        </section>
      )}

      {/* Para el ganadero: accesos rápidos por sección */}
      <section>
        <h2 className="lx-display text-xl font-bold tracking-tight text-[var(--accent-2)] sm:text-2xl">
          {t(locale, "home.forRancher")}
        </h2>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {herramientas.map(({ icon: Icon, color, label, href }) => (
            <Link
              key={label}
              href={href}
              className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center shadow-[var(--shadow)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)]"
            >
              <span className="grid size-12 place-items-center rounded-[var(--radius)] text-white" style={{ background: color }}>
                <Icon size={22} />
              </span>
              <span className="text-sm font-semibold">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Ganadería sostenible: una nota destacada a todo el ancho, sobre
          fondo verde claro como en el mockup. */}
      {sostenible && (
        <section className="rounded-[var(--radius-lg)] bg-[var(--surface-2)] p-5 sm:p-8">
          <h2 className="lx-display text-xl font-bold tracking-tight text-[var(--accent-2)] sm:text-2xl">
            {t(locale, "home.sustainable")}
          </h2>
          {wrap(
            sostenible,
            <GremialCardLink
              a={sostenible}
              locale={locale}
              interactive={interactive}
              className="group mt-6 grid grid-cols-1 gap-6 sm:grid-cols-[1fr_1.2fr] sm:items-center"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-lg)]">
                <GremialThumb a={sostenible} sizes="(min-width: 640px) 40vw, 100vw" />
              </div>
              <div>
                <h3 className="text-xl font-bold leading-snug transition group-hover:text-[var(--accent)] sm:text-2xl" style={homeStyleTitleCss(sostenible.homeStyle, 24, 1.375)}>
                  {sostenible.title}
                </h3>
                <p className="mt-3 line-clamp-3 text-sm text-[var(--fg-muted)] sm:text-base">{sostenible.excerpt}</p>
                <span className="mt-5 inline-flex items-center gap-2 rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)]">
                  {t(locale, "home.explore")} →
                </span>
              </div>
            </GremialCardLink>,
          )}
        </section>
      )}

      {/* Opinión y columnistas: foto real cuando el autor tiene avatar. */}
      {columnistasFinal.length > 0 && (
        <section>
          <h2 className="lx-display text-xl font-bold tracking-tight sm:text-2xl">{t(locale, "home.columnists")}</h2>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {columnistasFinal.map((a) =>
              wrap(
                a,
                <GremialCardLink
                  a={a}
                  locale={locale}
                  interactive={interactive}
                  className="group flex flex-col items-center rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-[var(--shadow)] transition hover:shadow-[var(--shadow-hover)]"
                >
                  {a.authorAvatarUrl ? (
                    <div className="relative size-16 overflow-hidden rounded-full">
                      <ImagenSitio src={a.authorAvatarUrl} alt={a.authorName ?? ""} sizes="64px" ancho={128} alto={128} className="size-full object-cover" />
                    </div>
                  ) : (
                    <span className="lx-display grid size-16 place-items-center rounded-full bg-[var(--accent)] text-xl text-[var(--accent-fg)]">
                      {(a.authorName ?? "C").charAt(0)}
                    </span>
                  )}
                  <p className="mt-3 text-sm font-bold">{a.authorName ?? t(locale, "home.columnists")}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--fg-muted)] transition group-hover:text-[var(--accent)]">
                    {a.title}
                  </p>
                </GremialCardLink>,
              ),
            )}
          </div>
        </section>
      )}

      {/* Boletín en franja verde, como el pie del mockup — mismo formulario
          y misma Server Action que el resto del sitio; solo se le cambian
          los tokens de color en este contenedor. */}
      <section
        className="rounded-[var(--radius-lg)] p-6 text-white sm:p-8"
        style={{
          background: "#1e4d2b",
          ["--bg-2" as string]: "#296339",
          ["--fg-muted" as string]: "rgba(255,255,255,.75)",
          ["--border" as string]: "rgba(255,255,255,.3)",
        }}
      >
        <NewsletterForm locale={locale} compacto />
      </section>
    </div>
  );
}

// Componente de cada plantilla de portada, por su identificador.
export const TEMPLATE_COMPONENTS: Record<HomeTemplateId, (props: TemplateProps) => React.ReactElement | null> = {
  esmeralda: EsmeraldaTemplate,
  clasico: ClasicoTemplate,
  revista: RevistaTemplate,
  compacto: CompactoTemplate,
  vanguardia: VanguardiaTemplate,
  gremial: GremialTemplate,
};
