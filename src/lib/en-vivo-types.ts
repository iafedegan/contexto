import { parseEmbed } from "@/lib/embeds";

/** Transmisión en vivo de la portada (fila `en_vivo` de site_settings). Sin `server-only`: lo valida también el panel. */
export type EnVivoConfig = {
  activo: boolean;
  /** Enlace pegado por la persona (watch, live, youtu.be…); solo se guarda si es de YouTube. */
  url: string;
  /** Id del video de YouTube extraído de `url`. */
  videoId: string;
  titulo: string;
};

export const DEFAULT_EN_VIVO: EnVivoConfig = { activo: false, url: "", videoId: "", titulo: "" };

/** Normaliza lo que llega del formulario o de la base: solo YouTube, textos acotados, y sin video no hay transmisión activa. */
export function sanitizeEnVivo(input: unknown): EnVivoConfig {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const url = typeof o.url === "string" ? o.url.trim().slice(0, 300) : "";
  const embed = url ? parseEmbed(url) : null;
  const videoId = embed?.tipo === "youtube" ? embed.id : "";
  const titulo = typeof o.titulo === "string" ? o.titulo.trim().slice(0, 140) : "";
  return { activo: o.activo === true && Boolean(videoId), url: videoId ? url : "", videoId, titulo };
}
