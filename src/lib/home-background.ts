import type { CSSProperties } from "react";
import type { HomeBackground } from "@/db/schema";

/**
 * Fondo de portada elegido en /panel/portada, resuelto a variables CSS.
 *
 * No se pinta con `background-color` a secas: se sobrescriben los tokens del
 * tema (`--bg`, `--bg-2`, `--nav-bg`) para que TODO lo que ya los usa —
 * cabecera, tarjetas, filetes, pie — quede en tono con el nuevo fondo sin
 * tocar un solo componente.
 */
export const DEFAULT_HOME_BACKGROUND: HomeBackground = { mode: "theme" };

/** Sugerencias por si el editor no quiere elegir color a mano. */
export const BACKGROUND_PRESETS: Array<{ label: string; value: HomeBackground }> = [
  { label: "Esmeralda", value: { mode: "gradient", from: "#05100b", to: "#0d2318", angle: 160 } },
  { label: "Obsidiana", value: { mode: "gradient", from: "#0a0b0d", to: "#1a1430", angle: 160 } },
  { label: "Papel", value: { mode: "gradient", from: "#faf7f0", to: "#efe7d8", angle: 160 } },
  { label: "Cobre", value: { mode: "gradient", from: "#140f0a", to: "#3a2416", angle: 150 } },
  { label: "Zafiro", value: { mode: "gradient", from: "#05070f", to: "#101a3a", angle: 150 } },
  { label: "Marfil", value: { mode: "solid", from: "#f7f4ee" } },
  { label: "Tinta", value: { mode: "solid", from: "#0c0c0d" } },
];

/** Luminancia relativa (WCAG) de un color #rrggbb. */
function luminance(hex: string): number {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.5;
  const int = parseInt(m[1], 16);
  const srgb = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

/** Mezcla `hex` con blanco o negro (`amount` 0-1) para derivar superficies. */
function shade(hex: string, amount: number, toward: "light" | "dark"): string {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const int = parseInt(m[1], 16);
  const target = toward === "light" ? 255 : 0;
  const mix = [(int >> 16) & 255, (int >> 8) & 255, int & 255]
    .map((c) => Math.round(c + (target - c) * amount))
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("");
  return `#${mix}`;
}

/**
 * Tokens de color derivados de un fondo. El texto se deriva del fondo, no del
 * tema: así elegir un color oscuro en una plantilla clara (o al revés) nunca
 * deja titulares ilegibles. Lo usan el fondo global y el de cada componente.
 */
export function derivePalette(base: string): Record<string, string> {
  const dark = isDark(base);
  const fg = dark ? "#f6f4ee" : "#14120f";
  const fgMuted = dark ? shade(fg, 0.38, "dark") : shade(fg, 0.42, "light");
  return {
    "--bg": base,
    "--bg-2": shade(base, 0.08, dark ? "light" : "dark"),
    "--nav-bg": shade(base, 0.05, dark ? "light" : "dark"),
    "--surface": dark ? shade(base, 0.07, "light") : shade(base, 0.04, "dark"),
    "--surface-2": shade(base, dark ? 0.12 : 0.07, dark ? "light" : "dark"),
    "--fg": fg,
    "--fg-muted": fgMuted,
    "--border": dark ? shade(base, 0.16, "light") : shade(base, 0.12, "dark"),
  };
}

export function isDark(hex: string): boolean {
  return luminance(hex) < 0.42;
}

export function mutedOf(fg: string): string {
  return isDark(fg) ? shade(fg, 0.42, "light") : shade(fg, 0.38, "dark");
}

/**
 * Devuelve el `style` para el contenedor de la plantilla. `undefined` cuando
 * el fondo es el del tema (no se inyecta nada y manda `globals.css`).
 */
export function homeBackgroundStyle(bg?: HomeBackground): CSSProperties | undefined {
  if (!bg || bg.mode === "theme" || !bg.from) return undefined;

  const style: CSSProperties & Record<string, string> = { ...derivePalette(bg.from) };

  if (bg.mode === "gradient" && bg.to) {
    const angle = bg.angle ?? 160;
    // `background-image` sobre el `background-color` del tema: el color sólido
    // queda como fallback si el degradado no se puede pintar.
    style.backgroundImage = `linear-gradient(${angle}deg, ${bg.from} 0%, ${bg.to} 100%)`;
    style.backgroundAttachment = "fixed";
    // La cabecera se apoya en el primer punto del degradado para fundirse.
    style["--nav-bg"] = bg.from;
  }

  return style;
}
