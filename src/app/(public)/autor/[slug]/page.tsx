import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArticleCard } from "@/components/article-card";
import { getAuthorWithArticles } from "@/lib/content";
import { siteUrl } from "@/lib/utils";

export const revalidate = 3600;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await getAuthorWithArticles(slug).catch(() => null);
  if (!data) return { title: "Autor no encontrado", robots: { index: false } };
  return {
    title: data.author.name,
    description: data.author.bio ?? `Artículos de ${data.author.name} en CONtexto Ganadero.`,
    alternates: { canonical: siteUrl(`/autor/${slug}`) },
  };
}

export default async function AuthorPage({ params }: Params) {
  const { slug } = await params;
  const data = await getAuthorWithArticles(slug).catch(() => null);
  if (!data) notFound();

  return (
    <div>
      <header className="mb-8 border-b border-[var(--border)] pb-4">
        <h1 className="text-2xl font-extrabold">{data.author.name}</h1>
        {data.author.bio && <p className="mt-2 text-[var(--fg-muted)]">{data.author.bio}</p>}
      </header>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((a) => (
          <ArticleCard key={a.slug} a={a} />
        ))}
      </div>
    </div>
  );
}
