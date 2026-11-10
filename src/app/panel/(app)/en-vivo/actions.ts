"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";
import { invalidarCache } from "@/lib/data-cache";
import { EN_VIVO_KEY } from "@/lib/en-vivo";
import { normalizarCanal, sanitizeEnVivo } from "@/lib/en-vivo-types";
import { aplicarEnVivoAutomatico, avisarEnVivo } from "@/lib/en-vivo-auto";

// Estado que se devuelve al formulario: si salió bien y el mensaje.
export type EnVivoState = { ok: boolean; message: string } | null;

/**
 * Enciende, apaga o cambia la transmisión en vivo de la portada, y el modo automático (vigilar el canal de YouTube).
 * Solo quien puede enviar avisos. Leer y escribir la fila va en una transacción con FOR UPDATE: el cron del modo automático escribe la misma.
 */
export async function guardarEnVivo(_prev: EnVivoState, formData: FormData): Promise<EnVivoState> {
  await requirePermiso("avisos");

  const quiereActivar = formData.get("activo") === "on";
  const auto = formData.get("auto") === "on";
  const canalTexto = String(formData.get("canal") ?? "");
  const canal = normalizarCanal(canalTexto);
  if (auto && !canal) return { ok: false, message: "Escribe el canal de YouTube a vigilar: su enlace (youtube.com/@canal) o @canal." };

  const resultado = await db.transaction(async (tx) => {
    const [previo] = await tx.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, EN_VIVO_KEY)).limit(1).for("update");
    const antes = sanitizeEnVivo(previo?.value);
    const url = String(formData.get("url") ?? "");
    const config = sanitizeEnVivo({
      ...antes,
      activo: quiereActivar,
      url,
      titulo: String(formData.get("titulo") ?? ""),
      auto,
      canal: canal || antes.canal,
      // Lo que se enciende desde aquí es manual, salvo que siga siendo el mismo directo que encendió el modo automático.
      origen: quiereActivar && antes.activo && antes.origen === "auto" && sanitizeEnVivo({ url }).videoId === antes.videoId ? "auto" : "manual",
      // Apagar a mano un directo que el modo automático encendió: no lo vuelve a encender (sí el próximo).
      descartado: !quiereActivar && antes.activo ? antes.videoId : quiereActivar ? "" : antes.descartado,
      sinVivo: 0,
    });
    if (quiereActivar && !config.videoId) return { error: "Pega un enlace de YouTube válido (watch, live o youtu.be) para activar la transmisión." } as const;
    await tx
      .insert(siteSettings)
      .values({ key: EN_VIVO_KEY, value: config })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value: config, updatedAt: sql`now()` } });
    return { antes, config } as const;
  });
  if ("error" in resultado) return { ok: false, message: resultado.error ?? "" };
  const { antes, config } = resultado;
  invalidarCache();
  revalidatePath("/", "layout");
  revalidatePath("/panel/en-vivo");

  // Notifica solo cuando empieza un directo nuevo: guardar de nuevo la misma transmisión no repite el aviso.
  let aviso = "";
  if (config.activo && !(antes.activo && antes.videoId === config.videoId)) {
    const res = await avisarEnVivo(config);
    aviso = res ? ` Notificación enviada a ${res.enviados} navegador(es).` : " No se pudo enviar la notificación.";
  }
  const modo = config.auto ? ` Modo automático encendido: se revisa ${config.canal} cada 2 minutos.` : "";
  return { ok: true, message: (config.activo ? "Transmisión activa: ya aparece en la portada." : "Transmisión apagada: la portada vuelve a la nota principal.") + aviso + modo };
}

/** «Revisar ahora»: hace en el momento lo que el cron hace cada 2 minutos. */
export async function revisarEnVivoAhora(): Promise<EnVivoState> {
  await requirePermiso("avisos");
  const r = await aplicarEnVivoAutomatico().catch(() => null);
  revalidatePath("/panel/en-vivo");
  if (!r) return { ok: false, message: "No se pudo revisar el canal ahora. Prueba de nuevo en un momento." };
  if (r.estado === "apagado") return { ok: false, message: "Primero enciende el modo automático y guarda." };
  if (r.cambio !== "ninguno") revalidatePath("/", "layout");
  const que: Record<string, string> = {
    encendida: "¡El canal está en vivo! La transmisión ya aparece en la portada y se avisó a los suscriptores.",
    "cambio-de-video": "El canal pasó a otro directo: la portada ya muestra el nuevo.",
    apagada: "El canal terminó la transmisión: la portada vuelve a la nota principal.",
  };
  const estado: Record<string, string> = {
    vivo: "El canal está en vivo.",
    programado: "El canal tiene un directo programado: se encenderá solo cuando empiece.",
    sin: "El canal no está transmitiendo ahora.",
    error: "YouTube no respondió; se vuelve a intentar en 2 minutos.",
  };
  return { ok: r.estado !== "error", message: que[r.cambio] ?? estado[r.estado] ?? "Revisado." };
}
