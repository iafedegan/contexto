import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors, categories } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getHomeLayoutConfig } from "@/lib/content";
import { getAdsZoneRows } from "@/lib/ads";
import { HomeBuilder } from "@/components/panel/home-builder";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { navItems } from "@/components/site-shell";
import { getSitePopup } from "@/lib/popup";
import { HomeRealPreview } from "@/components/panel/home-real-preview";

export const dynamic = "force-dynamic";

export default async function PortadaPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; seccion?: string }>;
}) {
  const { vista, seccion } = await searchParams;
  // Vista previa REAL en pestaña nueva. Va la primera: las funciones del portal
  // memoizan por petición y no deben ejecutarse antes de aplicar el borrador.
  if (vista === "1") return <HomeRealPreview seccion={seccion} />;
  const [session, rows, layout, nav, adsZones, popup] = await Promise.all([
    auth(),
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
        authorSlug: authors.slug,
        authorAvatarUrl: authors.avatarUrl,
        homePosition: articles.homePosition,
        isLive: articles.isLive,
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
    getAdsZoneRows(),
    getSitePopup(),
  ]);

  const sections = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      description: categories.description,
      sortOrder: categories.sortOrder,
      articleCount: sql<number>`count(${articles.id})::int`,
    })
    .from(categories)
    .leftJoin(articles, eq(articles.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  const headerVariants = {
    masthead: <SiteHeader theme="clasico" nav={nav} variant="masthead" />,
    couture: <SiteHeader theme="clasico" nav={nav} variant="couture" />,
    bold: <SiteHeader theme="clasico" nav={nav} variant="bold" />,
    glass: <SiteHeader theme="clasico" nav={nav} variant="glass" />,
    crest: <SiteHeader theme="clasico" nav={nav} variant="crest" />,
    gremial: <SiteHeader theme="gremial" nav={nav} variant="gremial" />,
  };
  const footerVariants = {
    grand: <SiteFooter theme="clasico" nav={nav} variant="grand" />,
    atelier: <SiteFooter theme="clasico" nav={nav} variant="atelier" />,
    copper: <SiteFooter theme="clasico" nav={nav} variant="copper" />,
    aurora: <SiteFooter theme="clasico" nav={nav} variant="aurora" />,
    seal: <SiteFooter theme="clasico" nav={nav} variant="seal" />,
    gremial: <SiteFooter theme="gremial" nav={nav} variant="gremial" />,
  };

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
        initialPopup={popup}
        adsZones={adsZones}
        sections={sections}
        canManagePauta={session?.user.role === "administrador"}
        headerVariants={headerVariants}
        footerVariants={footerVariants}
      />
      </div>
    </div>
  );
}
