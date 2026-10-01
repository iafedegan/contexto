import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adsZones, articles, categories, siteSettings } from "@/db/schema";
import { auth, requirePermiso } from "@/lib/auth";
import { getAdsZoneRows } from "@/lib/ads";
import { DEFAULT_HOME_LAYOUT } from "@/lib/home-layout";
import { normalizeLayout } from "@/lib/home-layout-normalize";
import { draftKey, sanitizeDraft, setPreviewDraft } from "@/lib/preview-draft";
import { DEFAULT_POPUP, sanitizePopup } from "@/lib/popup-types";
import { POPUP_KEY } from "@/lib/popup";
import { makePage } from "@/app/(public)/_pages/home";
import { PreviewChrome } from "@/components/panel/preview-chrome";
import { AD_ZONE_SPECS, positionOf } from "@/lib/ads-positions";
import { countChanges, summarizeChanges, type ChangeLine, type PortadaState } from "@/lib/portada-summary";
import type { Anterior } from "@/components/panel/portada-types";
import type { AdDraft } from "@/components/panel/ads-zone-form";
import { sql } from "drizzle-orm";
import { makePage as makeCategoryPage } from "@/app/(public)/_pages/categoria";

const Home = makePage("es");
const Categoria = makeCategoryPage("es");

/**
 * Vista previa REAL de la portada: la misma página que ve el público, con el
 * borrador del editor aplicado (diseño, orden y estilo de tarjetas, popup y
 * anuncios). Así lo que se ve aquí es lo que se publica.
 *
 * Ojo con el orden: `changed` se calcula con consultas directas, antes de fijar
 * el borrador. Las funciones del portal (getHomeLayoutConfig, getSitePopup…)
 * memoizan por petición; llamarlas antes dejaría en caché el diseño publicado.
 */
/** Carga el borrador del editor, calcula si hay cambios sin publicar y lo fija para esta petición. */
export async function applyDraftForRequest(opts: { popup?: "auto" | "show" | "hide" } = {}) {
  const user = await requirePermiso("portada");

  const [draftRow] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, draftKey(user.id))).limit(1);
  const draft = sanitizeDraft(draftRow?.value);

  let changed = false;
  let lines: ChangeLine[] = [];
  let anterior: Anterior | null = null;
  if (draft) {
    const [layoutRow] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, "home_layout")).limit(1);
    const [popupRow] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, POPUP_KEY)).limit(1);
    const savedItems = await db
      .select({ id: articles.id, slug: articles.slug, title: articles.title, homeStyle: articles.homeStyle, homePosition: articles.homePosition })
      .from(articles)
      .where(eq(articles.status, "publicado"))
      .orderBy(sql`(${articles.homePosition} is null)`, articles.homePosition, sql`${articles.publishedAt} desc`);
    const adRows = await db.select().from(adsZones);

    const toIso = (d: Date | null) => (d ? d.toISOString() : "");
    const adsBase: Record<string, AdDraft> = {};
    const adNames: Record<string, string> = {};
    for (const r of adRows) {
      adsBase[r.key] = { imageUrl: r.imageUrl ?? "", clickUrl: r.clickUrl ?? "", html: r.html ?? "", active: r.active, startsAt: toIso(r.startsAt), endsAt: toIso(r.endsAt) };
    }
    for (const key of Object.keys(draft.adDrafts)) {
      const pos = positionOf(key);
      adNames[key] = pos ? AD_ZONE_SPECS[pos].label : key;
    }

    const base: PortadaState = {
      layout: { ...DEFAULT_HOME_LAYOUT, ...normalizeLayout((layoutRow?.value ?? {}) as never) },
      items: savedItems.map((i) => ({ slug: i.slug, homeStyle: i.homeStyle ?? null })),
      // Igual que getSitePopup(): sin fila publicada, el popup por defecto (apagado).
      popup: popupRow ? sanitizePopup(popupRow.value) : DEFAULT_POPUP,
      ads: {},
      // Sin ninguna nota fijada a mano, la portada ya es automática.
      auto: savedItems.every((i) => i.homePosition === null),
    };
    const cur: PortadaState = { layout: draft.layout, items: draft.items, popup: draft.popup, ads: draft.adDrafts, auto: draft.auto };
    const titles = Object.fromEntries(savedItems.map((i) => [i.slug, i.title]));
    lines = summarizeChanges(base, cur, { titles, adsBase, adNames });
    changed = countChanges(lines) > 0;
    anterior = {
      auto: base.auto ?? false,
      items: savedItems.map((i) => ({ id: i.id, homeStyle: i.homeStyle ?? null })),
      layout: base.layout,
      popup: base.popup,
      ads: Object.keys(draft.adDrafts).flatMap((key) => {
        const r = adRows.find((x) => x.key === key);
        return r ? [{ key, html: r.html, imageUrl: r.imageUrl, clickUrl: r.clickUrl, active: r.active, startsAt: r.startsAt ? r.startsAt.toISOString() : null, endsAt: r.endsAt ? r.endsAt.toISOString() : null }] : [];
      }),
    };
  }

  // El lienzo del editor decide si enseña el popup (botón «Ver en el lienzo»).
  const applied =
    draft && opts.popup === "hide"
      ? { ...draft, popup: { ...draft.popup, enabled: false } }
      : draft && opts.popup === "show"
        ? { ...draft, popup: { ...draft.popup, enabled: true } }
        : draft;
  setPreviewDraft(applied);
  return { draft, changed, lines, anterior };
}

export async function HomeRealPreview({ seccion }: { seccion?: string } = {}) {
  const { draft, changed, lines, anterior } = await applyDraftForRequest();
  let row: { id: string; slug: string; name: string; description: string | null; sortOrder: number; articleCount: number } | null = null;
  if (seccion) {
    const [r] = await db
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
      .where(eq(categories.slug, seccion))
      .groupBy(categories.id);
    row = r ?? null;
  }
  // Zonas de publicidad para el formulario flotante (se leen DESPUÉS de fijar el borrador).
  const [adsZones, session] = await Promise.all([getAdsZoneRows().catch(() => []), auth()]);
  return (
    <PreviewChrome changed={changed} changes={lines} anterior={anterior} hasDraft={!!draft} draft={draft} seccion={row} adsZones={adsZones} canManagePauta={session?.user.role === "administrador"}>
      {row ? <Categoria params={Promise.resolve({ slug: row.slug })} searchParams={Promise.resolve({})} locale="es" /> : <Home locale="es" />}
    </PreviewChrome>
  );
}

/** La portada real con el borrador aplicado, sin marco: para incrustarla en el lienzo del editor. */
export async function HomeRealEmbed({ popup }: { popup: "show" | "hide" }) {
  await applyDraftForRequest({ popup });
  return <Home locale="es" />;
}
