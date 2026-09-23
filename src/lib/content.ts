import "server-only";
import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  articles,
  authors,
  categories,
  siteSettings,
  type HomeLayoutConfig,
  type HomeStyle,
} from "@/db/schema";
import { DEFAULT_HOME_LAYOUT } from "@/lib/home-layout";

/** Disposición y plantilla de la portada, configuradas en /panel/portada. */
export async function getHomeLayoutConfig(): Promise<Required<HomeLayoutConfig>> {
  const [row] = await db
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, "home_layout"))
    .limit(1);
  return { ...DEFAULT_HOME_LAYOUT, ...((row?.value as HomeLayoutConfig) ?? {}) };
}

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
  /** Estilo manual fijado en /panel/portada. null = todo por defecto. */
  homeStyle: HomeStyle | null;
  /** Etiqueta "En Vivo" activada por la redacción (AI-03 / FM-06). */
  isLive: boolean;
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
  homeStyle: articles.homeStyle,
  isLive: articles.isLive,
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

/**
 * Como getRecentArticles, pero respeta el orden manual fijado por un editor en
 * /panel/portada (`articles.homePosition`): los artículos anclados van primero,
 * en el orden elegido, y el resto llena los huecos por fecha. Solo lo usa la
 * portada; RSS, llms.txt y el cintillo siguen el orden cronológico real.
 */
export async function getHomepageArticles(limit = 13): Promise<ArticleListItem[]> {
  return db
    .select(listSelection)
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .where(publishedCondition)
    .orderBy(
      sql`(${articles.homePosition} is null)`,
      articles.homePosition,
      desc(articles.publishedAt),
    )
    .limit(limit);
}
export type CategoryFilters = {
  limit?: number;
  offset?: number;
  /** Slug de una subcategoría (hija directa) para restringir el listado a ella. */
  subcategorySlug?: string;
  /** Fecha mínima de publicación, formato "YYYY-MM-DD" (inclusive). */
  dateFrom?: string;
  /** Fecha máxima de publicación, formato "YYYY-MM-DD" (inclusive). */
  dateTo?: string;
};

export async function getArticlesByCategory(
  categorySlug: string,
  filters: CategoryFilters = {},
): Promise<{
  category: { name: string; description: string | null } | null;
  subcategories: { slug: string; name: string }[];
  items: ArticleListItem[];
  total: number;
}> {
  const { limit = 20, offset = 0, subcategorySlug, dateFrom, dateTo } = filters;

  const [cat] = await db
    .select({ id: categories.id, name: categories.name, description: categories.description })
    .from(categories)
    .where(eq(categories.slug, categorySlug))
    .limit(1);
  if (!cat) return { category: null, subcategories: [], items: [], total: 0 };

  const children = await db
    .select({ id: categories.id, slug: categories.slug, name: categories.name })
    .from(categories)
    .where(eq(categories.parentId, cat.id))
    .orderBy(categories.sortOrder, categories.name);

  // Por defecto se listan los artículos de la categoría y de sus subcategorías
  // directas; si se pide una subcategoría concreta, se restringe a esa sola.
  let categoryIds = [cat.id, ...children.map((c) => c.id)];
  if (subcategorySlug) {
    const match = children.find((c) => c.slug === subcategorySlug);
    categoryIds = match ? [match.id] : [];
  }

  const conditions = [publishedCondition, inArray(articles.categoryId, categoryIds)];
  if (dateFrom) conditions.push(gte(articles.publishedAt, sql`${dateFrom}::date`));
  if (dateTo) conditions.push(lte(articles.publishedAt, sql`(${dateTo}::date + interval '1 day')`));
  const where = and(...conditions);

  const [items, [{ count }]] = await Promise.all([
    categoryIds.length === 0
      ? Promise.resolve([])
      : db
          .select(listSelection)
          .from(articles)
          .leftJoin(categories, eq(articles.categoryId, categories.id))
          .leftJoin(authors, eq(articles.authorId, authors.id))
          .where(where)
          .orderBy(desc(articles.publishedAt))
          .limit(limit)
          .offset(offset),
    categoryIds.length === 0
      ? Promise.resolve([{ count: 0 }])
      : db.select({ count: sql<number>`count(*)::int` }).from(articles).where(where),
  ]);

  return {
    category: { name: cat.name, description: cat.description },
    subcategories: children,
    items,
    total: count,
  };
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
  categoryName: string | null;
  categorySlug: string | null;
  authorName: string | null;
  authorSlug: string | null;
  authorBio: string | null;
  isLive: boolean;
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
      categoryName: categories.name,
      categorySlug: categories.slug,
      authorName: authors.name,
      authorSlug: authors.slug,
      authorBio: authors.bio,
      isLive: articles.isLive,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .where(and(eq(articles.slug, slug), publishedCondition))
    .limit(1);
  return row ?? null;
}

/**
 * Igual que la anterior pero SIN filtro de estado: la usa la vista previa del
 * panel para que el redactor vea su borrador tal y como quedará publicado.
 * Nunca se expone en rutas públicas.
 */
export async function getArticleForPreview(
  id: string,
): Promise<(FullArticle & { status: string }) | null> {
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
      isLive: articles.isLive,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .where(eq(articles.id, id))
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

/** Solo las categorías de primer nivel (sin padre) — para el navbar. */
export async function getTopLevelCategories() {
  return db
    .select()
    .from(categories)
    .where(isNull(categories.parentId))
    .orderBy(categories.sortOrder, categories.name);
}

/**
 * Última hora (H-05): la nota marcada como `is_breaking` más reciente. Solo
 * una: la barra pierde su fuerza si se usa para todo.
 */
export async function getBreakingArticle(): Promise<{ slug: string; title: string } | null> {
  const [row] = await db
    .select({ slug: articles.slug, title: articles.title })
    .from(articles)
    .where(and(publishedCondition, eq(articles.isBreaking, true)))
    .orderBy(desc(articles.publishedAt))
    .limit(1);
  return row ?? null;
}

/**
 * Más leídas (H-04). Se ordena por el contador de `views`, que alimenta el
 * beacon del cliente; se limita a los últimos 30 días para que la lista refleje
 * la actualidad y no un éxito de hace dos años.
 */
export async function getMostReadArticles(limit = 5): Promise<ArticleListItem[]> {
  return db
    .select(listSelection)
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .where(and(publishedCondition, gte(articles.publishedAt, sql`now() - interval '30 days'`)))
    .orderBy(desc(articles.views), desc(articles.publishedAt))
    .limit(limit);
}

/** Slugs para generateStaticParams (pre-render en build) y sitemap. */
export async function getAllPublishedSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
  return db
    .select({ slug: articles.slug, updatedAt: articles.updatedAt })
    .from(articles)
    .where(publishedCondition);
}
