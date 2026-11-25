"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNotNull, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { adsZones, articles, paginas, siteSettings, type HomeLayoutConfig, type HomeStyle } from "@/db/schema";
import { sanitizeHomeStyle } from "@/lib/home-style";
import { auth, requirePermiso } from "@/lib/auth";
import { AD_ZONE_SPECS, positionOf } from "@/lib/ads-positions";
import { parseAdDate, validateAd } from "@/lib/ads-validate";
import { mismoDiseno, normalizeLayout } from "@/lib/home-layout-normalize";
import { sanitizePopup, type PopupConfig } from "@/lib/popup-types";
import { POPUP_KEY, getSitePopup } from "@/lib/popup";
import { draftKey, sanitizeDraft } from "@/lib/preview-draft";
import { invalidarCache, TAG_AJUSTES, TAG_SITIO } from "@/lib/data-cache";

// Orden y estilo de una nota en la portada.
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
async function saveHomeLayout(entries: HomeLayoutEntry[]) {
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
async function resetHomeLayout() {
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
async function saveHomeSectionLayout(input: HomeLayoutConfig) {
  await requirePermiso("portada");
  // El estilo por componente acaba convertido en CSS: se guarda ya validado.
  const config = normalizeLayout(input);
  await guardarDiseno(config);
  revalidatePath("/panel/portada");
}

/** El `home_layout` guardado hoy (tal como está en la base), o null si nunca se guardó. */
async function disenoGuardado(): Promise<HomeLayoutConfig | null> {
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, "home_layout")).limit(1);
  return (row?.value as HomeLayoutConfig | undefined) ?? null;
}

/**
 * Guarda el diseño (ya normalizado) y purga el sitio SOLO si de verdad cambió. La plantilla tiñe TODO el portal (artículo, sección,
 * buscador…), así que un cambio regenera las ~100.000 notas; pero «Publicar cambios» vuelve a mandar el diseño aunque solo se haya
 * movido una nota de la portada, y antes eso vaciaba la caché de todo el sitio cada vez.
 */
async function guardarDiseno(config: HomeLayoutConfig, previo?: HomeLayoutConfig | null) {
  const antes = previo === undefined ? await disenoGuardado() : previo;
  if (antes && mismoDiseno(antes, config)) return;
  await db
    .insert(siteSettings)
    .values({ key: "home_layout", value: config })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: config, updatedAt: sql`now()` } });
  invalidarCache(TAG_SITIO);
  revalidatePath("/", "layout");
}

type AnchoPrincipal = NonNullable<HomeLayoutConfig["anchoPrincipal"]>;

/** El ancho de la nota principal que tiene HOY la portada publicada (para el árbol de secciones). */
export async function leerAnchoPortada(): Promise<AnchoPrincipal> {
  await requirePermiso("portada");
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, "home_layout")).limit(1);
  return normalizeLayout((row?.value as HomeLayoutConfig | undefined) ?? {}).anchoPrincipal ?? "ancha";
}

/**
 * Cambia el ancho de la nota principal de la portada ya publicada, sin pasar por el borrador del editor (se usa desde el árbol de secciones).
 * Solo toca ese ajuste: el resto de la configuración queda como estaba.
 */
export async function guardarAnchoPortada(valor: string): Promise<{ ok: boolean; message: string }> {
  await requirePermiso("portada");
  const ancho = (["normal", "ancha", "muyAncha"] as const).find((a) => a === valor);
  if (!ancho) return { ok: false, message: "Ese ancho no existe." };
  const antes = await disenoGuardado();
  const config = normalizeLayout({ ...(antes ?? {}), anchoPrincipal: ancho });
  // Si el ancho ya era ese, no se toca nada (ni se purga el sitio).
  await guardarDiseno(config, antes);
  revalidatePath("/panel/portada");
  return { ok: true, message: "Listo: la portada ya usa ese ancho." };
}

/**
 * Guarda el popup del portal. Se valida entero (URLs, colores, rangos) porque
 * lo pinta cualquier página pública; sube la versión para que el popup nuevo
 * se muestre también a quien ya cerró el anterior.
 */
async function saveSitePopup(input: PopupConfig): Promise<PopupConfig> {
  await requirePermiso("portada");
  const config = sanitizePopup({ ...input, version: (Number(input.version) || 0) + 1 });
  await db
    .insert(siteSettings)
    .values({ key: POPUP_KEY, value: config })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: config, updatedAt: sql`now()` } });
  // La ventana emergente va en el HTML de todas las páginas: se purga el sitio (solo se llama si cambió, ver publishHomeDraft).
  invalidarCache(TAG_SITIO);
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

// Escritura pendiente de un anuncio al publicar el borrador.
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

// Compara dos fechas por su valor, aceptando nulos.
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
    // Las notas piden los anuncios desde el navegador (`/api/anuncios`): basta con renovar la caché de datos de las páginas dinámicas y
    // borrar de la red las copias con la etiqueta `portal` (lo hace invalidarCache). Ninguna nota se regenera.
    invalidarCache(TAG_AJUSTES);
    revalidatePath("/");
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
        // Una fecha es válida si no existe o es una fecha real.
        const ok = (d: Date | null) => !d || !Number.isNaN(d.getTime());
        if (!ok(w.startsAt) || !ok(w.endsAt) || (w.html && w.imageUrl)) continue;
        await db
          .insert(adsZones)
          .values({ key, name: AD_ZONE_SPECS[position].label, ...w })
          .onConflictDoUpdate({ target: adsZones.key, set: w });
      }
      // Los anuncios de las notas se piden desde el navegador: no hace falta regenerar ninguna nota (ver publishHomeDraft).
      invalidarCache(TAG_AJUSTES);
      revalidatePath("/");
    }
  }
  revalidatePath("/panel/portada");
  return { ok: true, message: "Se volvió a la versión anterior." };
}

/**
 * Los videos de YouTube que hoy salen en el carrusel de TV de la página «Portada del inicio» (Páginas), listos para pasarlos al editor de
 * «Carrusel de notas». Solo lee: no toca la página.
 */
export async function videosDelInicio(): Promise<{ id: string; imagen: string; titulo: string; enlace: string }[]> {
  await requirePermiso("portada");
  const [row] = await db.select({ contenido: paginas.contenido }).from(paginas).where(eq(paginas.slug, "inicio")).limit(1);
  const out: { id: string; imagen: string; titulo: string; enlace: string }[] = [];
  for (const fila of row?.contenido?.filas ?? []) {
    for (const el of fila.celdas.flat()) {
      if (el.tipo !== "carrusel" || !Array.isArray(el.items)) continue;
      for (const it of el.items as Record<string, unknown>[]) {
        const enlace = typeof it.url === "string" ? it.url : "";
        const imagen = typeof it.imagen === "string" ? it.imagen : "";
        if (!/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(enlace) || !imagen) continue;
        out.push({ id: `v-${out.length}-${Math.random().toString(36).slice(2, 6)}`, imagen, titulo: typeof it.titulo === "string" ? it.titulo : "", enlace });
      }
    }
  }
  return out.slice(0, 12);
}
