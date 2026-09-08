import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
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
  score: number;
};

const K = 60; // constante RRF

export async function hybridSearch(query: string, limit = 20): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const queryVec = await embed(q);
  const vecLiteral = queryVec ? toVectorLiteral(queryVec) : null;

  // Un solo round-trip: CTEs para cada señal y fusión RRF en SQL.
  const rows = await db.execute<{
    kind: "articulo" | "archivo";
    id: string;
    title: string;
    summary: string;
    url: string;
    published_at: string | null;
    score: number;
  }>(sql`
    WITH params AS (
      SELECT
        ${q} AS q,
        ${vecLiteral}::text AS vec
    ),
    lexical AS (
      SELECT 'articulo'::text AS kind, a.id::text AS id, a.title,
             a.excerpt AS summary, '/articulo/' || a.slug AS url,
             a.published_at,
             ts_rank(
               to_tsvector('spanish', a.title || ' ' || a.excerpt || ' ' || a.body),
               websearch_to_tsquery('spanish', (SELECT q FROM params))
             ) AS rank
      FROM articles a
      WHERE a.status = 'publicado'
        AND to_tsvector('spanish', a.title || ' ' || a.excerpt || ' ' || a.body)
            @@ websearch_to_tsquery('spanish', (SELECT q FROM params))
      UNION ALL
      SELECT 'archivo'::text, ar.external_id, ar.title, ar.summary,
             ar.canonical_url, ar.published_at,
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
             a.embedding <=> (SELECT vec FROM params)::vector AS dist
      FROM articles a
      WHERE a.status = 'publicado' AND a.embedding IS NOT NULL
        AND (SELECT vec FROM params) IS NOT NULL
      UNION ALL
      SELECT 'archivo'::text, ar.external_id, ar.title, ar.summary,
             ar.canonical_url, ar.published_at,
             ar.embedding <=> (SELECT vec FROM params)::vector AS dist
      FROM archive_index ar
      WHERE ar.embedding IS NOT NULL AND (SELECT vec FROM params) IS NOT NULL
    ),
    semantic_ranked AS (
      SELECT *, row_number() OVER (ORDER BY dist ASC) AS rn FROM semantic LIMIT 50
    ),
    fused AS (
      SELECT kind, id, title, summary, url, published_at,
             SUM(w) AS score
      FROM (
        SELECT kind, id, title, summary, url, published_at,
               1.0 / (${K} + rn) AS w FROM lexical_ranked
        UNION ALL
        SELECT kind, id, title, summary, url, published_at,
               1.0 / (${K} + rn) AS w FROM semantic_ranked
      ) s
      GROUP BY kind, id, title, summary, url, published_at
    )
    SELECT kind, id, title, summary, url, published_at, score
    FROM fused
    ORDER BY score DESC
    LIMIT ${limit}
  `);

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    kind: r.kind as "articulo" | "archivo",
    id: String(r.id),
    title: String(r.title),
    summary: String(r.summary ?? ""),
    url: String(r.url),
    publishedAt: r.published_at ? new Date(r.published_at as string).toISOString() : null,
    score: Number(r.score),
  }));
}

/** Contenido relacionado para la página de artículo (mismo índice unificado). */
export async function relatedContent(
  seedText: string,
  excludeArticleId: string,
  limit = 5,
): Promise<SearchHit[]> {
  const hits = await hybridSearch(seedText, limit + 3);
  return hits.filter((h) => !(h.kind === "articulo" && h.id === excludeArticleId)).slice(0, limit);
}
