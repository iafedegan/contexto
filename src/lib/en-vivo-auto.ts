import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { descargarSeguro } from "@/lib/safe-fetch";
import { invalidarCache } from "@/lib/data-cache";
import { enviarAviso } from "@/lib/push";
import { getSiteIdentity } from "@/lib/site-identity";
import { siteUrl } from "@/lib/utils";
import { EN_VIVO_KEY } from "@/lib/en-vivo";
import { sanitizeEnVivo, type EnVivoConfig } from "@/lib/en-vivo-types";
import { leerPaginaLive, type LecturaCanal } from "@/lib/en-vivo-youtube";

/** Descarga y lee la página `/live` del canal; null si YouTube no respondió (no se toma como «terminó el directo»). */
export async function revisarCanal(canal: string): Promise<LecturaCanal | null> {
  const r = await descargarSeguro(new URL(`https://www.youtube.com/${canal}/live`), {
    maxBytes: 4_000_000,
    plazoMs: 12_000,
    // Sin el aviso de cookies de Europa y en español; un navegador cualquiera.
    cabeceras: { "User-Agent": "Mozilla/5.0 (compatible; ContextoGanaderoBot/1.0)", "Accept-Language": "es-CO,es;q=0.9", Cookie: "SOCS=CAI; CONSENT=YES+" },
  });
  return r ? leerPaginaLive(r.cuerpo) : null;
}

/** El aviso a los suscriptores de que empezó una transmisión (el mismo que manda el panel al encenderla a mano). */
export async function avisarEnVivo(config: EnVivoConfig): Promise<{ enviados: number } | null> {
  return enviarAviso({
    titulo: `🔴 Estamos en vivo desde ${(await getSiteIdentity().catch(() => ({ name: "CONtexto Ganadero Media" }))).name}`,
    cuerpo: config.titulo || "Sigue la transmisión ahora.",
    url: `${siteUrl("/en-vivo")}?utm_source=push&utm_medium=notificacion&utm_campaign=en-vivo`,
    tag: "en-vivo",
    urgente: true,
  }).catch(() => null);
}

export type ResultadoAuto = { cambio: "encendida" | "apagada" | "cambio-de-video" | "ninguno"; estado: string; videoId?: string };

/**
 * Lo que hace el cron (cada pocos minutos) con el modo automático encendido:
 * - el canal está en vivo y la portada no → la enciende con ese video y avisa a los suscriptores;
 * - estaba encendida en automático y el canal pasó a otro directo → cambia el video;
 * - estaba encendida en automático y el canal ya no transmite (dos revisiones seguidas) → la apaga.
 * Lo encendido a mano no se toca. Si YouTube no responde, no se cambia nada.
 */
export async function aplicarEnVivoAutomatico(): Promise<ResultadoAuto> {
  const leer = async (tx: Pick<typeof db, "select">, bloquear: boolean) => {
    const q = tx.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, EN_VIVO_KEY)).limit(1);
    const [fila] = bloquear ? await q.for("update") : await q;
    return sanitizeEnVivo(fila?.value);
  };
  const previo = await leer(db, false);
  if (!previo.auto) return { cambio: "ninguno", estado: "apagado" };

  // Primero se mira YouTube (puede tardar), y solo después se toma la fila con FOR UPDATE: lo que alguien guarde a mano en el panel
  // mientras tanto no se pisa, porque la decisión se toma sobre lo que haya en ese momento.
  const lectura = await revisarCanal(previo.canal);
  const ahora = new Date().toISOString();

  const { guardado, cambio } = await db.transaction(async (tx) => {
    const antes = await leer(tx, true);
    let nuevo: EnVivoConfig = { ...antes, revisado: ahora, estadoCanal: lectura ? lectura.estado : "error", programado: lectura?.estado === "programado" ? lectura.programado : "" };
    let cambio: ResultadoAuto["cambio"] = "ninguno";
    if (!antes.auto) return { guardado: antes, cambio };

    if (lectura?.estado === "vivo") {
      nuevo.sinVivo = 0;
      const url = `https://www.youtube.com/watch?v=${lectura.videoId}`;
      if (!antes.activo && antes.descartado !== lectura.videoId) {
        nuevo = { ...nuevo, activo: true, url, videoId: lectura.videoId, titulo: lectura.titulo || antes.titulo, origen: "auto", descartado: "" };
        cambio = "encendida";
      } else if (antes.origen === "auto" && antes.videoId !== lectura.videoId) {
        nuevo = { ...nuevo, url, videoId: lectura.videoId, titulo: lectura.titulo || antes.titulo };
        cambio = "cambio-de-video";
      }
    } else if (lectura && antes.activo && antes.origen === "auto") {
      nuevo.sinVivo = antes.sinVivo + 1;
      if (nuevo.sinVivo >= 2) {
        nuevo = { ...nuevo, activo: false, sinVivo: 0 };
        cambio = "apagada";
      }
    }
    const guardado = sanitizeEnVivo(nuevo);
    await tx
      .insert(siteSettings)
      .values({ key: EN_VIVO_KEY, value: guardado })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value: guardado, updatedAt: sql`now()` } });
    return { guardado, cambio };
  });

  if (cambio !== "ninguno") {
    invalidarCache();
    if (cambio === "encendida" || cambio === "cambio-de-video") await avisarEnVivo(guardado);
  }
  return { cambio, estado: guardado.estadoCanal, videoId: guardado.videoId || undefined };
}
