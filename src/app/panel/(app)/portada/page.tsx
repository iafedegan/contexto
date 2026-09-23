import { and, desc, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors, categories } from "@/db/schema";
import { getHomeLayoutConfig } from "@/lib/content";
import { HomeBuilder } from "@/components/panel/home-builder";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { navItems } from "@/components/site-shell";

export const dynamic = "force-dynamic";

export default async function PortadaPage() {
  const [rows, layout, nav] = await Promise.all([
    db
      .select({
        id: articles.id,
        slug: articles.slug,
        title: articles.title,
        excerpt: articles.excerpt,
        coverImageUrl: articles.coverImageUrl,
        coverImageAlt: articles.coverImageAlt,
        categoryName: categories.name,
        categorySlug: categories.slug,
        authorName: authors.name,
        homePosition: articles.homePosition,
        homeStyle: articles.homeStyle,
        publishedAt: articles.publishedAt,
      })
      .from(articles)
      .leftJoin(categories, eq(articles.categoryId, categories.id))
      .leftJoin(authors, eq(articles.authorId, authors.id))
      .where(and(eq(articles.status, "publicado"), lte(articles.publishedAt, sql`now()`)))
      .orderBy(sql`(${articles.homePosition} is null)`, articles.homePosition, desc(articles.publishedAt)),
    getHomeLayoutConfig(),
    navItems(),
  ]);

  return (
    // El editor necesita todo el ancho: se sale del contenedor del panel con
    // left-1/2 + w-screen (el padre recorta en horizontal, ver .lx-shell).
    <div className="relative left-1/2 w-screen -translate-x-1/2 px-5">
      <div className="flex min-h-[calc(100dvh-9rem)] flex-col gap-5">
      {/* `key` fuerza a remontar el builder cuando cambia el diseño real en la
          BD (tras guardar o restablecer), para que su estado interno no quede
          desincronizado del servidor. */}
      <HomeBuilder
        key={rows.map((r) => `${r.id}:${r.homePosition}:${JSON.stringify(r.homeStyle)}`).join("|") + JSON.stringify(layout)}
        initialItems={rows}
        initialLayout={layout}
        headerVariants={{
          esmeralda: <SiteHeader theme="esmeralda" nav={nav} />,
          clasico: <SiteHeader theme="clasico" nav={nav} />,
          revista: <SiteHeader theme="revista" nav={nav} />,
          compacto: <SiteHeader theme="compacto" nav={nav} />,
          vanguardia: <SiteHeader theme="vanguardia" nav={nav} />,
        }}
        footerVariants={{
          esmeralda: <SiteFooter theme="esmeralda" nav={nav} />,
          clasico: <SiteFooter theme="clasico" nav={nav} />,
          revista: <SiteFooter theme="revista" nav={nav} />,
          compacto: <SiteFooter theme="compacto" nav={nav} />,
          vanguardia: <SiteFooter theme="vanguardia" nav={nav} />,
        }}
      />
      </div>
    </div>
  );
}
