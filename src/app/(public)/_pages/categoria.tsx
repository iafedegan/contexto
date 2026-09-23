import { categoryLabel, t, type Locale } from "@/lib/i18n";
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

export async function generateStaticParams() {
  try {
    return (await getAllCategories()).map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

async function generateMetadataImpl({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const { category } = await getArticlesByCategory(slug, 1).catch(() => ({ category: null }));
  if (!category) return { title: "Sección no encontrada", robots: { index: false } };
  return {
    title: category.name,
    description:
      category.description ??
      `Noticias y análisis de ${category.name.toLowerCase()} en el sector ganadero colombiano.`,
    alternates: { canonical: siteUrl(`/categoria/${slug}`) },
  };
}

async function CategoryPage({ params, locale }: Params & { locale: Locale }) {
  const { slug } = await params;
  const { category, items } = await getArticlesByCategory(slug, 24).catch(() => ({
    category: null,
    items: [],
  }));
  if (!category) notFound();

  const site = await getSiteTheme();

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
            {items.length} {t(locale, "section.count")}
          </span>
          <span className="lx-chip">{t(locale, "section.live")}</span>
        </div>
        <hr className="lx-rule-strong mt-10" />
      </header>

      {items.length === 0 ? (
        <p className="py-16 text-center text-[var(--fg-muted)]">
          {t(locale, "section.empty")}
        </p>
      ) : (
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a, i) => (
            <ArticleCard key={a.slug} a={a} locale={locale} variant="copper" index={i} />
          ))}
        </div>
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
