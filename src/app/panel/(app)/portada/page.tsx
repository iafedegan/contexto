import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors, categories, siteSettings } from "@/db/schema";
import { auth, requirePermiso } from "@/lib/auth";
import { getHomeLayoutConfig } from "@/lib/content";
import { getAdsZoneRows } from "@/lib/ads";
import { HomeBuilder } from "@/components/panel/home-builder";
import { getSitePopup } from "@/lib/popup";
import { HomeRealPreview } from "@/components/panel/home-real-preview";
import { draftKey, sanitizeDraft } from "@/lib/preview-draft";
import { countChanges, summarizeChanges, type PortadaState } from "@/lib/portada-summary";
import type { AdDraft } from "@/components/panel/ads-zone-form";

// Se calcula en cada petición, nunca durante la compilación.
export const dynamic = "force-dynamic";

// Pantalla del editor de portada y plantillas (exige el permiso «portada»).
export default async function PortadaPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; seccion?: string }>;
}) {
  const user = await requirePermiso("portada");
  const { vista, seccion } = await searchParams;
  // Vista previa REAL en pestaña nueva. Va la primera: las funciones del portal
  // memoizan por petición y no deben ejecutarse antes de aplicar el borrador.
  if (vista === "1") return <HomeRealPreview seccion={seccion} />;
  const [session, rows, layout, adsZones, popup, draftRow] = await Promise.all([
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
    getAdsZoneRows(),
    getSitePopup(),
    db.select({ value: siteSettings.value, updatedAt: siteSettings.updatedAt }).from(siteSettings).where(eq(siteSettings.key, draftKey(user.id))).limit(1),
  ]);

  const sections = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      description: categories.description,
      sortOrder: categories.sortOrder,
      parentId: categories.parentId,
      articleCount: sql<number>`count(${articles.id})::int`,
    })
    .from(categories)
    .leftJoin(articles, eq(articles.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  // ¿Hay un borrador de una sesión anterior que difiera de lo publicado? Se ofrece retomarlo.
  let resume: { draft: NonNullable<ReturnType<typeof sanitizeDraft>>; at: string; count: number } | null = null;
  const draft = sanitizeDraft(draftRow[0]?.value);
  if (draft) {
    const adsBase: Record<string, AdDraft> = {};
    for (const z of adsZones) {
      adsBase[z.key] = { imageUrl: z.imageUrl ?? "", clickUrl: z.clickUrl ?? "", html: z.html ?? "", active: z.active, startsAt: z.startsAt ? z.startsAt.toISOString() : "", endsAt: z.endsAt ? z.endsAt.toISOString() : "" };
    }
    const base: PortadaState = {
      layout,
      items: rows.map((r) => ({ slug: r.slug, homeStyle: r.homeStyle ?? null })),
      popup,
      ads: {},
      auto: rows.every((r) => r.homePosition === null),
    };
    const cur: PortadaState = { layout: draft.layout, items: draft.items, popup: draft.popup, ads: draft.adDrafts, auto: draft.auto };
    const lines = summarizeChanges(base, cur, {
      titles: Object.fromEntries(rows.map((r) => [r.slug, r.title])),
      adsBase,
      adNames: Object.fromEntries(adsZones.map((z) => [z.key, z.name])),
    });
    const n = countChanges(lines);
    if (n > 0) resume = { draft, at: (draftRow[0]?.updatedAt ?? new Date()).toISOString(), count: n };
  }

  return (
    // El editor necesita todo el ancho: se sale del contenedor del panel con
    // left-1/2 + margen negativo + w-screen (el padre recorta en horizontal, ver .lx-shell).
    // Nada de `translate`: crearía un bloque contenedor y los elementos `fixed` del editor
    // (aviso, árbol de secciones, panel flotante) se anclarían a este div en vez de a la ventana.
    <div className="relative left-1/2 -ml-[50vw] w-screen px-5 lg:-ml-[calc(50vw-var(--sb-w,4rem)/2)] lg:w-[calc(100vw-var(--sb-w,4rem))]">
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
        resume={resume}
      />
      </div>
    </div>
  );
}
