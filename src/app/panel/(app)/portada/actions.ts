"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNotNull, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, siteSettings, type HomeLayoutConfig, type HomeStyle } from "@/db/schema";
import { sanitizeHomeStyle } from "@/lib/home-style";
import { requireRole } from "@/lib/auth";
import { normalizeLayout } from "@/lib/home-layout-normalize";
import { sanitizePopup, type PopupConfig } from "@/lib/popup-types";
import { POPUP_KEY, getSitePopup } from "@/lib/popup";
import { draftKey, sanitizeDraft } from "@/lib/preview-draft";

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
  await requireRole("editor");

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

  revalidatePath("/");
  revalidatePath("/panel/portada");
}

/** Quita todo el diseño manual: la portada vuelve a su comportamiento por defecto. */
export async function resetHomeLayout() {
  await requireRole("editor");
  await db.update(articles).set({ homePosition: null, homeStyle: null }).where(isNotNull(articles.homePosition));
  revalidatePath("/");
  revalidatePath("/panel/portada");
}

/**
 * Guarda la disposición de las secciones de la portada (independiente del
 * contenido): si "En breve" es vertical u horizontal, cuántas columnas, y
 * cuántas columnas tiene la cuadrícula "Lo más reciente".
 */
export async function saveHomeSectionLayout(input: HomeLayoutConfig) {
  await requireRole("editor");
  // El estilo por componente acaba convertido en CSS: se guarda ya validado.
  const config = normalizeLayout(input);
  await db
    .insert(siteSettings)
    .values({ key: "home_layout", value: config })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: config, updatedAt: sql`now()` } });
  // La plantilla tiñe TODO el portal (artículo, sección, buscador…), así que
  // se revalida el árbol entero y no solo la portada.
  revalidatePath("/", "layout");
  revalidatePath("/panel/portada");
}

/**
 * Guarda el popup del portal. Se valida entero (URLs, colores, rangos) porque
 * lo pinta cualquier página pública; sube la versión para que el popup nuevo
 * se muestre también a quien ya cerró el anterior.
 */
export async function saveSitePopup(input: PopupConfig): Promise<PopupConfig> {
  await requireRole("editor");
  const config = sanitizePopup({ ...input, version: (Number(input.version) || 0) + 1 });
  await db
    .insert(siteSettings)
    .values({ key: POPUP_KEY, value: config })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: config, updatedAt: sql`now()` } });
  revalidatePath("/", "layout");
  return config;
}


/**
 * Guarda el borrador de diseño del editor en el servidor, para que la pestaña
 * «Vista previa» pueda renderizar la portada real con él. Es solo del editor que
 * lo escribe (una fila por usuario) y no afecta al sitio publicado.
 */
export async function saveHomeDraft(input: unknown): Promise<{ ok: boolean }> {
  const user = await requireRole("editor");
  const draft = sanitizeDraft(input);
  if (!draft) return { ok: false };
  await db
    .insert(siteSettings)
    .values({ key: draftKey(user.id), value: draft })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: draft, updatedAt: sql`now()` } });
  return { ok: true };
}

/**
 * «Aceptar y publicar»: lo que muestra la vista previa pasa al sitio. Usa el
 * borrador guardado en el servidor (no lo que mande el navegador) para que se
 * publique exactamente lo que se estaba viendo.
 */
export async function publishHomeDraft(): Promise<{ ok: boolean; message: string }> {
  const user = await requireRole("editor");
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, draftKey(user.id))).limit(1);
  const draft = sanitizeDraft(row?.value);
  if (!draft) return { ok: false, message: "No hay cambios que publicar." };

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
  await saveHomeSectionLayout(draft.layout);
  // El popup solo se vuelve a guardar si cambió: al guardarlo se muestra otra vez
  // a quien ya lo había cerrado.
  const current = await getSitePopup();
  if (JSON.stringify({ ...draft.popup, version: 0 }) !== JSON.stringify({ ...current, version: 0 })) {
    await saveSitePopup(draft.popup);
  }
  await db.delete(siteSettings).where(eq(siteSettings.key, draftKey(user.id)));
  return { ok: true, message: "Publicado en el sitio" };
}
