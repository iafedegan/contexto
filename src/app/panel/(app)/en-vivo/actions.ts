"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";
import { invalidarCache } from "@/lib/data-cache";
import { EN_VIVO_KEY } from "@/lib/en-vivo";
import { sanitizeEnVivo } from "@/lib/en-vivo-types";

// Estado que se devuelve al formulario: si salió bien y el mensaje.
export type EnVivoState = { ok: boolean; message: string } | null;

/** Enciende, apaga o cambia la transmisión en vivo de la portada. Solo quien puede enviar avisos. */
export async function guardarEnVivo(_prev: EnVivoState, formData: FormData): Promise<EnVivoState> {
  await requirePermiso("avisos");

  const quiereActivar = formData.get("activo") === "on";
  const config = sanitizeEnVivo({
    activo: quiereActivar,
    url: String(formData.get("url") ?? ""),
    titulo: String(formData.get("titulo") ?? ""),
  });
  if (quiereActivar && !config.videoId) {
    return { ok: false, message: "Pega un enlace de YouTube válido (watch, live o youtu.be) para activar la transmisión." };
  }

  await db
    .insert(siteSettings)
    .values({ key: EN_VIVO_KEY, value: config })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: config, updatedAt: sql`now()` } });
  invalidarCache();
  revalidatePath("/", "layout");

  return { ok: true, message: config.activo ? "Transmisión activa: ya aparece en la portada." : "Transmisión apagada: la portada vuelve a la nota principal." };
}
