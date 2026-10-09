import "server-only";
import { cache } from "react";
import { and, desc, eq, gt, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  articles,
  articleViewsDaily,
  authors,
  categories,
  siteSettings,
  type HomeLayoutConfig,
  type HomeStyle,
} from "@/db/schema";
import { DEFAULT_HOME_LAYOUT } from "@/lib/home-layout";
import { posicionesDePortada, type PosicionPortada } from "@/lib/ubicacion-nota";
import { getPreviewDraft } from "@/lib/preview-draft";
import { cachear, TAG_AJUSTES, TAG_CONTENIDO } from "@/lib/data-cache";

/** Disposición y plantilla de la portada, configuradas en /panel/portada. */
/** Fila `home_layout` de site_settings, cacheada entre peticiones (la invalida el panel al guardar). */
const leerLayoutHome = cachear(
  "home-layout",
  async () => {
    const [row] = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, "home_layout"))
      .limit(1);
    return (row?.value as HomeLayoutConfig | undefined) ?? null;
  },
  { tags: [TAG_AJUSTES] },
);

// Configuración visual de la portada: la del borrador en la vista previa o la guardada (con caché entre peticiones).
export const getHomeLayoutConfig = cache(async (): Promise<Required<HomeLayoutConfig>> => {
  // Vista previa del editor: el diseño sin publicar (ver src/lib/preview-draft.ts). Nunca pasa por la caché.
  const draft = getPreviewDraft();
  if (draft) return { ...DEFAULT_HOME_LAYOUT, ...draft.layout };
  return { ...DEFAULT_HOME_LAYOUT, ...((await leerLayoutHome()) ?? {}) };
});

/**
 * Consultas de lectura del portal público. Todas filtran por estado "publicado"
 * y publishedAt <= now. Las lecturas NO escriben: los "programado" los pasa a
 * "publicado" `procesarProgramadas` (src/lib/scheduled.ts), que además
 * revalida el sitio; lo ejecutan el cron y el aviso del navegador.
 */

const publishedCondition = and(
  eq(articles.status, "publicado"),
  lte(articles.publishedAt, sql`now()`),
);

// Datos de una nota para listados y tarjetas.
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
  authorSlug: string | null;
  authorAvatarUrl: string | null;
  /** Estilo manual fijado en /panel/portada. null = todo por defecto. */
  homeStyle: HomeStyle | null;
  /** Etiqueta "En Vivo" activada por la redacción (AI-03 / FM-06). */
  isLive: boolean;
};

// Columnas que se leen de la base para armar un listado de notas.
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
  authorSlug: authors.slug,
  authorAvatarUrl: authors.avatarUrl,
  homeStyle: articles.homeStyle,
  isLive: articles.isLive,
};

// Últimas notas publicadas, de la más reciente a la más antigua.
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

/** Consulta de la portada con el orden manual, cacheada entre peticiones (la invalida el panel al publicar). */
const leerPortada = cachear(
  "portada",
  (limit: number): Promise<ArticleListItem[]> =>
    db
      .select(listSelection)
      .from(articles)
      .leftJoin(categories, eq(articles.categoryId, categories.id))
      .leftJoin(authors, eq(articles.authorId, authors.id))
      .where(publishedCondition)
      .orderBy(sql`(${articles.homePosition} is null)`, articles.homePosition, desc(articles.publishedAt))
      .limit(limit),
  { tags: [TAG_CONTENIDO], segundos: 60 },
);

/**
 * Como getRecentArticles, pero respeta el orden manual fijado por un editor en
 * /panel/portada (`articles.homePosition`): los artículos anclados van primero,
 * en el orden elegido, y el resto llena los huecos por fecha. Solo lo usa la
 * portada; RSS, llms.txt y el cintillo siguen el orden cronológico real.
 */
export async function getHomepageArticles(limit = 13): Promise<ArticleListItem[]> {
  // Vista previa del editor: el orden y estilo de tarjetas sin publicar.
  const draft = getPreviewDraft();
  if (draft) {
    const rows = await db
      .select(listSelection)
      .from(articles)
      .leftJoin(categories, eq(articles.categoryId, categories.id))
      .leftJoin(authors, eq(articles.authorId, authors.id))
      .where(publishedCondition)
      .orderBy(desc(articles.publishedAt))
      .limit(80);
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    const ordered = draft.items.flatMap((d) => {
      const r = bySlug.get(d.slug);
      return r ? [{ ...r, homeStyle: d.homeStyle }] : [];
    });
    const seen = new Set(draft.items.map((d) => d.slug));
    return [...ordered, ...rows.filter((r) => !seen.has(r.slug))].slice(0, limit);
  }
  return leerPortada(limit);
}
// Filtros de una página de categoría: paginación, subcategoría y rango de fechas.
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

// Resultado de leer una categoría: su ficha, subcategorías, notas de la página y total.
type ListadoCategoria = {
  category: { name: string; description: string | null } | null;
  subcategories: { slug: string; name: string }[];
  items: ArticleListItem[];
  total: number;
};

/** Lectura de una categoría con sus filtros, cacheada entre peticiones (cada combinación de filtros es una entrada). */
const leerCategoria = cachear(
  "categoria",
  async (categorySlug: string, filters: CategoryFilters): Promise<ListadoCategoria> => {
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
  },
  { tags: [TAG_CONTENIDO], segundos: 120 },
);

// Listado de una categoría (con sus subcategorías) leído de la caché; en la vista previa aplica el estilo de bloque sin publicar.
export async function getArticlesByCategory(categorySlug: string, filters: CategoryFilters = {}): Promise<ListadoCategoria> {
  const listado = await leerCategoria(categorySlug, filters);
  // Vista previa del editor: el estilo de bloque sin publicar de cada nota (nunca entra en la caché).
  const draft = getPreviewDraft();
  const draftStyle = draft ? new Map(draft.items.map((d) => [d.slug, d.homeStyle])) : null;
  if (!draftStyle) return listado;
  return {
    ...listado,
    items: listado.items.map((r) => (draftStyle.has(r.slug) ? { ...r, homeStyle: draftStyle.get(r.slug) ?? null } : r)),
  };
}

// Nota completa tal como la necesita la página de artículo.
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

// Busca una nota publicada por su dirección y la devuelve con su categoría y autor; antes promueve las programadas que ya vencieron.
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

// Ficha de un autor con sus notas publicadas; null si no existe.
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

// Todas las categorías, subcategorías incluidas, en su orden.
export async function getAllCategories() {
  return db.select().from(categories).orderBy(categories.sortOrder, categories.name);
}

// Categorías de primer nivel leídas de la caché de datos (5 minutos).
const leerCategoriasPrincipales = cachear(
  "categorias-principales",
  () => db.select().from(categories).where(isNull(categories.parentId)).orderBy(categories.sortOrder, categories.name),
  { tags: [TAG_CONTENIDO], segundos: 300 },
);
/** Solo las categorías de primer nivel (sin padre) — para el navbar. */
export const getTopLevelCategories = cache(() => leerCategoriasPrincipales());

/**
 * Última hora (H-05): la nota marcada como `is_breaking` más reciente. Solo
 * una: la barra pierde su fuerza si se usa para todo.
 */
export const getBreakingArticle = cachear(
  "ultima-hora",
  async (): Promise<{ slug: string; title: string } | null> => {
    const [row] = await db
      .select({ slug: articles.slug, title: articles.title })
      .from(articles)
      .where(and(publishedCondition, eq(articles.isBreaking, true)))
      .orderBy(desc(articles.publishedAt))
      .limit(1);
    return row ?? null;
  },
  { tags: [TAG_CONTENIDO], segundos: 60 },
);

/** Cuántas notas muestra la portada: 1 principal, 1 secundaria, 4 «en breve» y el resto en el río (los cortes de `splitHomeSlots`). */
export const PORTADA_NOTAS = 13;

// El orden de la portada (primero lo fijado a mano, luego por fecha), solo con lo necesario para saber dónde queda cada nota.
const leerOrdenPortada = cachear(
  "portada-orden",
  async (): Promise<{ slug: string; fijada: boolean }[]> => {
    const filas = await db
      .select({ slug: articles.slug, pos: articles.homePosition })
      .from(articles)
      .where(publishedCondition)
      .orderBy(sql`(${articles.homePosition} is null)`, articles.homePosition, desc(articles.publishedAt))
      .limit(PORTADA_NOTAS);
    return filas.map((f) => ({ slug: f.slug, fijada: f.pos !== null }));
  },
  { tags: [TAG_CONTENIDO], segundos: 60 },
);

/**
 * Dónde está cada nota en la portada AHORA MISMO: slug → hueco, posición y si la fijó un editor. Las notas que no salen en la
 * portada no aparecen en el mapa. El orden del mapa es el de la portada. Lo usa la API pública (`ubicacion`).
 */
export async function getPosicionesPortada(): Promise<Map<string, PosicionPortada>> {
  return posicionesDePortada(await leerOrdenPortada());
}

/** Días que cuenta «Más leídas»: las lecturas de la última semana (la de hoy incluida). */
export const DIAS_MAS_LEIDAS = 7;

/**
 * Más leídas (H-04), de verdad: las notas con más lecturas REALES en los últimos 7 días, de cualquier fecha de publicación (una
 * nota vieja que la gente vuelve a leer cuenta). Las lecturas salen del contador diario que alimenta el beacon del cliente
 * (`article_views_daily`, días en hora de Colombia). Solo entran notas con al menos una lectura: no se rellena con notas que
 * nadie ha leído, así que puede haber menos de `limit` (o ninguna, y el bloque no se pinta). Empata por el total histórico y
 * luego por la más reciente. Sin la tabla diaria (migración 0006 sin aplicar) usa el contador total de los últimos 30 días,
 * también solo con lecturas.
 *
 * Es la lectura sin caché: `getMostReadArticles` la guarda 5 minutos.
 */
export async function leerMasLeidas(limit: number = 5): Promise<ArticleListItem[]> {
  try {
    const semana = db
      .select({
        articleId: articleViewsDaily.articleId,
        lecturas: sql<number>`sum(${articleViewsDaily.views})::int`.as("lecturas"),
      })
      .from(articleViewsDaily)
      .where(sql`${articleViewsDaily.day} > (now() at time zone 'America/Bogota')::date - ${DIAS_MAS_LEIDAS}::int`)
      .groupBy(articleViewsDaily.articleId)
      .as("semana");
    return await db
      .select(listSelection)
      .from(articles)
      .innerJoin(semana, eq(semana.articleId, articles.id))
      .leftJoin(categories, eq(articles.categoryId, categories.id))
      .leftJoin(authors, eq(articles.authorId, authors.id))
      .where(and(publishedCondition, gt(semana.lecturas, 0)))
      .orderBy(desc(semana.lecturas), desc(articles.views), desc(articles.publishedAt))
      .limit(limit);
  } catch {
    // Todavía no existe la tabla diaria: el total histórico de los últimos 30 días, solo con lecturas.
    return db
      .select(listSelection)
      .from(articles)
      .leftJoin(categories, eq(articles.categoryId, categories.id))
      .leftJoin(authors, eq(articles.authorId, authors.id))
      .where(and(publishedCondition, gt(articles.views, 0), gte(articles.publishedAt, sql`now() - interval '30 days'`)))
      .orderBy(desc(articles.views), desc(articles.publishedAt))
      .limit(limit);
  }
}

export const getMostReadArticles = cachear("mas-leidas-v2", leerMasLeidas, { tags: [TAG_CONTENIDO], segundos: 300 });

/** Slugs para generateStaticParams (pre-render en build) y sitemap. */
export async function getAllPublishedSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
  return db
    .select({ slug: articles.slug, updatedAt: articles.updatedAt })
    .from(articles)
    .where(publishedCondition);
}
