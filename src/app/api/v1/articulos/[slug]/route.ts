import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors, categories } from "@/db/schema";
import { guardApi, json, CORS_HEADERS } from "@/lib/api/guard";

// Se calcula en cada petición, nunca durante la compilación.
export const dynamic = "force-dynamic";

/** GET /api/v1/articulos/{slug} — una nota publicada, con su cuerpo completo. */
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
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .where(and(eq(articles.slug, slug), eq(articles.status, "publicado"), lte(articles.publishedAt, sql`now()`)))
    .limit(1);

  if (!a) return json({ error: "not_found", message: "No existe una nota publicada con ese slug." }, { status: 404 });
  return json(a);
}

// Respuesta a la comprobación previa de CORS de los navegadores.
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
