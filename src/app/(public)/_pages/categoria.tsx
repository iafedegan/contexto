import Link from "next/link";
import { categoryLabel, localePath, t, type Locale } from "@/lib/i18n";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArticleCard } from "@/components/article-card";
import { JsonLd } from "@/components/json-ld";
import { collectionJsonLd } from "@/lib/seo";
import { SiteShell } from "@/components/site-shell";
import { getSiteTheme } from "@/lib/site-theme";
import { getAllCategories, getArticlesByCategory } from "@/lib/content";
import { siteUrl } from "@/lib/utils";

/** Sección — plantilla «Cobre & Obsidiana». */
export const revalidate = 600;

type Params = { params: Promise<{ slug: string }> };
/** Filtros de la sección: subcategoría, rango de fechas y página. */
type Query = Promise<{ subcategoria?: string; desde?: string; hasta?: string; pagina?: string }>;
type PageProps = Params & { searchParams?: Query };

const PAGE_SIZE = 24;

export async function generateStaticParams() {
  try {
    return (await getAllCategories()).map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
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
    alternates: { canonical: siteUrl(`/categoria/${slug}`) },
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
      <header className="relative mb-14 pt-10">
        <p className="lx-kicker text-[var(--accent)]">{t(locale, "section.kicker")}</p>
        <h1 className="lx-display mt-3 text-[2.6rem] font-extrabold leading-[0.95] tracking-tight break-words sm:text-5xl md:text-7xl">
          {categoryLabel(locale, slug, category.name)}
        </h1>
        {category.description && (
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--fg-muted)]">
            {category.description}
          </p>
        )}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <span className="lx-chip border-[var(--border-strong)] text-[var(--accent)]">
            {total} {t(locale, "section.count")}
          </span>
          <span className="lx-chip">{t(locale, "section.live")}</span>
        </div>
        <hr className="lx-rule-strong mt-10" />
      </header>

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
            className="lx-ui rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-fg)] transition hover:opacity-90"
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
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a, i) => (
            <ArticleCard key={a.slug} a={a} locale={locale} variant="copper" index={i} />
          ))}
        </div>
      )}

      {paginas > 1 && (
        <nav className="mt-14 flex items-center justify-center gap-6">
          {page > 1 ? (
            <Link href={hrefPagina(page - 1)} className="lx-link text-sm">
              ← {t(locale, "section.prev")}
            </Link>
          ) : (
            <span />
          )}
          <span className="lx-ui text-xs uppercase tracking-[0.16em] text-[var(--fg-muted)]">
            {page} / {paginas}
          </span>
          {page < paginas ? (
            <Link href={hrefPagina(page + 1)} className="lx-link text-sm">
              {t(locale, "section.next")} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </SiteShell>
  );
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
      alternates: { canonical: siteUrl(`/categoria/${slug}`) },
    };
  };
}
