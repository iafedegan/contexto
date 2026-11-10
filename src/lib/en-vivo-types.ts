import { parseEmbed } from "@/lib/embeds";

/** Lo último que se vio en el canal al revisarlo solo (modo automático). */
export type EstadoCanal = "vivo" | "programado" | "sin" | "error";

/** Transmisión en vivo de la portada (fila `en_vivo` de site_settings). Sin `server-only`: lo valida también el panel. */
export type EnVivoConfig = {
  activo: boolean;
  /** Enlace pegado por la persona (watch, live, youtu.be…); solo se guarda si es de YouTube. */
  url: string;
  /** Id del video de YouTube extraído de `url`. */
  videoId: string;
  titulo: string;
  /** Modo automático: el cron revisa el canal y enciende (o apaga) la transmisión cuando el canal empieza (o termina) un directo. */
  auto: boolean;
  /** Canal que se vigila: `@usuario` o `channel/UC…`. */
  canal: string;
  /** Quién encendió la transmisión: lo encendido a mano nunca lo apaga el modo automático. */
  origen: "manual" | "auto";
  /** Última revisión automática (ISO), qué se vio y, si hay un directo programado, para cuándo (ISO). */
  revisado: string;
  estadoCanal: EstadoCanal | "";
  programado: string;
  /** Revisiones seguidas sin directo mientras está encendida en automático: se apaga a la segunda, para no parpadear por un fallo suelto. */
  sinVivo: number;
  /** Directo que alguien apagó a mano en el panel: el modo automático no lo vuelve a encender (sí el siguiente). */
  descartado: string;
};

/** El canal de YouTube del medio. */
export const CANAL_POR_DEFECTO = "@ContextoGanadero";

export const DEFAULT_EN_VIVO: EnVivoConfig = {
  activo: false, url: "", videoId: "", titulo: "", auto: false, canal: CANAL_POR_DEFECTO, origen: "manual", revisado: "", estadoCanal: "", programado: "", sinVivo: 0, descartado: "",
};

/** De lo que pegue la persona (enlace del canal, @usuario o id UC…) a la ruta del canal en YouTube: `@usuario` o `channel/UC…`; "" si no sirve. */
export function normalizarCanal(entrada: string): string {
  const s = entrada.trim();
  const uc = s.match(/(?:^|\/channel\/)(UC[A-Za-z0-9_-]{20,30})(?:[/?#]|$)/);
  if (uc) return `channel/${uc[1]}`;
  const handle = s.match(/(?:^|youtube\.com\/|^)@([A-Za-z0-9._-]{3,40})(?:[/?#]|$)/) ?? s.match(/^@?([A-Za-z0-9._-]{3,40})$/);
  return handle ? `@${handle[1]}` : "";
}

const iso = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(v) ? v : "");

/** Normaliza lo que llega del formulario o de la base: solo YouTube, textos acotados, y sin video no hay transmisión activa. */
export function sanitizeEnVivo(input: unknown): EnVivoConfig {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const url = typeof o.url === "string" ? o.url.trim().slice(0, 300) : "";
  const embed = url ? parseEmbed(url) : null;
  const videoId = embed?.tipo === "youtube" ? embed.id : "";
  const titulo = typeof o.titulo === "string" ? o.titulo.trim().slice(0, 140) : "";
  const canal = typeof o.canal === "string" ? normalizarCanal(o.canal) : "";
  const estado = o.estadoCanal;
  return {
    activo: o.activo === true && Boolean(videoId),
    url: videoId ? url : "",
    videoId,
    titulo,
    auto: o.auto === true,
    canal: canal || CANAL_POR_DEFECTO,
    origen: o.origen === "auto" ? "auto" : "manual",
    revisado: iso(o.revisado),
    estadoCanal: estado === "vivo" || estado === "programado" || estado === "sin" || estado === "error" ? estado : "",
    programado: iso(o.programado),
    sinVivo: Math.min(10, Math.max(0, Math.round(Number(o.sinVivo) || 0))),
    descartado: typeof o.descartado === "string" && /^[A-Za-z0-9_-]{11}$/.test(o.descartado) ? o.descartado : "",
  };
}
