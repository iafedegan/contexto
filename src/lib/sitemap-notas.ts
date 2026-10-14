import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors, categories } from "@/db/schema";
import { siteUrl } from "@/lib/utils";
import { escapeXml as esc } from "@/lib/escape";

/**
 * Mapas del sitio para buscadores. Con decenas de miles de notas un solo archivo no cabe (Google admite 50.000 direcciones o 50 MB por
 * archivo): hay un ÍNDICE en `/sitemap.xml` (la misma dirección que usaba el sitio anterior, así Search Console no pierde nada) y un archivo
 * para las páginas generales más uno por cada tanda de notas. Las notas se reparten por fecha de publicación de la más antigua a la más
 * nueva, de modo que las tandas viejas casi nunca cambian y solo la última crece.
 */

/** Notas por archivo: lejos del tope de 50.000 y cada archivo se arma rápido. */
export const NOTAS_POR_MAPA = 10_000;

// Notas ya publicadas (las programadas a futuro aún no existen para los buscadores).
const publicadas = and(eq(articles.status, "publicado"), sql`${articles.publishedAt} <= now()`);

/** Cuántos archivos de notas hacen falta hoy. */
export async function cantidadDeMapasDeNotas(): Promise<number> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(articles).where(publicadas);
  return Math.ceil(n / NOTAS_POR_MAPA);
}

/** Tanda `numero` (desde 1) de notas: dirección y última modificación. */
export async function notasDelMapa(numero: number): Promise<{ slug: string; updatedAt: Date }[]> {
  return db
    .select({ slug: articles.slug, updatedAt: articles.updatedAt })
    .from(articles)
    .where(publicadas)
    .orderBy(asc(articles.publishedAt), asc(articles.id))
    .limit(NOTAS_POR_MAPA)
    .offset((numero - 1) * NOTAS_POR_MAPA);
}

/** Páginas generales: portada, secciones y autores con notas. */
export async function paginasDelMapa(): Promise<{ url: string; cambio: string; prioridad: number }[]> {
  const [cats, autores] = await Promise.all([
    db.select({ slug: categories.slug }).from(categories).orderBy(categories.sortOrder, categories.name),
    db
      .selectDistinct({ slug: authors.slug })
      .from(authors)
      .innerJoin(articles, and(eq(articles.authorId, authors.id), publicadas))
      .orderBy(authors.slug),
  ]);
  return [
    { url: siteUrl("/"), cambio: "hourly", prioridad: 1 },
    { url: siteUrl("/observatorio"), cambio: "weekly", prioridad: 0.5 },
    { url: siteUrl("/asistente"), cambio: "monthly", prioridad: 0.3 },
    ...cats.map((c) => ({ url: siteUrl(`/categoria/${c.slug}`), cambio: "daily", prioridad: 0.6 })),
    ...autores.map((a) => ({ url: siteUrl(`/autor/${a.slug}`), cambio: "weekly", prioridad: 0.4 })),
  ];
}

/** XML de un archivo de direcciones. */
export function xmlDeDirecciones(items: { url: string; fecha?: Date; cambio?: string; prioridad?: number }[]): string {
  const filas = items
    .map(
      (i) =>
        `  <url><loc>${esc(i.url)}</loc>${i.fecha ? `<lastmod>${i.fecha.toISOString()}</lastmod>` : ""}${i.cambio ? `<changefreq>${i.cambio}</changefreq>` : ""}${i.prioridad !== undefined ? `<priority>${i.prioridad}</priority>` : ""}</url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${filas}\n</urlset>\n`;
}

/** XML del índice que reúne los demás mapas. */
export function xmlDeIndice(mapas: { url: string; fecha?: Date }[]): string {
  const filas = mapas.map((m) => `  <sitemap><loc>${esc(m.url)}</loc>${m.fecha ? `<lastmod>${m.fecha.toISOString()}</lastmod>` : ""}</sitemap>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${filas}\n</sitemapindex>\n`;
}
