import { eq } from "drizzle-orm";
import { db } from "@/db";
import { articles, siteSettings } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { DEFAULT_HOME_LAYOUT } from "@/lib/home-layout";
import { normalizeLayout } from "@/lib/home-layout-normalize";
import { draftKey, sanitizeDraft, setPreviewDraft } from "@/lib/preview-draft";
import { sanitizePopup } from "@/lib/popup-types";
import { POPUP_KEY } from "@/lib/popup";
import { makePage } from "@/app/(public)/_pages/home";
import { PreviewChrome } from "@/components/panel/preview-chrome";
import { sql } from "drizzle-orm";

const Home = makePage("es");

/** JSON con las claves ordenadas: compara contenido, no el orden en que se escribió. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, x]) => `${JSON.stringify(k)}:${stable(x)}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

/**
 * Vista previa REAL de la portada: la misma página que ve el público, con el
 * borrador del editor aplicado (diseño, orden y estilo de tarjetas, popup y
 * anuncios). Así lo que se ve aquí es lo que se publica.
 *
 * Ojo con el orden: `changed` se calcula con consultas directas, antes de fijar
 * el borrador. Las funciones del portal (getHomeLayoutConfig, getSitePopup…)
 * memoizan por petición; llamarlas antes dejaría en caché el diseño publicado.
 */
export async function HomeRealPreview() {
  const user = await requireRole("editor");

  const [draftRow] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, draftKey(user.id))).limit(1);
  const draft = sanitizeDraft(draftRow?.value);

  let changed = false;
  if (draft) {
    const [layoutRow] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, "home_layout")).limit(1);
    const [popupRow] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, POPUP_KEY)).limit(1);
    const savedItems = await db
      .select({ slug: articles.slug, homeStyle: articles.homeStyle })
      .from(articles)
      .where(eq(articles.status, "publicado"))
      .orderBy(sql`(${articles.homePosition} is null)`, articles.homePosition, sql`${articles.publishedAt} desc`);

    const savedLayout = { ...DEFAULT_HOME_LAYOUT, ...normalizeLayout((layoutRow?.value ?? {}) as never) };
    const savedPopup = sanitizePopup(popupRow?.value);
    changed =
      stable(savedLayout) !== stable(draft.layout) ||
      stable({ ...savedPopup, version: 0 }) !== stable({ ...draft.popup, version: 0 }) ||
      stable(savedItems.map((i) => [i.slug, i.homeStyle ?? null])) !== stable(draft.items.map((i) => [i.slug, i.homeStyle ?? null]));
  }

  setPreviewDraft(draft);

  return (
    <PreviewChrome changed={changed} hasDraft={!!draft}>
      <Home locale="es" />
    </PreviewChrome>
  );
}
