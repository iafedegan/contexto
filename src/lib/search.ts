import "server-only";
import { sql } from "drizzle-orm";
import { db, rowsOf } from "@/db";
import { embed, toVectorLiteral } from "./embeddings";

/**
 * Búsqueda híbrida sobre un índice UNIFICADO: `articles` (propios, publicados) +
 * `archive_index` (espejo de solo lectura del archivo histórico).
 *
 * El usuario final no distingue el origen. Combina:
 *  - similitud vectorial (pgvector, coseno) cuando hay embedding de la consulta
 *  - full-text en español (to_tsvector) como respaldo y refuerzo
 *
 * Reciprocal Rank Fusion (RRF) simple para mezclar ambos rankings.
 */

export type SearchHit = {
  kind: "articulo" | "archivo";
  id: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: string | null;
  /** Miniatura del resultado (B-02). El archivo histórico no la expone. */
  image: string | null;
  /** Sección, para el filtro y el contexto del resultado. */
  categorySlug: string | null;
  categoryName: string | null;
  score: number;
};

// Constante de la fusión por rangos recíprocos (RRF) que mezcla los dos rankings.
const K = 60; // constante RRF

// Palabras vacías frecuentes en preguntas en español (no aportan a la búsqueda).
const STOPWORDS = new Set(
  "el la los las un una unos unas de del a al y o u en con por para que como cual cuales donde cuando cuanto cuanta cuantos cuantas se su sus mi mis tu tus lo le les es son está están va van hay muy más menos sobre entre desde hasta este esta estos estas ese esa esos esas".split(
    " ",
  ),
);

/**
 * Convierte una pregunta en lenguaje natural en una consulta OR para
 * `websearch_to_tsquery` (que entiende la palabra clave `or`). Así "¿cómo van
 * los precios del novillo en Medellín?" recupera artículos que contengan
 * cualquiera de los términos significativos.
 */
function toOrQuery(input: string): string {
  const words = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return [...new Set(words)].join(" or ");
}

// Búsqueda híbrida: mezcla similitud vectorial y texto completo en español sobre las notas propias y el archivo histórico, en una sola consulta SQL.
export async function hybridSearch(query: string, limit = 20): Promise<SearchHit[]> {
  const q = toOrQuery(query);
  if (!q) return [];

  const queryVec = await embed(q);
  const vecLiteral = queryVec ? toVectorLiteral(queryVec) : null;

  // Un solo round-trip: CTEs para cada señal y fusión RRF en SQL.
  const rows = rowsOf(await db.execute(sql`
    WITH params AS (
      SELECT
        ${q} AS q,
        ${vecLiteral}::text AS vec
    ),
    lexical AS (
      SELECT 'articulo'::text AS kind, a.id::text AS id, a.title,
             a.excerpt AS summary, '/articulo/' || a.slug AS url,
             a.published_at, a.cover_image_url AS image,
             c.slug AS category_slug, c.name AS category_name,
             ts_rank(
               to_tsvector('spanish', a.title || ' ' || a.excerpt || ' ' || a.body),
               websearch_to_tsquery('spanish', (SELECT q FROM params))
             ) AS rank
      FROM articles a
      LEFT JOIN categories c ON c.id = a.category_id
      WHERE a.status = 'publicado'
        AND to_tsvector('spanish', a.title || ' ' || a.excerpt || ' ' || a.body)
            @@ websearch_to_tsquery('spanish', (SELECT q FROM params))
      UNION ALL
      SELECT 'archivo'::text, ar.external_id, ar.title, ar.summary,
             ar.canonical_url, ar.published_at, NULL::text, NULL::text, NULL::text,
             ts_rank(
               to_tsvector('spanish', ar.title || ' ' || ar.summary),
               websearch_to_tsquery('spanish', (SELECT q FROM params))
             ) AS rank
      FROM archive_index ar
      WHERE to_tsvector('spanish', ar.title || ' ' || ar.summary)
            @@ websearch_to_tsquery('spanish', (SELECT q FROM params))
    ),
    lexical_ranked AS (
      SELECT *, row_number() OVER (ORDER BY rank DESC) AS rn FROM lexical LIMIT 50
    ),
    semantic AS (
      SELECT 'articulo'::text AS kind, a.id::text AS id, a.title,
             a.excerpt AS summary, '/articulo/' || a.slug AS url, a.published_at,
             a.cover_image_url AS image, c.slug AS category_slug, c.name AS category_name,
             a.embedding <=> (SELECT vec FROM params)::vector AS dist
      FROM articles a
      LEFT JOIN categories c ON c.id = a.category_id
      WHERE a.status = 'publicado' AND a.embedding IS NOT NULL
        AND (SELECT vec FROM params) IS NOT NULL
      UNION ALL
      SELECT 'archivo'::text, ar.external_id, ar.title, ar.summary,
             ar.canonical_url, ar.published_at, NULL::text, NULL::text, NULL::text,
             ar.embedding <=> (SELECT vec FROM params)::vector AS dist
      FROM archive_index ar
      WHERE ar.embedding IS NOT NULL AND (SELECT vec FROM params) IS NOT NULL
    ),
    semantic_ranked AS (
      SELECT *, row_number() OVER (ORDER BY dist ASC) AS rn FROM semantic LIMIT 50
    ),
    fused AS (
      SELECT kind, id, title, summary, url, published_at, image, category_slug, category_name,
             SUM(w) AS score
      FROM (
        SELECT kind, id, title, summary, url, published_at, image, category_slug, category_name,
               1.0 / (${K} + rn) AS w FROM lexical_ranked
        UNION ALL
        SELECT kind, id, title, summary, url, published_at, image, category_slug, category_name,
               1.0 / (${K} + rn) AS w FROM semantic_ranked
      ) s
      GROUP BY kind, id, title, summary, url, published_at, image, category_slug, category_name
    )
    SELECT kind, id, title, summary, url, published_at, image, category_slug, category_name, score
    FROM fused
    ORDER BY score DESC
    LIMIT ${limit}
  `));

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    kind: r.kind as "articulo" | "archivo",
    id: String(r.id),
    title: String(r.title),
    summary: String(r.summary ?? ""),
    url: String(r.url),
    publishedAt: r.published_at ? new Date(r.published_at as string).toISOString() : null,
    image: (r.image as string | null) ?? null,
    categorySlug: (r.category_slug as string | null) ?? null,
    categoryName: (r.category_name as string | null) ?? null,
    score: Number(r.score),
  }));
}

/** Contenido relacionado para la página de artículo (mismo índice unificado). */
export async function relatedContent(
  seedText: string,
  excludeArticleId: string,
  limit = 5,
  fallbackCategorySlug?: string | null,
): Promise<SearchHit[]> {
  const hits = await hybridSearch(seedText, limit + 3);
  let out = hits.filter((h) => !(h.kind === "articulo" && h.id === excludeArticleId)).slice(0, limit);

  // Respaldo por categoría cuando la búsqueda no arroja suficientes resultados.
  if (out.length < 3 && fallbackCategorySlug) {
    const rows = rowsOf(await db.execute(sql`
      SELECT a.id::text AS id, a.title, a.excerpt AS summary,
             '/articulo/' || a.slug AS url, a.published_at,
             a.cover_image_url AS image, c.slug AS category_slug, c.name AS category_name
      FROM articles a
      JOIN categories c ON c.id = a.category_id
      WHERE c.slug = ${fallbackCategorySlug}
        AND a.status = 'publicado'
        AND a.id <> ${excludeArticleId}::uuid
      ORDER BY a.published_at DESC
      LIMIT ${limit}
    `));
    const extra: SearchHit[] = (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
      kind: "articulo" as const,
      id: String(r.id),
      title: String(r.title),
      summary: String(r.summary ?? ""),
      url: String(r.url),
      publishedAt: r.published_at ? new Date(r.published_at as string).toISOString() : null,
      image: (r.image as string | null) ?? null,
      categorySlug: (r.category_slug as string | null) ?? null,
      categoryName: (r.category_name as string | null) ?? null,
      score: 0,
    }));
    const seen = new Set(out.map((h) => h.url));
    out = [...out, ...extra.filter((h) => !seen.has(h.url))].slice(0, limit);
  }
  return out;
}
