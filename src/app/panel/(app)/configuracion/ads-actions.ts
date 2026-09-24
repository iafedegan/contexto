"use server";

/**
 * Gestión de las zonas de pauta (`ads_zones`) desde el panel.
 *
 * Las siete zonas se siembran una sola vez (ver `src/db/seed-data.ts`) y viven
 * siempre en la base: aquí solo se edita su creatividad, su vigencia y si
 * está activa. `AdsBanner` (src/components/ads-banner.tsx) las lee en cada
 * plantilla y no pinta nada si la zona está vacía, inactiva o fuera de fecha.
 */

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adsZones } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import type { AdZoneKey } from "@/lib/ads";

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

  const key = String(formData.get("key") ?? "") as AdZoneKey;
  if (!key) return { ok: false, message: "Falta identificar la zona." };

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
    .update(adsZones)
    .set({ html, imageUrl, clickUrl, active, startsAt, endsAt })
    .where(eq(adsZones.key, key));

  // La pauta sale en la portada, en cada artículo y en el pie: se refresca
  // todo el sitio público, no solo una ruta.
  revalidatePath("/", "layout");
  revalidatePath("/panel/configuracion");

  return { ok: true, message: "Zona actualizada." };
}

/** Vacía una zona sin borrar la fila: vuelve a su estado "sin creatividad". */
export async function clearAdsZone(key: string): Promise<void> {
  await requireRole("administrador");
  await db
    .update(adsZones)
    .set({ html: null, imageUrl: null, clickUrl: null, active: false, startsAt: null, endsAt: null })
    .where(eq(adsZones.key, key as AdZoneKey));
  revalidatePath("/", "layout");
  revalidatePath("/panel/configuracion");
}
