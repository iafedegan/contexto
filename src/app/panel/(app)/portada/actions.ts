"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNotNull, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { adsZones, articles, siteSettings, type HomeLayoutConfig, type HomeStyle } from "@/db/schema";
import { sanitizeHomeStyle } from "@/lib/home-style";
import { auth, requirePermiso } from "@/lib/auth";
import { AD_ZONE_SPECS, positionOf } from "@/lib/ads-positions";
import { parseAdDate, validateAd } from "@/lib/ads-validate";
import { normalizeLayout } from "@/lib/home-layout-normalize";
import { sanitizePopup, type PopupConfig } from "@/lib/popup-types";
import { POPUP_KEY, getSitePopup } from "@/lib/popup";
import { draftKey, sanitizeDraft } from "@/lib/preview-draft";
import { invalidarCache } from "@/lib/data-cache";

export type HomeLayoutEntry = {
  id: string;
  homeStyle: HomeStyle | null;
};

/**
 * Persiste el diseño manual de la portada: orden y estilo de cada tarjeta.
 * `entries` va en el orden exacto en que deben aparecer (posición 0 =
 * principal). Cualquier artículo que tuviera algo fijado y ya no esté en la
 * lista vuelve a su comportamiento por defecto.
 */
export async function saveHomeLayout(entries: HomeLayoutEntry[]) {
  await requirePermiso("portada");

  await Promise.all(
    entries.map((e, i) =>
      db
        .update(articles)
        .set({ homePosition: i, homeStyle: sanitizeHomeStyle(e.homeStyle) })
        .where(eq(articles.id, e.id)),
    ),
  );

  const ids = entries.map((e) => e.id);
  await db
    .update(articles)
    .set({ homePosition: null, homeStyle: null })
    .where(
      ids.length > 0
        ? and(isNotNull(articles.homePosition), notInArray(articles.id, ids))
        : isNotNull(articles.homePosition),
    );

  invalidarCache();
  revalidatePath("/");
  revalidatePath("/panel/portada");
}

/** Quita todo el diseño manual: la portada vuelve a su comportamiento por defecto. */
export async function resetHomeLayout() {
  await requirePermiso("portada");
  await db.update(articles).set({ homePosition: null, homeStyle: null }).where(isNotNull(articles.homePosition));
  invalidarCache();
  revalidatePath("/");
  revalidatePath("/panel/portada");
}

/**
 * Guarda la disposición de las secciones de la portada (independiente del
 * contenido): si "En breve" es vertical u horizontal, cuántas columnas, y
 * cuántas columnas tiene la cuadrícula "Lo más reciente".
 */
export async function saveHomeSectionLayout(input: HomeLayoutConfig) {
  await requirePermiso("portada");
  // El estilo por componente acaba convertido en CSS: se guarda ya validado.
  const config = normalizeLayout(input);
  await db
    .insert(siteSettings)
    .values({ key: "home_layout", value: config })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: config, updatedAt: sql`now()` } });
  // La plantilla tiñe TODO el portal (artículo, sección, buscador…), así que
  // se revalida el árbol entero y no solo la portada.
  invalidarCache();
  revalidatePath("/", "layout");
  revalidatePath("/panel/portada");
}

/**
 * Guarda el popup del portal. Se valida entero (URLs, colores, rangos) porque
 * lo pinta cualquier página pública; sube la versión para que el popup nuevo
 * se muestre también a quien ya cerró el anterior.
 */
export async function saveSitePopup(input: PopupConfig): Promise<PopupConfig> {
  await requirePermiso("portada");
  const config = sanitizePopup({ ...input, version: (Number(input.version) || 0) + 1 });
  await db
    .insert(siteSettings)
    .values({ key: POPUP_KEY, value: config })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: config, updatedAt: sql`now()` } });
  invalidarCache();
  revalidatePath("/", "layout");
  return config;
}


/**
 * Guarda el borrador de diseño del editor en el servidor, para que la pestaña
 * «Vista previa» pueda renderizar la portada real con él. Es solo del editor que
 * lo escribe (una fila por usuario) y no afecta al sitio publicado.
 */
export async function saveHomeDraft(input: unknown): Promise<{ ok: boolean }> {
  const user = await requirePermiso("portada");
  const draft = sanitizeDraft(input);
  if (!draft) return { ok: false };
  await db
    .insert(siteSettings)
    .values({ key: draftKey(user.id), value: draft })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: draft, updatedAt: sql`now()` } });
  return { ok: true };
}

type AdWrite = {
  key: string;
  name: string;
  html: string | null;
  imageUrl: string | null;
  clickUrl: string | null;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

const sameDate = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);

/**
 * «Publicar cambios»: lo que muestra el borrador pasa al sitio — diseño, orden y
 * estilo de las notas, ventana emergente y publicidad, todo junto. Usa el
 * borrador guardado en el servidor (no lo que mande el navegador) para que se
 * publique exactamente lo que se estaba viendo.
 *
 * Primero se valida TODO (los anuncios tienen reglas propias) y solo si está
 * bien se escribe: no queda una publicación a medias.
 */
export async function publishHomeDraft(): Promise<{ ok: boolean; message: string }> {
  const user = await requirePermiso("portada");
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, draftKey(user.id))).limit(1);
  const draft = sanitizeDraft(row?.value);
  if (!draft) return { ok: false, message: "No hay cambios que publicar." };

  // --- Anuncios: validar antes de tocar nada ---------------------------------
  const adKeys = Object.keys(draft.adDrafts);
  const adWrites: AdWrite[] = [];
  if (adKeys.length) {
    const rows = await db.select().from(adsZones);
    const byKey = new Map(rows.map((r) => [r.key, r]));
    for (const [key, d] of Object.entries(draft.adDrafts)) {
      const position = positionOf(key);
      if (!position) continue;
      const cur = byKey.get(key);
      const next: AdWrite = {
        key,
        name: cur?.name ?? AD_ZONE_SPECS[position].label,
        html: d.html || null,
        imageUrl: d.imageUrl || null,
        clickUrl: d.clickUrl || null,
        active: d.active,
        // Un borrador antiguo no traía fechas: se conservan las guardadas.
        startsAt: d.startsAt === undefined ? (cur?.startsAt ?? null) : parseAdDate(d.startsAt),
        endsAt: d.endsAt === undefined ? (cur?.endsAt ?? null) : parseAdDate(d.endsAt),
      };
      const igual =
        !!cur &&
        (cur.html ?? null) === next.html &&
        (cur.imageUrl ?? null) === next.imageUrl &&
        (cur.clickUrl ?? null) === next.clickUrl &&
        cur.active === next.active &&
        sameDate(cur.startsAt, next.startsAt) &&
        sameDate(cur.endsAt, next.endsAt);
      // Una zona que nunca existió y sigue vacía e inactiva no hay que crearla.
      const vacia = !cur && !next.html && !next.imageUrl && !next.active;
      if (igual || vacia) continue;
      const problema = validateAd(next);
      if (problema) return { ok: false, message: `Publicidad «${AD_ZONE_SPECS[position].label}»: ${problema}` };
      adWrites.push(next);
    }
    if (adWrites.length) {
      const session = await auth();
      if (session?.user?.role !== "administrador") {
        return { ok: false, message: "Hay cambios en la publicidad y solo un administrador puede publicarlos. Descártalos o pídele a un administrador que publique." };
      }
    }
  }

  // --- Diseño, notas y popup -----------------------------------------------------
  if (draft.auto) {
    await resetHomeLayout();
  } else {
    const slugs = draft.items.map((i) => i.slug);
    const ids = slugs.length
      ? await db.select({ id: articles.id, slug: articles.slug }).from(articles).where(inArray(articles.slug, slugs))
      : [];
    const idBySlug = new Map(ids.map((r) => [r.slug, r.id]));
    const entries = draft.items.flatMap((i) => {
      const id = idBySlug.get(i.slug);
      return id ? [{ id, homeStyle: i.homeStyle }] : [];
    });
    await saveHomeLayout(entries);
  }
  await saveHomeSectionLayout(draft.layout);
  // El popup solo se vuelve a guardar si cambió: al guardarlo se muestra otra vez
  // a quien ya lo había cerrado.
  const current = await getSitePopup();
  if (JSON.stringify({ ...draft.popup, version: 0 }) !== JSON.stringify({ ...current, version: 0 })) {
    await saveSitePopup(draft.popup);
  }

  // --- Publicidad -----------------------------------------------------------------
  for (const w of adWrites) {
    await db
      .insert(adsZones)
      .values(w)
      .onConflictDoUpdate({ target: adsZones.key, set: { html: w.html, imageUrl: w.imageUrl, clickUrl: w.clickUrl, active: w.active, startsAt: w.startsAt, endsAt: w.endsAt } });
  }
  if (adWrites.length) {
    invalidarCache();
    revalidatePath("/", "layout");
  }

  await db.delete(siteSettings).where(eq(siteSettings.key, draftKey(user.id)));
  revalidatePath("/panel/portada");
  return { ok: true, message: "Publicado en el sitio" };
}

/**
 * «Deshacer publicación»: vuelve a lo que estaba publicado antes. El editor
 * manda el estado anterior que tenía en pantalla; aquí se valida de nuevo y
 * solo se escribe lo que de verdad es distinto (el popup, por ejemplo, no se
 * vuelve a guardar si no cambió: guardarlo lo mostraría otra vez a quien ya lo cerró).
 */
export async function restoreHomeSnapshot(input: unknown): Promise<{ ok: boolean; message: string }> {
  await requirePermiso("portada");
  const r = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (r.auto === true) {
    await resetHomeLayout();
  } else if (Array.isArray(r.items)) {
    const entries = (r.items as unknown[]).flatMap((i) => {
      const o = (i ?? {}) as Record<string, unknown>;
      return typeof o.id === "string" && UUID.test(o.id) ? [{ id: o.id, homeStyle: sanitizeHomeStyle(o.homeStyle) }] : [];
    });
    await saveHomeLayout(entries);
  }
  if (r.layout && typeof r.layout === "object") await saveHomeSectionLayout(r.layout as HomeLayoutConfig);

  if (r.popup) {
    const prev = sanitizePopup(r.popup);
    const current = await getSitePopup();
    if (JSON.stringify({ ...prev, version: 0 }) !== JSON.stringify({ ...current, version: 0 })) await saveSitePopup(prev);
  }

  if (Array.isArray(r.ads) && r.ads.length) {
    const session = await auth();
    if (session?.user?.role === "administrador") {
      for (const a of r.ads as unknown[]) {
        const o = (a ?? {}) as Record<string, unknown>;
        const key = typeof o.key === "string" ? o.key : "";
        const position = positionOf(key);
        if (!position) continue;
        const w = {
          html: typeof o.html === "string" && o.html ? o.html.slice(0, 8000) : null,
          imageUrl: typeof o.imageUrl === "string" && /^https?:\/\//i.test(o.imageUrl) ? o.imageUrl.slice(0, 600) : null,
          clickUrl: typeof o.clickUrl === "string" && /^https?:\/\//i.test(o.clickUrl) ? o.clickUrl.slice(0, 600) : null,
          active: o.active === true,
          startsAt: o.startsAt ? new Date(String(o.startsAt)) : null,
          endsAt: o.endsAt ? new Date(String(o.endsAt)) : null,
        };
        const ok = (d: Date | null) => !d || !Number.isNaN(d.getTime());
        if (!ok(w.startsAt) || !ok(w.endsAt) || (w.html && w.imageUrl)) continue;
        await db
          .insert(adsZones)
          .values({ key, name: AD_ZONE_SPECS[position].label, ...w })
          .onConflictDoUpdate({ target: adsZones.key, set: w });
      }
      invalidarCache();
      revalidatePath("/", "layout");
    }
  }
  revalidatePath("/panel/portada");
  return { ok: true, message: "Se volvió a la versión anterior." };
}
