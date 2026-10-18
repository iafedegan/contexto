import "server-only";
import { cache } from "react";
import { departamentoPorSlug, regionPorSlug } from "@/lib/regiones-colombia";
import { and, desc, eq, gt, gte, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
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
  /** Dirección original del sitio anterior (las notas migradas se sirven ahí); null en las notas nuevas. */
  legacyPath?: string | null;
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
  legacyPath: articles.legacyPath,
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
  /** Slug de un autor para listar solo sus notas de la sección. */
  authorSlug?: string;
  /** Región natural (ver regiones-colombia.ts): notas que mencionan sus departamentos o ciudades en el título, resumen o etiquetas. */
  regionSlug?: string;
  /** Departamento (ver regiones-colombia.ts): notas que lo mencionan o su capital. */
  departamentoSlug?: string;
};

// Resultado de leer una categoría: su ficha, subcategorías, notas de la página y total.
type ListadoCategoria = {
  /** `parentSlug`: la sección madre (decide el formato de TV, Radio y Especiales en sus subsecciones). */
  category: { name: string; description: string | null; parentSlug?: string | null } | null;
  subcategories: { slug: string; name: string }[];
  items: ArticleListItem[];
  total: number;
};

/**
 * Condición «la nota es de una de estas categorías o aparece en una de estas secciones». La categoría principal de cada nota es una sola,
 * pero el sitio anterior mostraba una misma nota en varias secciones (una de «Regiones» también en «Gremialidad»): esas otras secciones
 * se guardan en `articles.secciones` y las páginas de categoría y sus feeds las incluyen por aquí.
 */
export function enCategorias(ids: string[], slugs: string[]): SQL {
  if (ids.length === 0 && slugs.length === 0) return sql`false`;
  const lista = slugs.length ? sql`${articles.secciones} ?| array[${sql.join(slugs.map((s) => sql`${s}`), sql`, `)}]::text[]` : undefined;
  const porId = ids.length ? inArray(articles.categoryId, ids) : undefined;
  return (or(porId, lista) ?? sql`false`) as SQL;
}

/** Lectura de una categoría con sus filtros, cacheada entre peticiones (cada combinación de filtros es una entrada). */
const leerCategoria = cachear(
  "categoria",
  async (categorySlug: string, filters: CategoryFilters): Promise<ListadoCategoria> => {
  const { limit = 20, offset = 0, subcategorySlug, dateFrom, dateTo, authorSlug, regionSlug, departamentoSlug } = filters;

  const [cat] = await db
    .select({ id: categories.id, name: categories.name, description: categories.description, parentId: categories.parentId })
    .from(categories)
    .where(eq(categories.slug, categorySlug))
    .limit(1);
  if (!cat) return { category: null, subcategories: [], items: [], total: 0 };
  const [madre] = cat.parentId ? await db.select({ slug: categories.slug }).from(categories).where(eq(categories.id, cat.parentId)).limit(1) : [];

  const children = await db
    .select({ id: categories.id, slug: categories.slug, name: categories.name })
    .from(categories)
    .where(eq(categories.parentId, cat.id))
    .orderBy(categories.sortOrder, categories.name);

  // Por defecto se listan los artículos de la categoría y de sus subcategorías
  // directas; si se pide una subcategoría concreta, se restringe a esa sola.
  let categoryIds = [cat.id, ...children.map((c) => c.id)];
  let seccionesSlugs = [categorySlug, ...children.map((c) => c.slug)];
  if (subcategorySlug) {
    const match = children.find((c) => c.slug === subcategorySlug);
    categoryIds = match ? [match.id] : [];
    seccionesSlugs = match ? [match.slug] : [];
  }

  const conditions = [publishedCondition, enCategorias(categoryIds, seccionesSlugs)];
  if (dateFrom) conditions.push(gte(articles.publishedAt, sql`${dateFrom}::date`));
  if (dateTo) conditions.push(lte(articles.publishedAt, sql`(${dateTo}::date + interval '1 day')`));
  if (authorSlug) conditions.push(sql`${articles.authorId} in (select id from authors where slug = ${authorSlug})`);
  const region = regionPorSlug(regionSlug);
  if (region) {
    const texto = sql`translate(lower(${articles.title} || ' ' || ${articles.excerpt} || ' ' || ${articles.tags}::text), 'áéíóúñ', 'aeioun')`;
    // La región que fija el editor al clasificar la nota manda; si no, se reconoce por lo que menciona el texto.
    conditions.push(or(sql`${articles.secciones} ? ${`region-${region.slug}`}`, ...region.terminos.map((t) => sql`${texto} like ${`%${t}%`}`)) as SQL);
  }
  const depto = departamentoPorSlug(departamentoSlug);
  if (depto) {
    const texto = sql`translate(lower(${articles.title} || ' ' || ${articles.excerpt} || ' ' || ${articles.tags}::text), 'áéíóúñ', 'aeioun')`;
    conditions.push(or(sql`${articles.secciones} ? ${`depto-${depto.slug}`}`, ...depto.terminos.map((t) => sql`${texto} like ${`%${t}%`}`)) as SQL);
  }
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
    category: { name: cat.name, description: cat.description, parentSlug: madre?.slug ?? null },
    subcategories: children,
    items,
    total: count,
  };
  },
  { tags: [TAG_CONTENIDO], segundos: 120 },
);

/** Autores con notas publicadas en una sección (y sus subsecciones), por nombre: alimentan el filtro «Nombre autor». */
const leerAutoresDeSeccion = cachear(
  "autores-seccion",
  async (categorySlug: string): Promise<{ slug: string; name: string }[]> => {
    const [cat] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, categorySlug)).limit(1);
    if (!cat) return [];
    const hijas = await db.select({ id: categories.id, slug: categories.slug }).from(categories).where(eq(categories.parentId, cat.id));
    const filas = await db
      .selectDistinct({ slug: authors.slug, name: authors.name })
      .from(articles)
      .innerJoin(authors, eq(articles.authorId, authors.id))
      .where(and(publishedCondition, enCategorias([cat.id, ...hijas.map((h) => h.id)], [categorySlug, ...hijas.map((h) => h.slug)])))
      .orderBy(authors.name);
    return filas;
  },
  { tags: [TAG_CONTENIDO], segundos: 600 },
);
export const getAutoresDeSeccion = (slug: string) => leerAutoresDeSeccion(slug);

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
  legacyPath: string | null;
  title: string;
  excerpt: string;
  body: string;
  metaTitle: string | null;
  metaDescription: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  /** Pie de foto de la portada, con su crédito. */
  coverImageCaption: string | null;
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
      legacyPath: articles.legacyPath,
      title: articles.title,
      excerpt: articles.excerpt,
      body: articles.body,
      metaTitle: articles.metaTitle,
      metaDescription: articles.metaDescription,
      coverImageUrl: articles.coverImageUrl,
      coverImageAlt: articles.coverImageAlt,
      coverImageCaption: articles.coverImageCaption,
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
      legacyPath: articles.legacyPath,
      title: articles.title,
      excerpt: articles.excerpt,
      body: articles.body,
      metaTitle: articles.metaTitle,
      metaDescription: articles.metaDescription,
      coverImageUrl: articles.coverImageUrl,
      coverImageAlt: articles.coverImageAlt,
      coverImageCaption: articles.coverImageCaption,
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

// Subsecciones de cada sección de primer nivel (por slug del padre), en su orden, leídas de la caché de datos (5 minutos).
const leerHijasDelMenu = cachear(
  "menu-hijas",
  async (): Promise<Record<string, { slug: string; name: string }[]>> => {
    const filas = await db
      .select({ id: categories.id, slug: categories.slug, name: categories.name, parentId: categories.parentId })
      .from(categories)
      .orderBy(categories.sortOrder, categories.name);
    const slugDe = new Map(filas.map((f) => [f.id, f.slug]));
    const salida: Record<string, { slug: string; name: string }[]> = {};
    for (const f of filas) {
      const padre = f.parentId ? slugDe.get(f.parentId) : undefined;
      if (padre) (salida[padre] ??= []).push({ slug: f.slug, name: f.name });
    }
    return salida;
  },
  { tags: [TAG_CONTENIDO], segundos: 300 },
);
/** Subsecciones de cada sección de primer nivel: alimentan los menús desplegables de la barra de navegación. */
export const getNavChildren = cache(() => leerHijasDelMenu());

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


/** Dirección (slug) de la nota publicada cuya dirección original del sitio anterior es `ruta` (`/seccion/titulo`); null si no hay. */
export async function getSlugPorRutaOriginal(ruta: string): Promise<string | null> {
  const [row] = await db
    .select({ slug: articles.slug })
    .from(articles)
    .where(and(eq(articles.legacyPath, ruta), publishedCondition))
    .limit(1);
  return row?.slug ?? null;
}
