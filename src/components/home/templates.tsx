"use client";

import { HomeCard } from "@/components/home/home-card";
import { ArticleCard } from "@/components/article-card";
import { BroadsheetCard } from "@/components/home/broadsheet-card";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { BreveCarousel } from "@/components/home/breve-carousel";
import { TileCard } from "@/components/home/tile-card";
import { BentoTile } from "@/components/home/bento-tile";
import { EditableCard, type BuilderProps } from "@/components/home/editable-card";
import type { ArticleListItem } from "@/lib/content";
import { BREVE_COLS, RIVER_COLS, type HomeTemplateId } from "@/lib/home-layout";
import type { HomeLayoutConfig } from "@/db/schema";
import { cn, formatDate } from "@/lib/utils";
import { DEFAULT_LOCALE, t, type Locale } from "@/lib/i18n";

type Slots = {
  lead?: ArticleListItem;
  second?: ArticleListItem;
  rail: ArticleListItem[];
  river: ArticleListItem[];
};

type TemplateProps = Slots &
  BuilderProps & {
    layout: Required<HomeLayoutConfig>;
    /** false = dentro del editor de portada (sin navegar ni autoplay). */
    interactive?: boolean;
    /** Idioma de la interfaz (rótulos y fechas). */
    locale?: Locale;
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
  locale = DEFAULT_LOCALE,
  builderSelected,
  builderOverIndex,
  builderDragProps,
  builderHasStyle,
}: TemplateProps) {
  if (!lead) return null;
  const horizontal = layout.breveDirection === "horizontal";
  const all = [lead, second, ...rail, ...river].filter((a): a is ArticleListItem => Boolean(a));
  const indexOf = (a: ArticleListItem) => all.findIndex((x) => x.slug === a.slug);
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
        <section className="grid gap-x-10 gap-y-8 lg:grid-cols-[1.8fr_1px_1fr]">
          {leadBlock}
          <div className="hidden bg-[var(--bw-rule,var(--rule))] lg:block" aria-hidden />
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
                a.homeStyle?.span === 2 ? "sm:col-span-2" : undefined,
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
                className={a.homeStyle?.span === 2 ? "sm:col-span-2" : undefined}
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

      <div className="relative grid auto-rows-[9.5rem] grid-cols-2 gap-3 sm:auto-rows-[11rem] sm:grid-cols-6 sm:gap-4">
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
            className="col-span-1 sm:col-span-2"
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
  locale = DEFAULT_LOCALE,
  builderSelected,
  builderOverIndex,
  builderDragProps,
  builderHasStyle,
}: TemplateProps) {
  if (!lead) return null;
  const all = [lead, second, ...rail, ...river].filter((a): a is ArticleListItem => Boolean(a));
  const indexOf = (a: ArticleListItem) => all.findIndex((x) => x.slug === a.slug);
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
  const aside = [second, ...rail].filter((a): a is ArticleListItem => Boolean(a));

  return (
    <div className="flex flex-col gap-16">
      <section className="grid gap-8 lg:grid-cols-[1.55fr_1fr]">
        {wrap(lead, <ArticleCard a={lead} locale={locale} variant="lead" priority={interactive} />)}
        <aside>
          <p className="lx-kicker text-[var(--accent)]">{t(locale, "home.cover")}</p>
          <h2 className="lx-display mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
            {t(locale, "home.latest")}
          </h2>
          <div className="mt-6 flex flex-col gap-5">
            {aside.map((a, i) => wrap(a, <ArticleCard a={a} locale={locale} variant="rail" index={i} />))}
          </div>
        </aside>
      </section>

      {river.length > 0 && (
        <section>
          <div className="border-b border-[var(--border)] pb-4">
            <p className="lx-kicker text-[var(--accent)]">{t(locale, "home.current")}</p>
            <h2 className="lx-display mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
              {t(locale, "home.recent")}
            </h2>
          </div>
          <div className={cn("mt-8 grid gap-7", RIVER_COLS[layout.riverColumns] ?? RIVER_COLS[3])}>
            {river.map((a) =>
              wrap(a, <ArticleCard a={a} locale={locale} />, a.homeStyle?.span === 2 ? "sm:col-span-2" : undefined),
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export const TEMPLATE_COMPONENTS: Record<HomeTemplateId, (props: TemplateProps) => React.ReactElement | null> = {
  esmeralda: EsmeraldaTemplate,
  clasico: ClasicoTemplate,
  revista: RevistaTemplate,
  compacto: CompactoTemplate,
  vanguardia: VanguardiaTemplate,
};
