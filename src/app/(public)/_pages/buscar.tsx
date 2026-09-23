import { localePath, t, type Locale } from "@/lib/i18n";
import Link from "next/link";
import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { getSiteTheme } from "@/lib/site-theme";
import { hybridSearch } from "@/lib/search";

/** Buscador — plantilla «Zafiro Medianoche». */
export const metadata: Metadata = {
  title: "Buscar",
  robots: { index: false, follow: true }, // resultados de búsqueda no se indexan
};

const SUGERENCIAS = [
  "precio del novillo gordo",
  "sistemas silvopastoriles",
  "ciclo de vacunación",
  "exportaciones de carne",
];

type SP = { searchParams: Promise<{ q?: string }> };

async function SearchPage({ searchParams, locale }: SP & { locale: Locale }) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const site = await getSiteTheme();
  const results = query
    ? await hybridSearch(query, 30).catch((e) => {
        console.error("BUSCAR error:", e);
        return [];
      })
    : [];

  return (
    <SiteShell theme={site.theme} style={site.style} locale={locale} variant="buscar">
      <header className="pt-6">
        <p className="lx-kicker text-[var(--accent)]">{t(locale, "search.kicker")}</p>
        <h1 className="lx-display mt-3 text-4xl font-bold tracking-tight md:text-5xl">
          {t(locale, "search.title")}{" "}
          <span className="text-[var(--accent)]">{t(locale, "search.titleAccent")}</span>
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--fg-muted)]">
          {t(locale, "search.blurb")}
        </p>
      </header>

      <form
        action={localePath(locale, "/buscar")}
        method="get"
        className="lx-card lx-glass mt-10 flex flex-wrap items-center gap-3 p-3"
      >
        <span aria-hidden className="lx-mono pl-3 text-lg text-[var(--accent)]">
          ⌕
        </span>
        <input
          name="q"
          defaultValue={query}
          placeholder={t(locale, "search.placeholder")}
          autoFocus
          className="lx-input min-w-[12rem] flex-1 border-0 bg-transparent focus:shadow-none"
          aria-label={t(locale, "search.label")}
        />
        <button type="submit" className="lx-btn">
          {t(locale, "search.button")}
        </button>
      </form>

      {!query && (
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="lx-mono text-xs text-[var(--fg-muted)]">{t(locale, "search.try")}</span>
          {SUGERENCIAS.map((s) => (
            <Link key={s} href={localePath(locale, `/buscar?q=${encodeURIComponent(s)}`)} className="lx-chip lx-mono hover:border-[var(--border-strong)] hover:text-[var(--accent)]">
              {s}
            </Link>
          ))}
        </div>
      )}

      {query && (
        <p className="lx-mono mt-8 text-xs text-[var(--fg-muted)]">
          <span className="text-[var(--accent)]">{results.length}</span>{" "}
          {results.length === 1 ? t(locale, "search.result") : t(locale, "search.results")} ·{" "}
          {t(locale, "search.query")} &ldquo;{query}&rdquo;
        </p>
      )}

      <ul className="mt-6 flex flex-col gap-3">
        {results.map((r, i) => (
          <li key={`${r.kind}-${r.id}`}>
            <Link
              href={r.url}
              className="lx-card group relative flex gap-4 p-5 transition-colors hover:border-[var(--border-strong)]"
            >
              <span className="lx-mono pt-1 text-xs text-[var(--accent)] opacity-60">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="lx-display block text-lg font-semibold leading-snug transition-colors group-hover:text-[var(--accent)]">
                  {r.title}
                </span>
                <span className="mt-1.5 line-clamp-2 block text-sm text-[var(--fg-muted)]">
                  {r.summary}
                </span>
              </span>
              <span
                className={`lx-chip lx-mono h-fit shrink-0 ${
                  r.kind === "archivo" ? "" : "border-[var(--border-strong)] text-[var(--accent)]"
                }`}
              >
                {r.kind}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {query && results.length === 0 && (
        <p className="lx-mono mt-10 rounded-[var(--radius)] border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--fg-muted)]">
          {t(locale, "search.none")}{" "}
          <Link href={localePath(locale, "/asistente")} className="text-[var(--accent)] underline">
            {t(locale, "search.assistant")}
          </Link>
        </p>
      )}
    </SiteShell>
  );
}


/** Fábrica: la misma página en cualquier idioma de interfaz. */
export function makePage(locale: Locale) {
  return function Page(props: Parameters<typeof SearchPage>[0]) {
    return SearchPage({ ...props, locale } as never);
  };
}
