import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArticleCard } from "@/components/article-card";
import { getAllCategories, getArticlesByCategory } from "@/lib/content";
import { siteUrl } from "@/lib/utils";

export const revalidate = 600;

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  try {
    return (await getAllCategories()).map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
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

export default async function CategoryPage({ params }: Params) {
  const { slug } = await params;
  const { category, items } = await getArticlesByCategory(slug, 24).catch(() => ({
    category: null,
    items: [],
  }));
  if (!category) notFound();

  return (
    <div className="rise">
      <header className="mb-9 border-b border-[var(--line-strong)] pb-5">
        <p className="kicker">Sección</p>
        <h1 className="mt-1.5 text-[2rem] font-extrabold tracking-[-0.025em]">{category.name}</h1>
        {category.description && (
          <p className="mt-2 max-w-xl text-[15px] text-[var(--ink-soft)]">{category.description}</p>
        )}
      </header>
      {items.length === 0 ? (
        <p className="text-[var(--ink-soft)]">Sin artículos en esta sección todavía.</p>
      ) : (
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => (
            <ArticleCard key={a.slug} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}
