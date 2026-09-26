import Link from "next/link";
import { categoryLabel, localePath, t, type Locale } from "@/lib/i18n";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SectionGrid, SectionHeader } from "@/components/section/section-layout";
import { AdsBanner } from "@/components/ads-banner";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";
import { SiteShell } from "@/components/site-shell";
import { getSiteTheme } from "@/lib/site-theme";
import { getArticlesByCategory } from "@/lib/content";
import { siteUrl } from "@/lib/utils";

/** Sección — plantilla «Cobre & Obsidiana». */
export const revalidate = 600;

type Params = { params: Promise<{ slug: string }> };
/** Filtros de la sección: subcategoría, rango de fechas y página. */
type Query = Promise<{ subcategoria?: string; desde?: string; hasta?: string; pagina?: string }>;
type PageProps = Params & { searchParams?: Query };

const PAGE_SIZE = 24;

/**
 * Las secciones tampoco se prerenderizan: mismo motivo que los artículos, la
 * concurrencia del build agota el pooler. Se generan en la primera visita y
 * quedan cacheadas por ISR.
 */
export async function generateStaticParams() {
  return [];
}

async function generateMetadataImpl({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const { category } = await getArticlesByCategory(slug, { limit: 1 }).catch(() => ({
    category: null,
  }));
  if (!category) return { title: "Sección no encontrada", robots: { index: false } };
  return {
    title: category.name,
    description:
      category.description ??
      `Noticias y análisis de ${category.name.toLowerCase()} en el sector ganadero colombiano.`,
    alternates: {
      canonical: siteUrl(`/categoria/${slug}`),
      // Los lectores RSS descubren solos el feed de la sección.
      types: { "application/rss+xml": siteUrl(`/categoria/${slug}/feed.xml`) },
    },
  };
}

async function CategoryPage({ params, searchParams, locale }: PageProps & { locale: Locale }) {
  const { slug } = await params;
  const { subcategoria, desde, hasta, pagina } = (await searchParams) ?? {};
  const page = Math.max(1, Number(pagina) || 1);

  const { category, subcategories, items, total } = await getArticlesByCategory(slug, {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    subcategorySlug: subcategoria || undefined,
    dateFrom: desde || undefined,
    dateTo: hasta || undefined,
  }).catch(() => ({ category: null, subcategories: [], items: [], total: 0 }));
  if (!category) notFound();

  const site = await getSiteTheme();
  const filtrando = Boolean(subcategoria || desde || hasta);
  const paginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** Conserva los filtros al cambiar de página. */
  const hrefPagina = (n: number) => {
    const sp = new URLSearchParams();
    if (subcategoria) sp.set("subcategoria", subcategoria);
    if (desde) sp.set("desde", desde);
    if (hasta) sp.set("hasta", hasta);
    if (n > 1) sp.set("pagina", String(n));
    const qs = sp.toString();
    return localePath(locale, `/categoria/${slug}${qs ? `?${qs}` : ""}`);
  };

  return (
    <SiteShell theme={site.theme} style={site.style} locale={locale} variant="seccion">
      <JsonLd
        data={collectionJsonLd({
          name: category.name,
          description: category.description,
          path: `/categoria/${slug}`,
          items: items.map((a) => ({ title: a.title, slug: a.slug })),
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: locale === "es" ? "Inicio" : "Home", path: "/" },
          { name: category.name, path: `/categoria/${slug}` },
        ])}
      />

      <SectionHeader
        theme={site.parts.body}
        kicker={t(locale, "section.kicker")}
        title={categoryLabel(locale, slug, category.name)}
        description={category.description}
        breadcrumb={
          /* Miga visible (C-02): ubica al lector y alimenta el dato estructurado. */
          <nav
            aria-label="breadcrumb"
            className="lx-ui flex flex-wrap items-center gap-2 text-[0.68rem] uppercase tracking-[0.2em] text-[var(--fg-muted)]"
          >
            <Link href={localePath(locale, "/")} className="lx-link">
              {locale === "es" ? "Inicio" : "Home"}
            </Link>
            <span aria-hidden className="text-[var(--accent-2)]">/</span>
            <span className="text-[var(--accent)]">{categoryLabel(locale, slug, category.name)}</span>
          </nav>
        }
        chips={
          <>
            <span className="lx-chip border-[var(--border-strong)] text-[var(--accent)]">
              {total} {t(locale, "section.count")}
            </span>
            <span className="lx-chip">{t(locale, "section.live")}</span>
          </>
        }
      />

      {/* Atajos de fecha del C-09. Son enlaces, no botones: cada rango tiene su
          propia URL, cacheable y compartible, y funcionan sin JavaScript. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {RANGOS.map((r) => {
          const desdeISO = r.dias === null ? "" : isoHaceDias(r.dias);
          const activo = r.dias === null ? !desde && !hasta : desde === desdeISO && !hasta;
          const sp = new URLSearchParams();
          if (subcategoria) sp.set("subcategoria", subcategoria);
          if (desdeISO) sp.set("desde", desdeISO);
          const qs = sp.toString();
          return (
            <Link
              key={r.clave}
              href={localePath(locale, `/categoria/${slug}${qs ? `?${qs}` : ""}`)}
              aria-current={activo ? "true" : undefined}
              className={`lx-ui inline-flex min-h-11 items-center rounded-full border px-4 text-[0.72rem] uppercase tracking-[0.14em] transition ${
                activo
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]"
                  : "border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              }`}
            >
              {t(locale, r.clave)}
            </Link>
          );
        })}
      </div>

      {/* Filtros de la sección. Formulario GET: cada combinación es una URL
          propia, enlazable y cacheable, y funciona sin JavaScript. */}
      {subcategories.length > 0 && (
        <form
          action={localePath(locale, `/categoria/${slug}`)}
          method="get"
          className="lx-card mb-10 flex flex-wrap items-end gap-4 p-5"
        >
          <label className="flex min-w-[12rem] flex-col gap-1.5">
            <span className="lx-kicker text-[var(--fg-muted)]">{t(locale, "section.subcategory")}</span>
            <select
              name="subcategoria"
              defaultValue={subcategoria ?? ""}
              className="lx-ui rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)]"
            >
              <option value="">{t(locale, "section.all")}</option>
              {subcategories.map((sc) => (
                <option key={sc.slug} value={sc.slug}>
                  {sc.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="lx-kicker text-[var(--fg-muted)]">{t(locale, "section.from")}</span>
            <input
              type="date"
              name="desde"
              defaultValue={desde ?? ""}
              className="lx-ui rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)]"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="lx-kicker text-[var(--fg-muted)]">{t(locale, "section.to")}</span>
            <input
              type="date"
              name="hasta"
              defaultValue={hasta ?? ""}
              className="lx-ui rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)]"
            />
          </label>

          <button
            type="submit"
            className="lx-ui min-h-11 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-fg)] transition hover:opacity-90"
          >
            {t(locale, "section.filter")}
          </button>

          {filtrando && (
            <Link
              href={localePath(locale, `/categoria/${slug}`)}
              className="lx-link text-sm text-[var(--fg-muted)]"
            >
              {t(locale, "section.clear")}
            </Link>
          )}
        </form>
      )}

      {items.length === 0 ? (
        <p className="py-16 text-center text-[var(--fg-muted)]">
          {filtrando ? t(locale, "section.noMatches") : t(locale, "section.empty")}
        </p>
      ) : (
        <>
          <AdsBanner zone="section_top" className="mx-auto mb-10" />
          <SectionGrid theme={site.parts.body} items={items} locale={locale} />
        </>
      )}

      {/* Continuidad de resultados (C-12): siempre se indica cuántos hay y
          cómo seguir, con paginación numérica enlazable. */}
      {items.length > 0 && (
        <nav className="mt-14 flex flex-col items-center gap-4" aria-label="paginación">
          <p className="lx-ui text-xs uppercase tracking-[0.16em] text-[var(--fg-muted)]">
            {t(locale, "section.showing")} {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, total)} {t(locale, "section.of")} {total}
          </p>

          {paginas > 1 && (
            <ol className="flex flex-wrap items-center justify-center gap-2">
              {page > 1 && (
                <li>
                  <Link href={hrefPagina(page - 1)} className={BOTON_PAG}>
                    ←
                  </Link>
                </li>
              )}
              {paginasVisibles(page, paginas).map((n, i) =>
                n === null ? (
                  <li key={`gap-${i}`} className="px-1 text-[var(--fg-muted)]">
                    …
                  </li>
                ) : (
                  <li key={n}>
                    <Link
                      href={hrefPagina(n)}
                      aria-current={n === page ? "page" : undefined}
                      className={`${BOTON_PAG} ${
                        n === page
                          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]"
                          : ""
                      }`}
                    >
                      {n}
                    </Link>
                  </li>
                ),
              )}
              {page < paginas && (
                <li>
                  <Link href={hrefPagina(page + 1)} className={BOTON_PAG}>
                    →
                  </Link>
                </li>
              )}
            </ol>
          )}

          {page < paginas && (
            <Link
              href={hrefPagina(page + 1)}
              className="lx-ui inline-flex min-h-11 w-full max-w-sm items-center justify-center rounded-full border border-[var(--border-strong)] px-6 text-sm font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              {t(locale, "section.loadMore")}
            </Link>
          )}
        </nav>
      )}

      <AdsBanner zone="section_bottom" className="mx-auto mt-14" />

    </SiteShell>
  );
}


const BOTON_PAG =
  "lx-ui grid min-h-11 min-w-11 place-items-center rounded-full border border-[var(--border)] px-3 text-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)]";

/**
 * Ventana de páginas: primera, última, la actual y sus vecinas. `null` marca
 * un salto (…). Evita listar cincuenta números en secciones con mucho archivo.
 */
function paginasVisibles(actual: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const cerca = [actual - 1, actual, actual + 1].filter((n) => n > 1 && n < total);
  const nums = [1, ...cerca, total];
  const salida: (number | null)[] = [];
  let previo = 0;
  for (const n of nums) {
    if (n - previo > 1) salida.push(null);
    salida.push(n);
    previo = n;
  }
  return salida;
}

/** Atajos de fecha del C-09: todo, hoy, últimos 7 días, últimos 30 días. */
const RANGOS = [
  { clave: "section.rangeAll", dias: null },
  { clave: "section.rangeToday", dias: 0 },
  { clave: "section.rangeWeek", dias: 7 },
  { clave: "section.rangeMonth", dias: 30 },
] as const;

/** Fecha ISO (YYYY-MM-DD) de hace N días, en la zona del servidor. */
function isoHaceDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

/** Fábrica: la misma página en cualquier idioma de interfaz. */
export function makePage(locale: Locale) {
  return function Page(props: Parameters<typeof CategoryPage>[0]) {
    return CategoryPage({ ...props, locale } as never);
  };
}

/**
 * En inglés cambia la interfaz, no el contenido: la página es la MISMA nota en
 * español. Se marca `noindex` y se apunta la canónica a la ruta española para
 * no competir contra ella con contenido duplicado.
 */
export function makeMetadata(locale: Locale) {
  return async (props: Parameters<typeof generateMetadataImpl>[0]) => {
    const meta = await generateMetadataImpl({ ...props, locale } as never);
    if (locale === "es") return meta;
    const { slug } = await props.params;
    return {
      ...meta,
      robots: { index: false, follow: true },
      alternates: {
        canonical: siteUrl(`/categoria/${slug}`),
        types: { "application/rss+xml": siteUrl(`/categoria/${slug}/feed.xml`) },
      },
    };
  };
}
