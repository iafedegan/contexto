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

let embeddingsMemo: { hay: boolean; hasta: number } | null = null;
/** ¿Hay alguna nota con embedding? Se recuerda 10 minutos por instancia (la consulta recorre la tabla si no hay ninguna). */
async function hayEmbeddings(): Promise<boolean> {
  if (embeddingsMemo && embeddingsMemo.hasta > Date.now()) return embeddingsMemo.hay;
  try {
    const f = rowsOf(await db.execute(sql`select 1 as x from articles where embedding is not null limit 1`));
    embeddingsMemo = { hay: f.length > 0, hasta: Date.now() + 10 * 60_000 };
  } catch {
    return true; // ante la duda, se comporta como antes
  }
  return embeddingsMemo.hay;
}

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
export function toOrQuery(input: string): string {
  const sinTilde = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const palabras = input
    .toLowerCase()
    .replace(/[^a-z0-9ñáéíóúü\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(sinTilde(w)));
  // El diccionario en español solo reduce bien a su raíz las palabras CON tilde («vacunación» → «vacun»; «vacunacion» se queda entera y no
  // encuentra nada): quien escribe sin tildes (o con un error) recibe también la forma con tilde de las terminaciones habituales.
  const salida = new Set<string>();
  for (const w of palabras) {
    salida.add(w);
    if (/[a-z]ion$/.test(w)) salida.add(w.replace(/ion$/, "ión"));
    if (/[a-z](ia|io)$/.test(w)) salida.add(w.replace(/(ia|io)$/, (m) => (m === "ia" ? "ía" : "ío")));
  }
  return [...salida].join(" or ");
}

// Búsqueda híbrida: mezcla similitud vectorial y texto completo en español sobre las notas propias y el archivo histórico, en una sola consulta SQL.
export async function hybridSearch(query: string, limit = 20, opciones: { semantico?: boolean; terminosExtra?: string[] } = {}): Promise<SearchHit[]> {
  // `terminosExtra`: sinónimos y términos del sector que una IA barata propone para la pregunta (ver `expandirConsulta`): se suman a las palabras de la
  // pregunta SOLO en la parte de texto completo, así una nota que dice «ganado gordo» aparece aunque el lector escribiera «novillo».
  const q = toOrQuery([query, ...(opciones.terminosExtra ?? [])].join(" "));
  if (!q) return [];

  // El embedding se calcula sobre la pregunta ORIGINAL, no sobre `q`: la lista «palabra or palabra» sin acentos ni palabras
  // vacías sirve para el texto completo, pero le quita al modelo justo lo que entiende (el orden, los matices, las
  // palabras que unen) y empeoraba la parte semántica (H-16).
  // Sin notas con embedding (o si quien llama solo quiere texto, como las «notas relacionadas») no se paga la llamada al proveedor de embeddings:
  // con el archivo migrado aún sin vectores, cada página nueva esperaba ~medio segundo a una API cuyo resultado no se usaba.
  const queryVec = opciones.semantico === false || !(await hayEmbeddings()) ? null : await embed(query);
  const vecLiteral = queryVec ? toVectorLiteral(queryVec) : null;

  // Un solo round-trip: CTEs para cada señal y fusión RRF en SQL.
  const rows = rowsOf(await db.execute(sql`
    WITH params AS (
      SELECT
        ${q} AS q,
        ${vecLiteral}::text AS vec,
        websearch_to_tsquery('spanish', ${q}) AS qry
    ),
    -- Candidatos del texto completo: se leen del índice sobre \`search_vec\` (ya calculado) y, si una consulta muy general coincide con
    -- decenas de miles de notas, se ordenan solo las 5.000 más recientes. Sin este tope, puntuar todas tardaba segundos con el archivo completo.
    candidatas AS (
      SELECT a.id
      FROM articles a, params p
      WHERE a.status = 'publicado' AND a.search_vec @@ p.qry
      ORDER BY a.published_at DESC NULLS LAST
      LIMIT 5000
    ),
    lexical AS (
      SELECT 'articulo'::text AS kind, a.id::text AS id, a.title,
             a.excerpt AS summary, coalesce(a.legacy_path, '/articulo/' || a.slug) AS url,
             a.published_at, a.cover_image_url AS image,
             c.slug AS category_slug, c.name AS category_name,
             ts_rank(a.search_vec, p.qry) AS rank
      FROM candidatas
      JOIN articles a ON a.id = candidatas.id
      LEFT JOIN categories c ON c.id = a.category_id
      CROSS JOIN params p
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
      -- ORDER BY rn antes del LIMIT: sin él, Postgres no garantiza que las 50 filas sean las mejores.
      SELECT *, row_number() OVER (ORDER BY rank DESC, id) AS rn FROM lexical ORDER BY rn LIMIT 50
    ),
    semantic AS (
      SELECT 'articulo'::text AS kind, a.id::text AS id, a.title,
             a.excerpt AS summary, coalesce(a.legacy_path, '/articulo/' || a.slug) AS url, a.published_at,
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
      SELECT *, row_number() OVER (ORDER BY dist ASC, id) AS rn FROM semantic ORDER BY rn LIMIT 50
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
    -- Las notas recientes pesan más: a igual coincidencia, la de hace un mes gana a la de hace diez años (hasta +80 %, decayendo con los años).
    ORDER BY score * (1 + 0.8 / (1 + coalesce(extract(epoch FROM now() - published_at), 0) / 31557600.0)) DESC
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
  const hits = await hybridSearch(seedText, limit + 3, { semantico: false });
  let out = hits.filter((h) => !(h.kind === "articulo" && h.id === excludeArticleId)).slice(0, limit);

  // Respaldo por categoría cuando la búsqueda no arroja suficientes resultados.
  if (out.length < 3 && fallbackCategorySlug) {
    const rows = rowsOf(await db.execute(sql`
      SELECT a.id::text AS id, a.title, a.excerpt AS summary,
             coalesce(a.legacy_path, '/articulo/' || a.slug) AS url, a.published_at,
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

/**
 * Último recurso cuando el texto completo no encuentra nada, casi siempre por un error de escritura («vaxunacion» por «vacunación»):
 * se comparan las palabras de la pregunta con los títulos por parecido de letras (pg_trgm). Solo se usa sin resultados: recorre los títulos.
 */
export async function buscarParecidas(query: string, limit = 8): Promise<SearchHit[]> {
  const palabras = toOrQuery(query).split(" or ").filter(Boolean).slice(0, 3);
  if (!palabras.length) return [];
  const rows = rowsOf(await db.execute(sql`
    SELECT a.id::text AS id, a.title, a.excerpt AS summary, coalesce(a.legacy_path, '/articulo/' || a.slug) AS url,
           a.published_at, a.cover_image_url AS image, c.slug AS category_slug, c.name AS category_name,
           max(word_similarity(w, translate(lower(a.title), 'áéíóúü', 'aeiouu'))) AS score
    FROM articles a
    LEFT JOIN categories c ON c.id = a.category_id
    CROSS JOIN unnest(${palabras}::text[]) AS w
    WHERE a.status = 'publicado' AND word_similarity(w, translate(lower(a.title), 'áéíóúü', 'aeiouu')) >= 0.5
    GROUP BY a.id, a.title, a.excerpt, a.legacy_path, a.slug, a.published_at, a.cover_image_url, c.slug, c.name
    ORDER BY score DESC, a.published_at DESC NULLS LAST
    LIMIT ${limit}
  `));
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    kind: "articulo" as const,
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

/**
 * Búsqueda por palabra clave, de lo más NUEVO a lo más viejo: las notas publicadas que contienen TODAS las palabras de la consulta (con su
 * forma con tilde, ver `toOrQuery`), ordenadas por fecha. Es determinista y no depende de ninguna IA: «ciclo vacunas» trae primero el ciclo
 * de vacunación de esta semana. Si la consulta tiene más de 5 palabras (una pregunta larga, no una palabra clave) o ninguna nota las tiene todas,
 * devuelve `[]` y manda el buscador por relevancia.
 */
export async function buscarRecientes(query: string, limit = 6): Promise<SearchHit[]> {
  const grupos = toOrQuery(query).split(" or ");
  // Cada palabra con su variante con tilde forma un grupo «a or b»; los grupos se unen con AND.
  const palabras = [...new Set(query.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9ñ\s]/g, " ").split(/\s+/).filter((w) => w.length >= 3))].filter((w) => grupos.some((g) => g.normalize("NFD").replace(/\p{Diacritic}/gu, "") === w));
  if (!palabras.length || palabras.length > 5) return [];
  // Solo letras y números (sin operadores): se arma con la sintaxis de `to_tsquery`, donde «&» une las palabras y «|» sus variantes.
  const consulta = palabras.map((w) => `(${toOrQuery(w).split(" or ").join(" | ")})`).join(" & ");
  const rows = rowsOf(await db.execute(sql`
    SELECT a.id::text AS id, a.title, a.excerpt AS summary, coalesce(a.legacy_path, '/articulo/' || a.slug) AS url,
           a.published_at, a.cover_image_url AS image, c.slug AS category_slug, c.name AS category_name
    FROM articles a
    LEFT JOIN categories c ON c.id = a.category_id
    WHERE a.status = 'publicado' AND a.search_vec @@ to_tsquery('spanish', ${consulta})
    ORDER BY a.published_at DESC NULLS LAST
    LIMIT ${limit}
  `));
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    kind: "articulo" as const,
    id: String(r.id),
    title: String(r.title),
    summary: String(r.summary ?? ""),
    url: String(r.url),
    publishedAt: r.published_at ? new Date(r.published_at as string).toISOString() : null,
    image: (r.image as string | null) ?? null,
    categorySlug: (r.category_slug as string | null) ?? null,
    categoryName: (r.category_name as string | null) ?? null,
    score: 1,
  }));
}
