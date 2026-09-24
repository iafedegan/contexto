import type { HomeTitleFont } from "@/lib/home-fonts";
import { homeFontFamily } from "@/lib/home-fonts";
import { derivePalette, mutedOf } from "@/lib/home-background";

/**
 * Estilo por COMPONENTE de la plantilla (navbar, hero, cuerpo, tarjetas, pie),
 * editable en /panel/portada y válido para las cinco plantillas.
 *
 * No toca los componentes: cada uno lleva un `data-region` y aquí se genera
 * una hoja CSS que sobrescribe los tokens del tema dentro de esa región
 * (colores, tipografías) y unas pocas propiedades de caja (aire, radios,
 * ancho). Todo valor se valida antes de convertirse en CSS: el JSON viene de
 * la base de datos y no debe poder inyectar reglas.
 */

export type RegionId = "navbar" | "hero" | "body" | "cards" | "footer";

export type RegionStyle = {
  /** Fondo del componente. */
  bg?: string;
  /** Color del texto. */
  fg?: string;
  /** Color de acento (enlaces, filetes, etiquetas). */
  accent?: string;
  /** Tipografía de los titulares. */
  titleFont?: HomeTitleFont;
  /** Tipografía del texto corrido y menús. */
  textFont?: HomeTitleFont;
  /** Tamaño de los titulares, en % (70-160). */
  titleScale?: number;
  /** Tamaño del texto, en % (80-140). */
  textScale?: number;
  /** Relleno vertical, en px (0-120). */
  padY?: number;
  /** Relleno horizontal, en px (0-120). */
  padX?: number;
  /** Radio de las esquinas, en px (0-48). */
  radius?: number;
  /** Ancho máximo del contenido, en px (720-1920). Solo navbar, cuerpo y pie. */
  maxWidth?: number;
  /** Alineación del texto. */
  align?: "left" | "center" | "right";
  /** Ocultar el componente (solo tiene sentido en algunos). */
  hidden?: boolean;
};

export type RegionStyles = Partial<Record<RegionId, RegionStyle>>;

export const REGIONS: Array<{
  id: RegionId;
  label: string;
  description: string;
  /** Controles que tienen sentido para este componente. */
  controls: Array<keyof RegionStyle>;
}> = [
  {
    id: "navbar",
    label: "Navbar",
    description: "Cabecera con el logo, la fecha y el menú de secciones.",
    controls: ["bg", "fg", "accent", "titleFont", "textFont", "titleScale", "textScale", "padY", "maxWidth", "align"],
  },
  {
    id: "hero",
    label: "Hero",
    description: "La noticia principal de la portada (o el carrusel en Revista).",
    controls: ["bg", "fg", "accent", "titleFont", "textFont", "titleScale", "textScale", "padY", "padX", "radius", "align"],
  },
  {
    id: "cards",
    label: "Tarjetas",
    description: "Todas las demás noticias: «En breve», «Lo último» y la cuadrícula.",
    controls: ["bg", "fg", "accent", "titleFont", "textFont", "titleScale", "textScale", "padY", "padX", "radius", "align"],
  },
  {
    id: "body",
    label: "Cuerpo",
    description: "El lienzo de la página entre la cabecera y el pie.",
    controls: ["bg", "fg", "accent", "titleFont", "textFont", "titleScale", "textScale", "padY", "maxWidth"],
  },
  {
    id: "footer",
    label: "Footer",
    description: "Pie con secciones, enlaces legales y firma.",
    controls: ["bg", "fg", "accent", "titleFont", "textFont", "titleScale", "textScale", "padY", "maxWidth", "align", "hidden"],
  },
];

export const RANGES = {
  titleScale: { min: 70, max: 160, step: 5, unit: "%" },
  textScale: { min: 80, max: 140, step: 5, unit: "%" },
  padY: { min: 0, max: 120, step: 4, unit: "px" },
  padX: { min: 0, max: 120, step: 4, unit: "px" },
  radius: { min: 0, max: 48, step: 2, unit: "px" },
  maxWidth: { min: 720, max: 1920, step: 40, unit: "px" },
} as const;

const HEX = /^#(?:[\da-f]{3}|[\da-f]{6})$/i;
const color = (v: unknown) => (typeof v === "string" && HEX.test(v) ? v : undefined);
const num = (v: unknown, key: keyof typeof RANGES) => {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  const r = RANGES[key];
  return Math.min(r.max, Math.max(r.min, Math.round(v)));
};

/** Normaliza un valor de la BD a un `RegionStyles` seguro. */
export function sanitizeRegions(input: unknown): RegionStyles {
  if (!input || typeof input !== "object") return {};
  const out: RegionStyles = {};
  for (const { id } of REGIONS) {
    const raw = (input as Record<string, unknown>)[id];
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const s: RegionStyle = {
      bg: color(r.bg),
      fg: color(r.fg),
      accent: color(r.accent),
      titleFont: homeFontFamily(r.titleFont as HomeTitleFont) ? (r.titleFont as HomeTitleFont) : undefined,
      textFont: homeFontFamily(r.textFont as HomeTitleFont) ? (r.textFont as HomeTitleFont) : undefined,
      titleScale: num(r.titleScale, "titleScale"),
      textScale: num(r.textScale, "textScale"),
      padY: num(r.padY, "padY"),
      padX: num(r.padX, "padX"),
      radius: num(r.radius, "radius"),
      maxWidth: num(r.maxWidth, "maxWidth"),
      align: r.align === "left" || r.align === "center" || r.align === "right" ? r.align : undefined,
      hidden: r.hidden === true ? true : undefined,
    };
    const clean = Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)) as RegionStyle;
    if (Object.keys(clean).length) out[id] = clean;
  }
  return out;
}

const TITLES = ":is(h1,h2,h3,h4,.lx-display)";
const TEXT = ":is(p,li,time,small,dd,dt,figcaption,nav a)";

/** Hoja CSS con los estilos de cada componente. Cadena vacía si no hay nada. */
export function regionsCss(input: RegionStyles | undefined, scope = "[data-site-root]"): string {
  const regions = sanitizeRegions(input);
  const rules: string[] = [];

  for (const { id } of REGIONS) {
    const s = regions[id];
    if (!s) continue;
    const sel = `${scope} [data-region="${id}"]`;
    const decl: string[] = [];

    if (s.hidden) {
      rules.push(`${sel}{display:none!important}`);
      continue;
    }
    if (s.bg) {
      const p = derivePalette(s.bg);
      for (const [k, v] of Object.entries(p)) decl.push(`${k}:${v}`);
      decl.push(`--paper:${s.bg}`, `--paper-2:${p["--bg-2"]}`, `--rule:${p["--border"]}`);
      decl.push(`--ink:${p["--fg"]}`, `--ink-soft:${p["--fg-muted"]}`, `--ink-faint:${p["--fg-muted"]}`);
      decl.push(`background:${s.bg}!important`, `color:${p["--fg"]}`);
    }
    if (s.fg) {
      const muted = mutedOf(s.fg);
      decl.push(`--fg:${s.fg}`, `--ink:${s.fg}`, `--fg-muted:${muted}`, `--ink-soft:${muted}`, `--ink-faint:${muted}`, `color:${s.fg}`);
    }
    if (s.accent) {
      decl.push(`--accent:${s.accent}`, `--brand:${s.accent}`, `--brand-ink:${s.accent}`, `--rule-strong:${s.accent}`, `--link:${s.accent}`);
    }
    if (s.textFont) {
      const f = homeFontFamily(s.textFont)!;
      decl.push(`--font-body:${f}`, `--font-ui:${f}`, `--font-sans:${f}`, `--font-serif:${f}`, `font-family:${f}`);
      rules.push(`${sel} ${TEXT}{font-family:${f}}`);
    }
    if (s.titleFont) {
      const f = homeFontFamily(s.titleFont)!;
      decl.push(`--font-display:${f}`);
      rules.push(`${sel} ${TITLES}{font-family:${f}!important}`);
    }
    // `zoom` escala el tamaño de letra y su interlineado a la vez, respetando
    // la jerarquía que cada plantilla ya tiene entre sus titulares.
    if (s.titleScale && s.titleScale !== 100) rules.push(`${sel} ${TITLES}{zoom:${s.titleScale / 100}}`);
    if (s.textScale && s.textScale !== 100) rules.push(`${sel} ${TEXT}{zoom:${s.textScale / 100}}`);
    if (s.padY !== undefined) decl.push(`padding-top:${s.padY}px!important`, `padding-bottom:${s.padY}px!important`);
    if (s.padX !== undefined) decl.push(`padding-left:${s.padX}px!important`, `padding-right:${s.padX}px!important`);
    if (s.radius !== undefined) {
      decl.push(`--radius:${s.radius}px`, `--radius-lg:${s.radius}px`, `border-radius:${s.radius}px`, "overflow:hidden");
      rules.push(`${sel} > *{border-radius:${s.radius}px}`);
    }
    if (s.maxWidth) {
      decl.push(`--maxw:min(${s.maxWidth}px,94vw)`);
      rules.push(`${sel} .shell,${sel}.shell{max-width:min(${s.maxWidth}px,94vw)}`);
    }
    if (s.align) {
      decl.push(`text-align:${s.align}`);
      if (s.align === "center") rules.push(`${sel} :is(nav ul,nav > div){justify-content:center}`);
    }

    if (decl.length) rules.unshift(`${sel}{${decl.join(";")}}`);
  }
  return rules.join("\n");
}
