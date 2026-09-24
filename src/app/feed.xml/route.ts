import { getRecentArticles } from "@/lib/content";
import { siteUrl } from "@/lib/utils";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

function esc(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));
}

export async function GET() {
  const name = env(process.env.NEXT_PUBLIC_SITE_NAME, "CONtexto Ganadero");
  let items: Awaited<ReturnType<typeof getRecentArticles>> = [];
  try {
    items = await getRecentArticles(40);
  } catch {
    /* sin DB */
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(name)}</title>
    <link>${siteUrl("/")}</link>
    <description>Noticias del sector ganadero y agropecuario de Colombia</description>
    <language>es-CO</language>
    <atom:link href="${siteUrl("/feed.xml")}" rel="self" type="application/rss+xml"/>
    ${items
      .map(
        (a) => `<item>
      <title>${esc(a.title)}</title>
      <link>${siteUrl(`/articulo/${a.slug}`)}</link>
      <guid isPermaLink="true">${siteUrl(`/articulo/${a.slug}`)}</guid>
      <description>${esc(a.excerpt)}</description>
      ${a.publishedAt ? `<pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate>` : ""}
      ${a.categoryName ? `<category>${esc(a.categoryName)}</category>` : ""}
    </item>`,
      )
      .join("\n    ")}
  </channel>
</rss>`;

  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
