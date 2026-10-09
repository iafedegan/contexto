import { and, eq, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { articles, authors, categories } from "@/db/schema";
import { guardApi, json, CORS_HEADERS } from "@/lib/api/guard";
import { getBreakingArticle, getMostReadArticles, getPosicionesPortada } from "@/lib/content";
import { armarUbicacion } from "@/lib/ubicacion-nota";

// Se calcula en cada petición, nunca durante la compilación.
export const dynamic = "force-dynamic";

// La sección de la que cuelga una subsección.
const padre = alias(categories, "categoria_padre");

/** GET /api/v1/articulos/{slug} — una nota publicada, con su cuerpo completo y su `ubicacion`. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.res;

  const { slug } = await params;
  const [a] = await db
    .select({
      slug: articles.slug,
      title: articles.title,
      excerpt: articles.excerpt,
      body: articles.body,
      coverImageUrl: articles.coverImageUrl,
      coverImageAlt: articles.coverImageAlt,
      categoria: categories.slug,
      autor: authors.name,
      etiquetas: articles.tags,
      publicadoEn: articles.publishedAt,
      actualizadoEn: articles.updatedAt,
      categoriaNombre: categories.name,
      padreSlug: padre.slug,
      padreNombre: padre.name,
      isBreaking: articles.isBreaking,
      isLive: articles.isLive,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(padre, eq(categories.parentId, padre.id))
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .where(and(eq(articles.slug, slug), eq(articles.status, "publicado"), lte(articles.publishedAt, sql`now()`)))
    .limit(1);

  if (!a) return json({ error: "not_found", message: "No existe una nota publicada con ese slug." }, { status: 404 });
  const { categoriaNombre, padreSlug, padreNombre, isBreaking, isLive, ...nota } = a;
  const [posiciones, masLeidas, enBarra] = await Promise.all([
    getPosicionesPortada(),
    getMostReadArticles(5).catch(() => []),
    getBreakingArticle().catch(() => null),
  ]);
  return json({
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
  });
}

// Respuesta a la comprobación previa de CORS de los navegadores.
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
