import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, categories } from "@/db/schema";
import { getSiteIdentity } from "@/lib/site-identity";
import { siteUrl } from "@/lib/utils";
import { escapeXml as esc } from "@/lib/escape";

/**
 * Sitemap de Google News (SEO-07).
 *
 * El formato es distinto del sitemap normal: solo admite lo publicado en las
 * últimas 48 horas y exige nombre de publicación, idioma y fecha exacta. Un
 * sitemap general no sirve para News, por eso va en su propia ruta.
 */
export const dynamic = "force-dynamic";

// Mapa del sitio para Google Noticias: notas de las últimas 48 horas.
export async function GET() {
  const identity = await getSiteIdentity().catch(() => null);
  const nombre = identity?.name ?? "CONtexto Ganadero";

  let filas: { slug: string; title: string; publishedAt: Date | null; categoryName: string | null }[] = [];
  try {
    filas = await db
      .select({
        slug: articles.slug,
        title: articles.title,
        publishedAt: articles.publishedAt,
        categoryName: categories.name,
      })
      .from(articles)
      .leftJoin(categories, eq(articles.categoryId, categories.id))
      .where(
        and(
          eq(articles.status, "publicado"),
          sql`${articles.publishedAt} <= now()`,
          gte(articles.publishedAt, sql`now() - interval '48 hours'`),
        ),
      )
      .orderBy(desc(articles.publishedAt))
      .limit(1000);
  } catch {
    filas = [];
  }

  const items = filas
    .map((a) => {
      const fecha = (a.publishedAt ?? new Date()).toISOString();
      return `  <url>
    <loc>${esc(siteUrl(`/articulo/${a.slug}`))}</loc>
    <news:news>
      <news:publication>
        <news:name>${esc(nombre)}</news:name>
        <news:language>es</news:language>
      </news:publication>
      <news:publication_date>${fecha}</news:publication_date>
      <news:title>${esc(a.title)}</news:title>
    </news:news>
  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${items}
</urlset>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
