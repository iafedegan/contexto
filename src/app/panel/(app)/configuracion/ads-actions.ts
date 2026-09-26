"use server";

/**
 * Gestión de las zonas de pauta (`ads_zones`) desde el panel.
 *
 * Cada posición del sitio (ver `AD_ZONE_SPECS`) tiene un anuncio principal y
 * admite los que se añadan (`<posición>__2`, `__3`…). Se guardan con upsert:
 * las posiciones nuevas no hace falta sembrarlas. `AdsBanner` (src/components/ads-banner.tsx) las lee en cada
 * plantilla y no pinta nada si la zona está vacía, inactiva o fuera de fecha.
 */

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adsZones } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { AD_ZONE_SPECS, positionOf, suffixOf } from "@/lib/ads-positions";

export type AdsZoneState = { ok: boolean; message: string } | null;

function fechaOpcional(v: FormDataEntryValue | null): Date | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Guarda la creatividad de una zona. La pauta llega a producción en cuanto se
 * marca activa: no pasa por revisión editorial, a diferencia de un artículo.
 */
export async function saveAdsZone(_prev: AdsZoneState, formData: FormData): Promise<AdsZoneState> {
  await requireRole("administrador");

  const key = String(formData.get("key") ?? "");
  const position = positionOf(key);
  if (!position) return { ok: false, message: "Falta identificar la zona." };
  const name = String(formData.get("name") ?? "").trim() || AD_ZONE_SPECS[position].label;

  const html = String(formData.get("html") ?? "").trim() || null;
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || null;
  const clickUrl = String(formData.get("clickUrl") ?? "").trim() || null;
  const active = formData.get("active") === "1";

  if (html && imageUrl) {
    return {
      ok: false,
      message: "Usa HTML o imagen, no ambos: si hay HTML, la imagen se ignora y confunde.",
    };
  }
  if (active && !html && !imageUrl) {
    return { ok: false, message: "No se puede activar una zona sin creatividad (HTML o imagen)." };
  }
  if (clickUrl && !/^https?:\/\//i.test(clickUrl)) {
    return { ok: false, message: "El enlace de destino debe empezar por http:// o https://" };
  }
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    return { ok: false, message: "La URL de la imagen debe empezar por http:// o https://" };
  }

  const startsAt = fechaOpcional(formData.get("startsAt"));
  const endsAt = fechaOpcional(formData.get("endsAt"));
  if (startsAt && endsAt && startsAt > endsAt) {
    return { ok: false, message: "La fecha de inicio es posterior a la de fin." };
  }

  await db
    .insert(adsZones)
    .values({ key, name, html, imageUrl, clickUrl, active, startsAt, endsAt })
    .onConflictDoUpdate({ target: adsZones.key, set: { html, imageUrl, clickUrl, active, startsAt, endsAt } });

  // La pauta sale en la portada, en cada artículo y en el pie: se refresca
  // todo el sitio público, no solo una ruta.
  revalidatePath("/", "layout");
  revalidatePath("/panel/configuracion");
  revalidatePath("/panel/portada");

  return { ok: true, message: "Zona actualizada." };
}

/** Vacía una zona sin borrar la fila: vuelve a su estado "sin creatividad". */
export async function clearAdsZone(key: string): Promise<void> {
  await requireRole("administrador");
  await db
    .update(adsZones)
    .set({ html: null, imageUrl: null, clickUrl: null, active: false, startsAt: null, endsAt: null })
    .where(eq(adsZones.key, key));
  revalidatePath("/", "layout");
  revalidatePath("/panel/configuracion");
  revalidatePath("/panel/portada");
}

/** Añade otro anuncio (vacío e inactivo) en una posición: `<posición>__N`. */
export async function addAdsZone(position: string): Promise<{ ok: boolean; key?: string; message?: string }> {
  await requireRole("administrador");
  if (!positionOf(position) || position.includes("__")) return { ok: false, message: "Posición no válida." };

  const filas = await db.select({ key: adsZones.key }).from(adsZones);
  const usados = filas.filter((f) => positionOf(f.key) === position).map((f) => suffixOf(f.key));
  const n = Math.max(1, ...usados) + 1;
  if (n > 6) return { ok: false, message: "Máximo 6 anuncios por posición." };

  const key = `${position}__${n}`;
  await db
    .insert(adsZones)
    .values({ key, name: `${AD_ZONE_SPECS[positionOf(position)!].label} · anuncio ${n}`, active: false })
    .onConflictDoNothing();
  revalidatePath("/panel/configuracion");
  revalidatePath("/panel/portada");
  return { ok: true, key };
}

/** Elimina un anuncio añadido. El principal de cada posición no se borra (se vacía). */
export async function deleteAdsZone(key: string): Promise<void> {
  await requireRole("administrador");
  if (!positionOf(key) || !key.includes("__")) return;
  await db.delete(adsZones).where(eq(adsZones.key, key));
  revalidatePath("/", "layout");
  revalidatePath("/panel/configuracion");
  revalidatePath("/panel/portada");
}
