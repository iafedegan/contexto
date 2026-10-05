import { and, desc, eq, lt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors, categories } from "@/db/schema";
import { guardApi, json, CORS_HEADERS } from "@/lib/api/guard";

// Se calcula en cada petición, nunca durante la compilación.
export const dynamic = "force-dynamic";

// Condición SQL: nota publicada y ya vigente.
const published = and(eq(articles.status, "publicado"), lte(articles.publishedAt, sql`now()`));

// Campos que expone la API de cada nota.
const row = {
  slug: articles.slug,
  title: articles.title,
  excerpt: articles.excerpt,
  coverImageUrl: articles.coverImageUrl,
  categoria: categories.slug,
  autor: authors.name,
  publicadoEn: articles.publishedAt,
  actualizadoEn: articles.updatedAt,
};

/**
 * GET /api/v1/articulos — listado paginado de notas publicadas, más recientes
 * primero. `categoria` filtra por slug de categoría; `cursor` es la fecha de
 * publicación (ISO) del último artículo recibido, para pedir la página
 * siguiente sin que se muevan los resultados si entra una nota nueva.
 */
export async function GET(req: Request) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.res;

  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limite")) || 20));
  const categoria = url.searchParams.get("categoria");
  const cursor = url.searchParams.get("cursor");

  const where = and(
    published,
    categoria ? eq(categories.slug, categoria) : undefined,
    cursor && !Number.isNaN(Date.parse(cursor)) ? lt(articles.publishedAt, new Date(cursor)) : undefined,
  );

  const rows = await db
    .select(row)
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .where(where)
    .orderBy(desc(articles.publishedAt))
    .limit(limit + 1);

  const hayMas = rows.length > limit;
  const items = rows.slice(0, limit);
  return json({
    items,
    siguienteCursor: hayMas ? items[items.length - 1]?.publicadoEn : null,
  });
}

// Respuesta a la comprobación previa de CORS de los navegadores.
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
