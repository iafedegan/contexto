import "server-only";
import { and, desc, eq, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors, categories } from "@/db/schema";
import { env } from "@/lib/env";
import { siteUrl } from "@/lib/utils";
import { escapeXml as esc } from "@/lib/escape";

/**
 * Feeds RSS 2.0 del sitio: el general (/feed.xml) y uno por sección
 * (/categoria/<slug>/feed.xml).
 *
 * Solo llevan el RESUMEN, no el cuerpo: el texto completo en un feed es la
 * forma más fácil de copiar el contenido (y los feeds no pasan por el
 * bloqueo anti-scraping de src/proxy.ts). Para leer la nota hay que abrirla.
 * Sí llevan la foto de portada (media:content + enclosure) y el autor
 * (dc:creator), para que el lector RSS muestre una tarjeta atractiva.
 */

const ITEMS = 40;

/**
 * Enlace de una nota tal como va en el feed: con UTM (`utm_source=rss`) para que, al abrirla desde el lector, la
 * lectura se cuente como «Lector RSS» y no como «Directo» (Feedly y casi todos los lectores no envían referente).
 * El `guid` queda con la dirección limpia: es la identidad de la nota en el lector y no debe cambiar.
 * La página declara su canonical sin UTM, así que esto no duplica contenido para buscadores.
 */
const conUtm = (url: string, campana: string) => `${url}?utm_source=rss&utm_medium=feed&utm_campaign=${encodeURIComponent(campana)}`;

/** CDATA seguro: `]]>` dentro del HTML cerraría la sección antes de tiempo. */
const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

// Convierte una dirección relativa en absoluta del sitio.
const absUrl = (u: string) => (/^https?:\/\//.test(u) ? u : siteUrl(u.startsWith("/") ? u : `/${u}`));

// Tipo MIME de una imagen según su extensión, para la etiqueta enclosure del feed.
function imageType(url: string): string {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  return (
    { png: "image/png", webp: "image/webp", avif: "image/avif", gif: "image/gif" } as Record<string, string>
  )[ext ?? ""] ?? "image/jpeg";
}

// Categoría que describe el feed: dirección, nombre y descripción.
type FeedCategory = { slug: string; name: string; description: string | null };

/** XML del feed. Sin `categorySlug`, el general; con él, el de esa sección y sus subsecciones. */
export async function buildFeed(categorySlug?: string): Promise<{ xml: string } | null> {
  const siteName = env(process.env.NEXT_PUBLIC_SITE_NAME, "CONtexto Ganadero");

  let category: FeedCategory | null = null;
  let categoryIds: string[] = [];
  if (categorySlug) {
    const [cat] = await db
      .select({ id: categories.id, slug: categories.slug, name: categories.name, description: categories.description })
      .from(categories)
      .where(eq(categories.slug, categorySlug))
      .limit(1);
    if (!cat) return null;
    category = cat;
    const children = await db.select({ id: categories.id }).from(categories).where(eq(categories.parentId, cat.id));
    categoryIds = [cat.id, ...children.map((c) => c.id)];
  }

  const published = and(eq(articles.status, "publicado"), lte(articles.publishedAt, sql`now()`));
  const rows = await db
    .select({
      slug: articles.slug,
      title: articles.title,
      excerpt: articles.excerpt,
      coverImageUrl: articles.coverImageUrl,
      coverImageAlt: articles.coverImageAlt,
      tags: articles.tags,
      publishedAt: articles.publishedAt,
      updatedAt: articles.updatedAt,
      categoryName: categories.name,
      authorName: authors.name,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .where(categoryIds.length ? and(published, or(inArray(articles.categoryId, categoryIds))) : published)
    .orderBy(desc(articles.publishedAt))
    .limit(ITEMS);

  const self = category ? `/categoria/${category.slug}/feed.xml` : "/feed.xml";
  const link = category ? `/categoria/${category.slug}` : "/";
  const title = category ? `${category.name} · ${siteName}` : siteName;
  const description = category?.description ?? "Noticias del sector ganadero y agropecuario de Colombia";
  const lastBuild = rows[0]?.updatedAt ?? rows[0]?.publishedAt ?? new Date();

  const items = rows.map((a) => {
    const url = siteUrl(`/articulo/${a.slug}`);
    const enlace = conUtm(url, category?.slug ?? "general");
    const cover = a.coverImageUrl ? absUrl(a.coverImageUrl) : null;
    const coverHtml = cover
      ? `<p><img src="${esc(cover)}" alt="${esc(a.coverImageAlt ?? a.title)}"/></p>`
      : "";
    const content = `${coverHtml}<p>${esc(a.excerpt)}</p><p><a href="${esc(enlace)}">Leer la nota completa en ${esc(siteName)}</a></p>`;
    return [
      "<item>",
      `<title>${esc(a.title)}</title>`,
      `<link>${esc(enlace)}</link>`,
      `<guid isPermaLink="true">${url}</guid>`,
      `<description>${esc(a.excerpt)}</description>`,
      `<content:encoded>${cdata(content)}</content:encoded>`,
      a.publishedAt ? `<pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate>` : "",
      a.authorName ? `<dc:creator>${esc(a.authorName)}</dc:creator>` : "",
      a.categoryName ? `<category>${esc(a.categoryName)}</category>` : "",
      ...a.tags.map((t) => `<category>${esc(t)}</category>`),
      cover
        ? `<media:content url="${esc(cover)}" medium="image" type="${imageType(cover)}"/><enclosure url="${esc(cover)}" length="0" type="${imageType(cover)}"/>`
        : "",
      "</item>",
    ]
      .filter(Boolean)
      .join("");
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title>${esc(title)}</title>
<link>${siteUrl(link)}</link>
<description>${esc(description)}</description>
<language>es-CO</language>
<copyright>© ${new Date().getFullYear()} ${esc(siteName)}</copyright>
<lastBuildDate>${new Date(lastBuild).toUTCString()}</lastBuildDate>
<ttl>30</ttl>
<image><url>${siteUrl("/icon")}</url><title>${esc(title)}</title><link>${siteUrl(link)}</link></image>
<atom:link href="${siteUrl(self)}" rel="self" type="application/rss+xml"/>
${items.join("\n")}
</channel>
</rss>`;
  return { xml };
}

// Cabeceras de la respuesta RSS: tipo XML y caché en CDN para los lectores que consultan cada pocos minutos.
export const RSS_HEADERS = {
  "Content-Type": "application/rss+xml; charset=utf-8",
  // Los lectores consultan cada pocos minutos: se sirve desde la CDN y se
  // refresca en segundo plano. Publicar revalida /feed.xml al instante.
  "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
};
