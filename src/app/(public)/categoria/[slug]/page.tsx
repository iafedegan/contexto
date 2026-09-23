import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArticleCard } from "@/components/article-card";
import { getAllCategories, getArticlesByCategory } from "@/lib/content";
import { siteUrl } from "@/lib/utils";
import { Button, Input } from "@/components/ui";

export const revalidate = 600;

const PAGE_SIZE = 24;

type Params = { params: Promise<{ slug: string }> };
type SearchParams = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ subcategoria?: string; desde?: string; hasta?: string; pagina?: string }>;
};

export async function generateStaticParams() {
  try {
    return (await getAllCategories()).map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
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

export default async function CategoryPage({ params, searchParams }: SearchParams) {
  const { slug } = await params;
  const { subcategoria, desde, hasta, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina) || 1);

  const { category, subcategories, items, total } = await getArticlesByCategory(slug, {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    subcategorySlug: subcategoria || undefined,
    dateFrom: desde || undefined,
    dateTo: hasta || undefined,
  }).catch(() => ({ category: null, subcategories: [], items: [], total: 0 }));
  if (!category) notFound();

  const hasFilters = Boolean(subcategoria || desde || hasta);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageHref = (n: number) => {
    const sp = new URLSearchParams();
    if (subcategoria) sp.set("subcategoria", subcategoria);
    if (desde) sp.set("desde", desde);
    if (hasta) sp.set("hasta", hasta);
    if (n > 1) sp.set("pagina", String(n));
    const qs = sp.toString();
    return `/categoria/${slug}${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <header className="mb-8 border-b border-[var(--border)] pb-4">
        <h1 className="text-2xl font-extrabold">{category.name}</h1>
        {category.description && (
          <p className="mt-2 text-[var(--fg-muted)]">{category.description}</p>
        )}
      </header>

      {subcategories.length > 0 && (
        <form
          action={`/categoria/${slug}`}
          method="get"
          className="mb-6 flex flex-wrap items-end gap-3 rounded-[var(--radius)] border border-[var(--border)] p-4"
        >
          <label className="flex flex-col gap-1 text-sm">
            Subcategoría
            <select
              name="subcategoria"
              defaultValue={subcategoria ?? ""}
              className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
            >
              <option value="">Todas</option>
              {subcategories.map((sc) => (
                <option key={sc.slug} value={sc.slug}>
                  {sc.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Desde
            <Input type="date" name="desde" defaultValue={desde ?? ""} className="w-auto" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Hasta
            <Input type="date" name="hasta" defaultValue={hasta ?? ""} className="w-auto" />
          </label>
          <Button type="submit">Filtrar</Button>
          {hasFilters && (
            <Link
              href={`/categoria/${slug}`}
              className="text-sm text-[var(--fg-muted)] underline underline-offset-2"
            >
              Limpiar filtros
            </Link>
          )}
        </form>
      )}

      {items.length === 0 ? (
        <p className="text-[var(--fg-muted)]">
          {hasFilters
            ? "Sin artículos que coincidan con los filtros seleccionados."
            : "Sin artículos en esta sección todavía."}
        </p>
      ) : (
        <>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((a) => (
              <ArticleCard key={a.slug} a={a} />
            ))}
          </div>
          {totalPages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-4">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className="text-sm text-[var(--link)]">
                  ← Anterior
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm text-[var(--fg-muted)]">
                Página {page} de {totalPages}
              </span>
              {page < totalPages ? (
                <Link href={pageHref(page + 1)} className="text-sm text-[var(--link)]">
                  Siguiente →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
