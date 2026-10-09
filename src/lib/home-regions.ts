import type { Gradient } from "@/db/schema";
import type { HomeTitleFont } from "@/lib/home-fonts";
import { gradientCss, sanitizeGradient } from "@/lib/section-els";
import { homeFontFamily } from "@/lib/home-fonts";
import { derivePalette, mutedOf } from "@/lib/home-background";
import { acotar, colorHex as color } from "@/lib/validate";

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

export type RegionId = "navbar" | "hero" | "body" | "cards" | "footer" | "encabezado";

/** Colores de un componente: los que pueden ser distintos en modo claro y en modo oscuro. */
export type RegionColors = { bg?: string; bgGradient?: Gradient; fg?: string; accent?: string };

// Estilos editables de un componente de la portada (fondo, colores, escalas…).
export type RegionStyle = {
  /** Colores solo para el modo claro: mandan sobre los de arriba (que valen para los dos modos) cuando el sitio se ve claro. */
  claro?: RegionColors;
  /** Colores solo para el modo oscuro: mandan sobre los de arriba cuando el sitio se ve oscuro. */
  oscuro?: RegionColors;
  /** Fondo del componente. */
  bg?: string;
  /** Degradado de fondo (si está, manda sobre `bg`). */
  bgGradient?: Gradient;
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
  /** Espacio superior, en px (0-240): lo que separa el contenido de la barra de arriba. Solo el cuerpo. */
  padTop?: number;
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

// Estilos por región; cada región es opcional.
export type RegionStyles = Partial<Record<RegionId, RegionStyle>>;

// Catálogo de regiones editables con su etiqueta y los ajustes que admiten.
export const REGIONS: Array<{
  id: RegionId;
  label: string;
  description: string;
  /** Controles que tienen sentido para este componente. */
  controls: Array<keyof RegionStyle>;
}> = [
  {
    id: "navbar",
    label: "Cabecera",
    description: "Cabecera con el logo, la fecha y el menú de secciones.",
    controls: ["bg", "fg", "accent", "titleFont", "textFont", "titleScale", "textScale", "padY", "maxWidth", "align"],
  },
  {
    id: "hero",
    label: "Principal",
    description: "La noticia principal de la portada (o el carrusel, en la plantilla Revista).",
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
    controls: ["bg", "bgGradient", "fg", "accent", "titleFont", "textFont", "titleScale", "textScale", "padTop", "padY", "maxWidth"],
  },
  {
    id: "encabezado",
    label: "Encabezado",
    description: "Migas, etiqueta, título, descripción, datos y filtros de la sección.",
    controls: ["bg", "bgGradient", "fg", "accent", "padY", "padX", "radius", "align"],
  },
  {
    id: "footer",
    label: "Pie",
    description: "Pie con secciones, enlaces legales y firma.",
    controls: ["bg", "fg", "accent", "titleFont", "textFont", "titleScale", "textScale", "padY", "maxWidth", "align", "hidden"],
  },
];

// Rangos permitidos (mínimo, máximo, paso y unidad) de cada ajuste numérico.
export const RANGES = {
  titleScale: { min: 70, max: 160, step: 5, unit: "%" },
  textScale: { min: 80, max: 140, step: 5, unit: "%" },
  padY: { min: 0, max: 120, step: 4, unit: "px" },
  padTop: { min: 0, max: 240, step: 4, unit: "px" },
  padX: { min: 0, max: 120, step: 4, unit: "px" },
  radius: { min: 0, max: 48, step: 2, unit: "px" },
  maxWidth: { min: 720, max: 1920, step: 40, unit: "px" },
} as const;

// Valida un número y lo acota al rango de su ajuste.
const num = (v: unknown, key: keyof typeof RANGES) => acotar(v, RANGES[key].min, RANGES[key].max);

// Valida los colores de un modo (claro u oscuro); `undefined` si no queda ninguno.
function sanitizeColors(raw: unknown): RegionColors | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const c: RegionColors = { bg: color(r.bg), bgGradient: sanitizeGradient(r.bgGradient), fg: color(r.fg), accent: color(r.accent) };
  const clean = Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined)) as RegionColors;
  return Object.keys(clean).length ? clean : undefined;
}

/** Normaliza un valor de la BD a un `RegionStyles` seguro. */
export function sanitizeRegions(input: unknown): RegionStyles {
  if (!input || typeof input !== "object") return {};
  const out: RegionStyles = {};
  for (const { id } of REGIONS) {
    const raw = (input as Record<string, unknown>)[id];
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const s: RegionStyle = {
      claro: sanitizeColors(r.claro),
      oscuro: sanitizeColors(r.oscuro),
      bg: color(r.bg),
      bgGradient: sanitizeGradient(r.bgGradient),
      fg: color(r.fg),
      accent: color(r.accent),
      titleFont: homeFontFamily(r.titleFont as HomeTitleFont) ? (r.titleFont as HomeTitleFont) : undefined,
      textFont: homeFontFamily(r.textFont as HomeTitleFont) ? (r.textFont as HomeTitleFont) : undefined,
      titleScale: num(r.titleScale, "titleScale"),
      textScale: num(r.textScale, "textScale"),
      padY: num(r.padY, "padY"),
      padTop: num(r.padTop, "padTop"),
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

// Selector CSS de los titulares.
const TITLES = ":is(h1,h2,h3,h4,.lx-display)";
// Selector CSS del texto corrido.
const TEXT = ":is(p,li,time,small,dd,dt,figcaption,nav a)";

// Las declaraciones CSS de los colores de un componente (fondo, degradado, texto, acento).
function coloresDecl(s: RegionColors): string[] {
  const decl: string[] = [];
  if (s.bgGradient && !s.bg) {
    // Degradado de fondo: el texto se deriva del primer color y el fondo se pinta aparte.
    const p = derivePalette(s.bgGradient.from);
    for (const [k, v] of Object.entries(p)) decl.push(`${k}:${v}`);
    decl.push(`--paper:${s.bgGradient.from}`, `--ink:${p["--fg"]}`, `color:${p["--fg"]}`);
  }
  if (s.bgGradient) decl.push(`background:${gradientCss(s.bgGradient)}!important`);
  if (s.bg) {
    const p = derivePalette(s.bg);
    for (const [k, v] of Object.entries(p)) decl.push(`${k}:${v}`);
    decl.push(`--paper:${s.bg}`, `--paper-2:${p["--bg-2"]}`, `--rule:${p["--border"]}`);
    decl.push(`--ink:${p["--fg"]}`, `--ink-soft:${p["--fg-muted"]}`, `--ink-faint:${p["--fg-muted"]}`);
    if (!s.bgGradient) decl.push(`background:${s.bg}!important`);
    decl.push(`color:${p["--fg"]}`);
  }
  if (s.fg) {
    const muted = mutedOf(s.fg);
    decl.push(`--fg:${s.fg}`, `--ink:${s.fg}`, `--fg-muted:${muted}`, `--ink-soft:${muted}`, `--ink-faint:${muted}`, `color:${s.fg}`);
  }
  if (s.accent) {
    decl.push(`--accent:${s.accent}`, `--brand:${s.accent}`, `--brand-ink:${s.accent}`, `--rule-strong:${s.accent}`, `--link:${s.accent}`);
  }
  return decl;
}

// Plantillas que, sin preferencia del lector, se ven oscuras (las mismas que el interruptor de modo del sitio).
const PLANTILLAS_OSCURAS = ["home", "esmeralda", "revista", "vanguardia"];

/**
 * Selectores de un componente cuando el sitio se VE en un modo: el elegido por el lector (`html[data-dark]`) o, si no eligió,
 * el propio de la plantilla. Llevan más peso que la regla base, así que mandan sobre los colores «de los dos modos».
 */
function selectoresDeModo(modo: "claro" | "oscuro", scope: string, id: string): string {
  const comp = ` [data-region="${id}"]`;
  const nativas = PLANTILLAS_OSCURAS.map((t) => `[data-theme="${t}"]`).join(",");
  return modo === "oscuro"
    ? `html[data-dark="1"] ${scope}${comp},html:not([data-dark]) ${scope}:is(${nativas})${comp}`
    : `html[data-dark="0"] ${scope}${comp},html:not([data-dark]) ${scope}:not(:is(${nativas}))${comp}`;
}

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
    decl.push(...coloresDecl(s));
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
    if (s.padTop !== undefined) {
      // La cabecera de la página (migas + título) trae su propio aire arriba: se
      // anula para que el espacio superior sea exactamente el elegido.
      decl.push(`padding-top:${s.padTop}px!important`);
      rules.push(`${sel} > header:first-of-type{padding-top:0!important}`);
    }
    if (s.padX !== undefined) decl.push(`padding-left:${s.padX}px!important`, `padding-right:${s.padX}px!important`);
    if (s.radius !== undefined) {
      decl.push(`--radius:${s.radius}px`, `--radius-lg:${s.radius}px`, `border-radius:${s.radius}px`, "overflow:hidden");
      rules.push(`${sel} > *{border-radius:${s.radius}px}`);
    }
    if (s.maxWidth) {
      // Cada navbar/footer fija su ancho con su propio contenedor (max-w-5xl,
      // max-w-7xl…); se sobrescriben esos contenedores principales, no los
      // pequeños internos (selector de idioma, textos cortos).
      const w = `min(${s.maxWidth}px,94vw)`;
      decl.push(`--maxw:${w}`);
      rules.push(
        `${sel} .shell,${sel}.shell,${sel} :is(.max-w-3xl,.max-w-4xl,.max-w-5xl,.max-w-6xl,.max-w-7xl){max-width:${w}!important}`,
      );
    }
    if (s.align) {
      // Texto y también las filas flexibles (logo, menú, enlaces), que no
      // obedecen a text-align.
      const justify = { left: "flex-start", center: "center", right: "flex-end" }[s.align];
      decl.push(`text-align:${s.align}`);
      // Los bloques centrados con `mx-auto` (descripción, líneas decorativas) también se pegan al lado elegido.
      if (s.align !== "center") {
        rules.push(`${sel} .mx-auto{margin-left:${s.align === "left" ? "0" : "auto"}!important;margin-right:${s.align === "left" ? "auto" : "0"}!important}`);
      }
      rules.push(
        `${sel} :is(p,h1,h2,h3,h4,figcaption,.text-center,.text-left,.text-right){text-align:${s.align}!important}`,
        `${sel} :is(.flex,.lx-navrail,.inline-flex){justify-content:${justify}!important}`,
        `${sel} :is(.mx-auto.flex,.lx-navrail){flex-wrap:wrap}`,
      );
    }

    if (decl.length) rules.unshift(`${sel}{${decl.join(";")}}`);
    // Colores distintos según el modo con el que se ve el sitio: pisan a los de «los dos modos».
    for (const modo of ["claro", "oscuro"] as const) {
      const c = s[modo];
      const d = c ? coloresDecl(c) : [];
      if (d.length) rules.push(`${selectoresDeModo(modo, scope, id)}{${d.join(";")}}`);
    }
  }
  return rules.join("\n");
}
