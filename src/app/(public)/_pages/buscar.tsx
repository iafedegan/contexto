import { INTL_LOCALE, categoryLabel, localePath, t, type Locale } from "@/lib/i18n";
import Link from "next/link";
import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { getSiteTheme } from "@/lib/site-theme";
import Image from "next/image";
import { hybridSearch } from "@/lib/search";
import { getTopLevelCategories } from "@/lib/content";
import { CoverArt } from "@/components/cover-art";
import { SearchBox } from "@/components/search-box";
import { formatDate } from "@/lib/utils";

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

type SP = {
  searchParams: Promise<{ q?: string; seccion?: string; desde?: string; hasta?: string }>;
};

async function SearchPage({ searchParams, locale }: SP & { locale: Locale }) {
  const { q = "", seccion = "", desde = "", hasta = "" } = await searchParams;
  const query = q.trim();
  const [site, categorias] = await Promise.all([getSiteTheme(), getTopLevelCategories().catch(() => [])]);

  const brutos = query
    ? await hybridSearch(query, 60).catch((e) => {
        console.error("BUSCAR error:", e);
        return [];
      })
    : [];

  // Los filtros (B-03) se aplican sobre el resultado fusionado: la relevancia
  // la decide la búsqueda híbrida y el filtro solo recorta, nunca reordena.
  const desdeTs = desde ? Date.parse(`${desde}T00:00:00`) : null;
  const hastaTs = hasta ? Date.parse(`${hasta}T23:59:59`) : null;
  const results = brutos
    .filter((r) => (seccion ? r.categorySlug === seccion : true))
    .filter((r) => {
      if (!desdeTs && !hastaTs) return true;
      if (!r.publishedAt) return false;
      const ts = Date.parse(r.publishedAt);
      return (!desdeTs || ts >= desdeTs) && (!hastaTs || ts <= hastaTs);
    })
    .slice(0, 30);
  const filtrando = Boolean(seccion || desde || hasta);

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

      <div className="mt-10">
        <SearchBox locale={locale} defaultValue={query} autoFocus />
      </div>

      {/* Filtros por sección y fecha (B-03). Van en su propio formulario GET,
          con la consulta como campo oculto, para que cada combinación sea una
          URL compartible. */}
      {query && (
        <form
          action={localePath(locale, "/buscar")}
          method="get"
          className="mt-4 flex flex-wrap items-end gap-3 rounded-[var(--radius)] border border-[var(--border)] p-4"
        >
          <input type="hidden" name="q" value={query} />
          <label className="flex min-w-[11rem] flex-col gap-1.5">
            <span className="lx-kicker text-[var(--fg-muted)]">{t(locale, "search.section")}</span>
            <select name="seccion" defaultValue={seccion} className="lx-input">
              <option value="">{t(locale, "section.all")}</option>
              {categorias.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {categoryLabel(locale, c.slug, c.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="lx-kicker text-[var(--fg-muted)]">{t(locale, "section.from")}</span>
            <input type="date" name="desde" defaultValue={desde} className="lx-input" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="lx-kicker text-[var(--fg-muted)]">{t(locale, "section.to")}</span>
            <input type="date" name="hasta" defaultValue={hasta} className="lx-input" />
          </label>
          <button type="submit" className="lx-btn min-h-11">
            {t(locale, "section.filter")}
          </button>
          {filtrando && (
            <Link
              href={localePath(locale, `/buscar?q=${encodeURIComponent(query)}`)}
              className="lx-link text-sm text-[var(--fg-muted)]"
            >
              {t(locale, "section.clear")}
            </Link>
          )}
        </form>
      )}

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
        {results.map((r) => (
          <li key={`${r.kind}-${r.id}`}>
            <Link
              href={r.url}
              className="lx-card group relative flex gap-4 p-4 transition-colors hover:border-[var(--border-strong)]"
            >
              {/* Miniatura (B-02). Sin foto se pinta la portada generada, que
                  es preferible a un hueco vacío (IMG-03). */}
              <span className="lx-media relative aspect-[4/3] w-28 shrink-0 overflow-hidden rounded-[var(--radius)] sm:w-36">
                {r.image ? (
                  <Image
                    src={r.image}
                    alt=""
                    fill
                    sizes="144px"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <CoverArt seed={r.url} label={r.categoryName ?? r.title} className="text-3xl" />
                )}
              </span>

              <span className="flex min-w-0 flex-1 flex-col justify-center">
                <span className="lx-kicker flex flex-wrap items-center gap-2 text-[var(--accent)]">
                  {r.categorySlug
                    ? categoryLabel(locale, r.categorySlug, r.categoryName ?? "")
                    : t(locale, "search.archive")}
                  {r.publishedAt && (
                    <>
                      <span aria-hidden className="text-[var(--fg-muted)]">·</span>
                      <time dateTime={r.publishedAt} className="text-[var(--fg-muted)]">
                        {formatDate(new Date(r.publishedAt), INTL_LOCALE[locale])}
                      </time>
                    </>
                  )}
                </span>
                <span className="lx-display mt-1.5 block text-lg font-semibold leading-snug transition-colors group-hover:text-[var(--accent)]">
                  {r.title}
                </span>
                <span className="mt-1 line-clamp-2 block text-sm text-[var(--fg-muted)]">
                  {r.summary}
                </span>
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
