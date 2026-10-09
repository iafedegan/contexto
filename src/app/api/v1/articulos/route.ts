import { and, desc, eq, inArray, lt, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { articles, authors, categories } from "@/db/schema";
import { guardApi, json, CORS_HEADERS } from "@/lib/api/guard";
import { getBreakingArticle, getMostReadArticles, getPosicionesPortada } from "@/lib/content";
import { armarUbicacion } from "@/lib/ubicacion-nota";

// Se calcula en cada petición, nunca durante la compilación.
export const dynamic = "force-dynamic";

// Condición SQL: nota publicada y ya vigente.
const published = and(eq(articles.status, "publicado"), lte(articles.publishedAt, sql`now()`));

// La sección de la que cuelga una subsección.
const padre = alias(categories, "categoria_padre");

// Campos que expone la API de cada nota (más lo que hace falta para armar `ubicacion`).
const row = {
  slug: articles.slug,
  title: articles.title,
  excerpt: articles.excerpt,
  coverImageUrl: articles.coverImageUrl,
  categoria: categories.slug,
  autor: authors.name,
  publicadoEn: articles.publishedAt,
  actualizadoEn: articles.updatedAt,
  categoriaNombre: categories.name,
  padreSlug: padre.slug,
  padreNombre: padre.name,
  isBreaking: articles.isBreaking,
  isLive: articles.isLive,
};

/**
 * GET /api/v1/articulos — listado paginado de notas publicadas, más recientes
 * primero. `categoria` filtra por slug de categoría; `cursor` es la fecha de
 * publicación (ISO) del último artículo recibido, para pedir la página
 * siguiente sin que se muevan los resultados si entra una nota nueva.
 * `portada=1` devuelve las notas que están hoy en la portada, en el orden de la portada.
 * Cada nota trae `ubicacion`: dónde está (portada, sección, última hora, en vivo, más leídas).
 */
export async function GET(req: Request) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.res;

  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limite")) || 20));
  const categoria = url.searchParams.get("categoria");
  const cursor = url.searchParams.get("cursor");

  const soloPortada = url.searchParams.get("portada") === "1";

  // Lo que se consulta una vez por petición (todo cacheado): hueco en la portada, más leídas y la nota de la barra roja.
  const [posiciones, masLeidas, enBarra] = await Promise.all([
    getPosicionesPortada(),
    getMostReadArticles(5).catch(() => []),
    getBreakingArticle().catch(() => null),
  ]);

  // Portada vacía (sin notas publicadas): no hay nada que devolver, y `IN ()` no es una consulta válida.
  if (soloPortada && posiciones.size === 0) return json({ items: [], siguienteCursor: null });

  const where = and(
    published,
    categoria ? eq(categories.slug, categoria) : undefined,
    soloPortada ? inArray(articles.slug, [...posiciones.keys()]) : undefined,
    !soloPortada && cursor && !Number.isNaN(Date.parse(cursor)) ? lt(articles.publishedAt, new Date(cursor)) : undefined,
  );

  const rows = await db
    .select(row)
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(padre, eq(categories.parentId, padre.id))
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .where(where)
    .orderBy(desc(articles.publishedAt))
    .limit(soloPortada ? posiciones.size || 1 : limit + 1);

  // En la portada se devuelven en el orden de la portada, no por fecha.
  if (soloPortada) rows.sort((a, b) => (posiciones.get(a.slug)?.posicion ?? 99) - (posiciones.get(b.slug)?.posicion ?? 99));

  const hayMas = !soloPortada && rows.length > limit;
  const items = (soloPortada ? rows : rows.slice(0, limit)).map(({ categoriaNombre, padreSlug, padreNombre, isBreaking, isLive, ...nota }) => ({
    ...nota,
    ubicacion: armarUbicacion({
      categoria: nota.categoria ? { slug: nota.categoria, nombre: categoriaNombre ?? nota.categoria } : null,
      padre: padreSlug ? { slug: padreSlug, nombre: padreNombre ?? padreSlug } : null,
      portada: posiciones.get(nota.slug),
      marcadaUltimaHora: isBreaking,
      enBarra: enBarra?.slug === nota.slug,
      enVivo: isLive,
      masLeidas: masLeidas.findIndex((m) => m.slug === nota.slug) + 1 || undefined,
    }),
  }));
  return json({
    items,
    siguienteCursor: hayMas ? items[items.length - 1]?.publicadoEn : null,
  });
}

// Respuesta a la comprobación previa de CORS de los navegadores.
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
