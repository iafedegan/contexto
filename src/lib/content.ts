import "server-only";
import { and, desc, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors, categories, type EditorialStatus } from "@/db/schema";

/**
 * Consultas de lectura del portal público. Todas filtran por estado "publicado"
 * y publishedAt <= now (los "programado" se materializan por un job de cron que
 * los pasa a "publicado" y dispara revalidación).
 */

const publishedCondition = and(
  eq(articles.status, "publicado"),
  lte(articles.publishedAt, sql`now()`),
);

export type ArticleListItem = {
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  publishedAt: Date | null;
  categoryName: string | null;
  categorySlug: string | null;
  authorName: string | null;
};

const listSelection = {
  slug: articles.slug,
  title: articles.title,
  excerpt: articles.excerpt,
  coverImageUrl: articles.coverImageUrl,
  coverImageAlt: articles.coverImageAlt,
  publishedAt: articles.publishedAt,
  categoryName: categories.name,
  categorySlug: categories.slug,
  authorName: authors.name,
};

export async function getRecentArticles(limit = 12): Promise<ArticleListItem[]> {
  return db
    .select(listSelection)
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .where(publishedCondition)
    .orderBy(desc(articles.publishedAt))
    .limit(limit);
}

export async function getArticlesByCategory(
  categorySlug: string,
  limit = 20,
  offset = 0,
): Promise<{ category: { name: string; description: string | null } | null; items: ArticleListItem[] }> {
  const [cat] = await db
    .select({ id: categories.id, name: categories.name, description: categories.description })
    .from(categories)
    .where(eq(categories.slug, categorySlug))
    .limit(1);
  if (!cat) return { category: null, items: [] };

  const items = await db
    .select(listSelection)
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .where(and(publishedCondition, eq(articles.categoryId, cat.id)))
    .orderBy(desc(articles.publishedAt))
    .limit(limit)
    .offset(offset);

  return { category: { name: cat.name, description: cat.description }, items };
}

export type FullArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  metaTitle: string | null;
  metaDescription: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  tags: string[];
  publishedAt: Date | null;
  updatedAt: Date;
  status: EditorialStatus;
  categoryName: string | null;
  categorySlug: string | null;
  authorName: string | null;
  authorSlug: string | null;
  authorBio: string | null;
};

export async function getPublishedArticleBySlug(slug: string): Promise<FullArticle | null> {
  const [row] = await db
    .select({
      id: articles.id,
      slug: articles.slug,
      title: articles.title,
      excerpt: articles.excerpt,
      body: articles.body,
      metaTitle: articles.metaTitle,
      metaDescription: articles.metaDescription,
      coverImageUrl: articles.coverImageUrl,
      coverImageAlt: articles.coverImageAlt,
      tags: articles.tags,
      publishedAt: articles.publishedAt,
      updatedAt: articles.updatedAt,
      status: articles.status,
      categoryName: categories.name,
      categorySlug: categories.slug,
      authorName: authors.name,
      authorSlug: authors.slug,
      authorBio: authors.bio,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .where(and(eq(articles.slug, slug), publishedCondition))
    .limit(1);
  return row ?? null;
}

/**
 * Variante de getPublishedArticleBySlug sin filtro de estado, para la vista previa
 * del panel editorial. Nunca se expone sin pasar antes por Draft Mode + sesión
 * autenticada (ver /api/preview y /articulo/[slug]/page.tsx).
 */
export async function getArticleBySlugForPreview(slug: string): Promise<FullArticle | null> {
  const [row] = await db
    .select({
      id: articles.id,
      slug: articles.slug,
      title: articles.title,
      excerpt: articles.excerpt,
      body: articles.body,
      metaTitle: articles.metaTitle,
      metaDescription: articles.metaDescription,
      coverImageUrl: articles.coverImageUrl,
      coverImageAlt: articles.coverImageAlt,
      tags: articles.tags,
      publishedAt: articles.publishedAt,
      updatedAt: articles.updatedAt,
      status: articles.status,
      categoryName: categories.name,
      categorySlug: categories.slug,
      authorName: authors.name,
      authorSlug: authors.slug,
      authorBio: authors.bio,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .where(eq(articles.slug, slug))
    .limit(1);
  return row ?? null;
}

export async function getAuthorWithArticles(slug: string) {
  const [a] = await db.select().from(authors).where(eq(authors.slug, slug)).limit(1);
  if (!a) return null;
  const items = await db
    .select(listSelection)
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .where(and(publishedCondition, eq(articles.authorId, a.id)))
    .orderBy(desc(articles.publishedAt))
    .limit(30);
  return { author: a, items };
}

export async function getAllCategories() {
  return db.select().from(categories).orderBy(categories.sortOrder, categories.name);
}

/** Slugs para generateStaticParams (pre-render en build) y sitemap. */
export async function getAllPublishedSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
  return db
    .select({ slug: articles.slug, updatedAt: articles.updatedAt })
    .from(articles)
    .where(publishedCondition);
}
