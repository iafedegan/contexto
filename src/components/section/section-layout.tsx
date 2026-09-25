import { ArticleCard } from "@/components/article-card";
import { BroadsheetCard } from "@/components/home/broadsheet-card";
import { HomeCard } from "@/components/home/home-card";
import { TileCard } from "@/components/home/tile-card";
import { BentoTile } from "@/components/home/bento-tile";
import type { ArticleListItem } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Página de sección con la estructura de CADA plantilla, no un diseño común:
 * cada una reutiliza las tarjetas y la composición de su propia portada
 * (diario, revista, fichas densas, bento, obsidiana).
 */

type HeaderProps = {
  theme: string;
  kicker: string;
  title: string;
  description?: string | null;
  chips: React.ReactNode;
  breadcrumb: React.ReactNode;
};

/** Cabecera de sección en el idioma visual de la plantilla. */
export function SectionHeader({ theme, kicker, title, description, chips, breadcrumb }: HeaderProps) {
  switch (theme) {
    case "clasico":
      // Diario: cabecera centrada entre filetes dobles, como una sección impresa.
      return (
        <header className="relative mb-12 pt-8 text-center">
          <div className="flex justify-center">{breadcrumb}</div>
          <div className="mt-2 border-y-4 border-double border-[var(--fg)] py-6">
            <p className="lx-kicker text-[var(--accent)]">{kicker}</p>
            <h1 className="lx-display mt-2 text-5xl font-black uppercase tracking-tight md:text-7xl">{title}</h1>
          </div>
          {description && (
            <p className="mx-auto mt-5 max-w-2xl font-serif text-lg italic text-[var(--fg-muted)]">{description}</p>
          )}
          <div className="mt-5 flex flex-wrap justify-center gap-3">{chips}</div>
        </header>
      );
    case "revista":
      // Revista: título enorme en cursiva, alineado a la izquierda, con aire.
      return (
        <header className="relative mb-14 pt-12">
          {breadcrumb}
          <p className="lx-kicker mt-6 text-[var(--accent)]">{kicker}</p>
          <h1 className="lx-display mt-3 text-6xl font-light italic leading-[0.9] tracking-tight md:text-8xl">{title}</h1>
          <div className="mt-8 grid gap-6 border-t border-[var(--border-strong)] pt-6 md:grid-cols-[2fr_1fr]">
            {description ? <p className="text-xl leading-relaxed text-[var(--fg-muted)]">{description}</p> : <span />}
            <div className="flex flex-wrap items-start gap-3 md:justify-end">{chips}</div>
          </div>
        </header>
      );
    case "compacto":
      // Compacto: barra densa tipo panel de datos.
      return (
        <header className="mb-6 pt-4">
          {breadcrumb}
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-b-2 border-[var(--fg)] pb-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--accent)]">{kicker}</p>
              <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
            </div>
            <div className="flex flex-wrap gap-2 font-mono text-[11px]">{chips}</div>
          </div>
          {description && <p className="mt-2 text-sm text-[var(--fg-muted)]">{description}</p>}
        </header>
      );
    case "vanguardia":
      // Vanguardia: titular en degradado dentro de una tarjeta redondeada.
      return (
        <header className="relative mb-8 overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--bg-2)] p-8 md:p-12">
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-[var(--accent-2)] opacity-25 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 left-10 size-72 rounded-full bg-[var(--accent)] opacity-20 blur-3xl" />
          <div className="relative">
            {breadcrumb}
            <p className="lx-kicker mt-6 text-[var(--accent)]">{kicker}</p>
            <h1 className="mt-3 bg-gradient-to-r from-[var(--fg)] via-[var(--accent)] to-[var(--accent-2)] bg-clip-text text-5xl font-black tracking-tight text-transparent md:text-7xl">
              {title}
            </h1>
            {description && <p className="mt-5 max-w-2xl text-lg text-[var(--fg-muted)]">{description}</p>}
            <div className="mt-6 flex flex-wrap gap-3">{chips}</div>
          </div>
        </header>
      );
    case "esmeralda":
    case "home":
      // Esmeralda: frontispicio centrado, rombos y filetes de pan de oro.
      return (
        <header className="relative mb-14 pt-10 text-center">
          <div className="flex justify-center">{breadcrumb}</div>
          <div className="mt-8 flex items-center justify-center gap-4 text-[var(--accent)]">
            <span className="h-px w-16 bg-gradient-to-r from-transparent to-[var(--accent)] md:w-40" />
            <span aria-hidden>◆</span>
            <p className="lx-kicker">{kicker}</p>
            <span aria-hidden>◆</span>
            <span className="h-px w-16 bg-gradient-to-l from-transparent to-[var(--accent)] md:w-40" />
          </div>
          <h1 className="lx-display mt-5 bg-gradient-to-b from-[var(--fg)] to-[var(--accent)] bg-clip-text text-[2.6rem] font-semibold leading-[1] tracking-tight text-transparent sm:text-6xl md:text-8xl">
            {title}
          </h1>
          {description && (
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--fg-muted)]">{description}</p>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-3">{chips}</div>
          <div aria-hidden className="mx-auto mt-10 h-px max-w-3xl bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" />
        </header>
      );
    default:
      // Resto: lámina con filete.
      return (
        <header className="relative mb-14 pt-10">
          {breadcrumb}
          <p className="lx-kicker mt-6 text-[var(--accent)]">{kicker}</p>
          <h1 className="lx-display mt-3 text-[2.6rem] font-extrabold leading-[0.95] tracking-tight break-words sm:text-5xl md:text-7xl">
            {title}
          </h1>
          {description && <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--fg-muted)]">{description}</p>}
          <div className="mt-8 flex flex-wrap items-center gap-3">{chips}</div>
          <hr className="lx-rule-strong mt-10" />
        </header>
      );
  }
}

/** Lista de notas de la sección con la composición de la plantilla. */
export function SectionGrid({ theme, items, locale }: { theme: string; items: ArticleListItem[]; locale: Locale }) {
  const [lead, ...rest] = items;
  if (!lead) return null;

  switch (theme) {
    case "clasico": {
      // Diario: apertura grande, tres columnas separadas por filetes y el
      // resto como breves a dos columnas.
      const top = rest.slice(0, 3);
      const breves = rest.slice(3);
      return (
        <div className="tpl-broadsheet flex flex-col gap-10">
          <BroadsheetCard a={lead} locale={locale} index={0} variant="lead" priority />
          {top.length > 0 && (
            <div className="grid gap-8 border-t-2 border-[var(--fg)] pt-6 md:grid-cols-3 md:divide-x md:divide-[var(--border)] [&>*]:md:px-5 [&>*:first-child]:md:pl-0">
              {top.map((a, i) => (
                <BroadsheetCard key={a.slug} a={a} locale={locale} index={i + 1} variant="feature" />
              ))}
            </div>
          )}
          {breves.length > 0 && (
            <div className="grid gap-x-10 gap-y-2 border-t border-[var(--border)] pt-6 md:grid-cols-2">
              {breves.map((a, i) => (
                <BroadsheetCard key={a.slug} a={a} locale={locale} index={i + 4} variant="compact" />
              ))}
            </div>
          )}
        </div>
      );
    }
    case "revista": {
      // Revista: portada a sangre, dos destacados grandes y rejilla con zoom.
      const pair = rest.slice(0, 2);
      const grid = rest.slice(2);
      return (
        <div className="flex flex-col gap-12">
          <HomeCard a={lead} locale={locale} variant="lead" hover="zoom" priority />
          {pair.length > 0 && (
            <div className="grid gap-8 md:grid-cols-2">
              {pair.map((a) => (
                <HomeCard key={a.slug} a={a} locale={locale} variant="feature" hover="zoom" />
              ))}
            </div>
          )}
          {grid.length > 0 && (
            <div className="grid gap-x-6 gap-y-10 border-t-2 border-[var(--rule-strong)] pt-8 sm:grid-cols-2 lg:grid-cols-3">
              {grid.map((a) => (
                <HomeCard key={a.slug} a={a} locale={locale} variant="feature" hover="zoom" />
              ))}
            </div>
          )}
        </div>
      );
    }
    case "compacto":
      // Compacto: fichas densas; la primera ocupa 2×2.
      return (
        <div className="grid auto-rows-[13rem] grid-cols-2 gap-3 md:grid-cols-4">
          <div className="col-span-2 row-span-2">
            <TileCard a={lead} locale={locale} index={0} size="lg" priority className="h-full" />
          </div>
          {rest.map((a, i) => (
            <div key={a.slug}>
              <TileCard a={a} locale={locale} index={i + 1} size="md" className="h-full" />
            </div>
          ))}
        </div>
      );
    case "vanguardia":
      // Vanguardia: bento asimétrico dentro de una lámina oscura redondeada.
      return (
        <div className="relative overflow-hidden rounded-[2rem] bg-[var(--bg-2)] p-3 sm:p-5">
          <div className="grid auto-rows-[10rem] grid-cols-2 gap-3 sm:auto-rows-[11rem] sm:grid-cols-6 sm:gap-4">
            <div className="col-span-2 row-span-2 sm:col-span-4">
              <BentoTile a={lead} locale={locale} size="xl" priority className="h-full" />
            </div>
            {rest.map((a, i) => (
              <div
                key={a.slug}
                className={cn(
                  "col-span-1 sm:col-span-2",
                  i === 0 && "row-span-2",
                  i % 5 === 3 && "sm:col-span-3",
                  i % 5 === 4 && "sm:col-span-3",
                )}
              >
                <BentoTile a={a} locale={locale} size={i === 0 ? "lg" : "md"} className="h-full" />
              </div>
            ))}
          </div>
        </div>
      );
    case "esmeralda":
    case "home": {
      // Esmeralda: apertura + columna «Lo último» numerada, y rejilla dorada.
      const rail = rest.slice(0, 4);
      const grid = rest.slice(4);
      return (
        <div className="flex flex-col gap-14">
          <section className="grid gap-8 lg:grid-cols-[1.55fr_1fr]">
            <ArticleCard a={lead} locale={locale} variant="lead" priority />
            {rail.length > 0 && (
              <div className="flex flex-col gap-5">
                {rail.map((a, i) => (
                  <ArticleCard key={a.slug} a={a} locale={locale} variant="rail" index={i} />
                ))}
              </div>
            )}
          </section>
          {grid.length > 0 && (
            <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {grid.map((a, i) => (
                <ArticleCard key={a.slug} a={a} locale={locale} variant="gold" index={i} />
              ))}
            </div>
          )}
        </div>
      );
    }
    default:
      return (
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a, i) => (
            <ArticleCard key={a.slug} a={a} locale={locale} variant="copper" index={i} />
          ))}
        </div>
      );
  }
}
