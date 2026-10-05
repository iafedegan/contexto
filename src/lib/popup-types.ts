/**
 * Ventana emergente (popup) del portal, diseñada en /panel/portada.
 * Sin "server-only": lo comparten el editor (cliente), el popup público y la
 * validación del servidor.
 */
export type PopupConfig = {
  enabled: boolean;
  /** Formato: ventana centrada, franja inferior o tarjeta en la esquina. */
  layout: "modal" | "banner" | "corner";
  /** Medio: sin medio, imagen, vídeo subido o YouTube/Vimeo. */
  mediaType: "none" | "image" | "video" | "embed";
  mediaUrl: string;
  /** Posición del medio en la ventana centrada. */
  mediaPosition: "top" | "left" | "background";
  kicker: string;
  title: string;
  text: string;
  ctaLabel: string;
  ctaUrl: string;
  /** Colores (#rrggbb). */
  bg: string;
  fg: string;
  accent: string;
  /** Ancho de la ventana en px (320-960). */
  width: number;
  radius: number;
  /** Segundos antes de mostrarse. */
  delay: number;
  /** Cada cuánto se repite a un mismo lector. */
  frequency: "always" | "session" | "daily" | "weekly" | "once";
  /** Dónde aparece. */
  pages: "all" | "home" | "articles";
  /** Vigencia opcional (ISO yyyy-mm-dd). */
  startsAt: string;
  endsAt: string;
  /** Cambia al guardar: un popup nuevo vuelve a mostrarse a quien cerró el anterior. */
  version: number;
};

// Ventana emergente por defecto: desactivada.
export const DEFAULT_POPUP: PopupConfig = {
  enabled: false,
  layout: "modal",
  mediaType: "image",
  mediaUrl: "",
  mediaPosition: "top",
  kicker: "Especial",
  title: "Suscríbete al boletín ganadero",
  text: "Recibe cada semana los precios, las alertas sanitarias y las noticias que importan en tu finca.",
  ctaLabel: "Quiero recibirlo",
  ctaUrl: "/#boletin",
  bg: "#ffffff",
  fg: "#16130f",
  accent: "#b45309",
  width: 560,
  radius: 18,
  delay: 4,
  frequency: "daily",
  pages: "all",
  startsAt: "",
  endsAt: "",
  version: 1,
};

// Color hexadecimal de seis dígitos.
const HEX = /^#[\da-f]{6}$/i;
// Devuelve el valor si está entre las opciones permitidas; si no, el de defecto.
const pick = <T extends string>(v: unknown, opts: readonly T[], def: T): T =>
  opts.includes(v as T) ? (v as T) : def;
// Texto recortado al máximo; vacío si el valor no es texto.
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
// Número válido acotado al rango y redondeado; el valor de defecto si no es un número.
const num = (v: unknown, min: number, max: number, def: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : def;
/** Solo URLs http(s) o rutas propias: nada de `javascript:`. */
const url = (v: unknown) => {
  const s = str(v, 600).trim();
  return /^(https?:\/\/|\/)/i.test(s) ? s : "";
};
// Fecha AAAA-MM-DD válida, o vacío.
const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

// Valida y limpia la configuración de la ventana emergente antes de guardarla o pintarla.
export function sanitizePopup(input: unknown): PopupConfig {
  const r = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const d = DEFAULT_POPUP;
  return {
    enabled: r.enabled === true,
    layout: pick(r.layout, ["modal", "banner", "corner"] as const, d.layout),
    mediaType: pick(r.mediaType, ["none", "image", "video", "embed"] as const, d.mediaType),
    mediaUrl: url(r.mediaUrl),
    mediaPosition: pick(r.mediaPosition, ["top", "left", "background"] as const, d.mediaPosition),
    kicker: str(r.kicker, 60),
    title: str(r.title, 140),
    text: str(r.text, 500),
    ctaLabel: str(r.ctaLabel, 40),
    ctaUrl: url(r.ctaUrl),
    bg: typeof r.bg === "string" && HEX.test(r.bg) ? r.bg : d.bg,
    fg: typeof r.fg === "string" && HEX.test(r.fg) ? r.fg : d.fg,
    accent: typeof r.accent === "string" && HEX.test(r.accent) ? r.accent : d.accent,
    width: num(r.width, 320, 960, d.width),
    radius: num(r.radius, 0, 40, d.radius),
    delay: num(r.delay, 0, 120, d.delay),
    frequency: pick(r.frequency, ["always", "session", "daily", "weekly", "once"] as const, d.frequency),
    pages: pick(r.pages, ["all", "home", "articles"] as const, d.pages),
    startsAt: date(r.startsAt),
    endsAt: date(r.endsAt),
    version: num(r.version, 1, 1_000_000, 1),
  };
}
