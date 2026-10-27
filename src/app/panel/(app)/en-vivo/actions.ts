"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";
import { invalidarCache } from "@/lib/data-cache";
import { EN_VIVO_KEY } from "@/lib/en-vivo";
import { sanitizeEnVivo } from "@/lib/en-vivo-types";
import { enviarAviso } from "@/lib/push";
import { siteUrl } from "@/lib/utils";

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

  const [previo] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, EN_VIVO_KEY)).limit(1);
  const antes = sanitizeEnVivo(previo?.value);

  await db
    .insert(siteSettings)
    .values({ key: EN_VIVO_KEY, value: config })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: config, updatedAt: sql`now()` } });
  invalidarCache();
  revalidatePath("/", "layout");

  // Notifica solo cuando empieza un directo nuevo: guardar de nuevo la misma transmisión no repite el aviso.
  let aviso = "";
  if (config.activo && !(antes.activo && antes.videoId === config.videoId)) {
    const res = await enviarAviso({
      titulo: "🔴 Estamos en vivo",
      cuerpo: config.titulo || "Sigue la transmisión en CONtexto Ganadero.",
      url: `${siteUrl("/en-vivo")}?utm_source=push&utm_medium=notificacion&utm_campaign=en-vivo`,
      tag: "en-vivo",
      urgente: true,
    }).catch(() => null);
    aviso = res ? ` Notificación enviada a ${res.enviados} navegador(es).` : " No se pudo enviar la notificación.";
  }

  return { ok: true, message: (config.activo ? "Transmisión activa: ya aparece en la portada." : "Transmisión apagada: la portada vuelve a la nota principal.") + aviso };
}
