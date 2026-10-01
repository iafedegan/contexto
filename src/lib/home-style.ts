import type { HomeStyle } from "@/db/schema";
import { HOME_FONTS, homeFontFamily, type HomeTitleFont } from "@/lib/home-fonts";
import { gradientCss, sanitizeGradient } from "@/lib/section-els";

/**
 * Estilo de título fijado a mano en /panel/portada, resuelto a CSS. Compartido
 * por `ArticleCard` y las fichas propias de cada plantilla de portada, para
 * que el control por-tarjeta del panel (fuente, negrilla, cursiva, escala)
 * funcione igual sin importar qué tan distinto sea el diseño de la plantilla.
 */
export function homeStyleTitleCss(
  style: HomeStyle | null | undefined,
  basePx: number,
  lineHeight = 1.2,
): React.CSSProperties {
  const scale = (style?.titleScale ?? 100) / 100;
  const grad = style?.titleGradient;
  return {
    fontSize: style?.titlePx ? `${style.titlePx / 16}rem` : `${(basePx * scale) / 16}rem`,
    ...(grad
      ? {
          backgroundImage: gradientCss(grad),
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
          color: "transparent",
        }
      : {}),
    lineHeight,
    fontFamily: homeFontFamily(style?.font),
    fontWeight: style?.bold ? 800 : undefined,
    fontStyle: style?.italic ? "italic" : undefined,
    // Sin color elegido no se declara la propiedad: el titular sigue heredando
    // el del tema (y sus estados :hover), en vez de quedar congelado.
    ...(grad ? {} : { color: style?.color || undefined }),
  };
}

export function homeStyleImageScale(style: HomeStyle | null | undefined): number {
  return style?.imageScale ?? 100;
}

const HEX = /^#(?:[\da-f]{3}|[\da-f]{6})$/i;
const hex = (v: unknown) => (typeof v === "string" && HEX.test(v) ? v : undefined);
const num = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : undefined;

/** Valida el estilo de una tarjeta antes de guardarlo o de convertirlo en CSS. */
export function sanitizeHomeStyle(input: unknown): HomeStyle | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  const s: HomeStyle = {
    size: r.size === "sm" || r.size === "md" || r.size === "lg" ? r.size : undefined,
    span: r.span === 1 || r.span === 2 ? r.span : undefined,
    font: HOME_FONTS.some((f) => f.id === r.font) ? (r.font as HomeTitleFont) : undefined,
    bold: r.bold === true ? true : undefined,
    italic: r.italic === true ? true : undefined,
    titleScale: num(r.titleScale, 70, 160),
    imageScale: num(r.imageScale, 40, 100),
    color: hex(r.color),
    colSpan: num(r.colSpan, 1, 6),
    height: num(r.height, 60, 1200),
    colStart: num(r.colStart, 1, 6),
    rowStart: num(r.rowStart, 1, 12),
    widthPct: num(r.widthPct, 20, 100),
    blockAlign: r.blockAlign === "left" || r.blockAlign === "center" || r.blockAlign === "right" ? r.blockAlign : undefined,
    bg: hex(r.bg),
    bgGradient: sanitizeGradient(r.bgGradient),
    fg: hex(r.fg),
    radius: num(r.radius, 0, 60),
    pad: num(r.pad, 0, 80),
    textFont: HOME_FONTS.some((f) => f.id === r.textFont) ? (r.textFont as HomeTitleFont) : undefined,
    titlePx: num(r.titlePx, 10, 160),
    titleGradient: sanitizeGradient(r.titleGradient),
  };
  const clean = Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)) as HomeStyle;
  return Object.keys(clean).length ? clean : null;
}

/**
 * Hoja CSS de los bloques libres: una regla por nota con su tamaño, fondo y
 * texto. Se aplica por `data-bslug` (el envoltorio de la portada) o, en las
 * páginas donde no hay envoltorio, a la propia tarjeta (`data-bs-root`).
 */
export function blockStylesCss(items: Array<{ slug: string; homeStyle?: HomeStyle | null }>, scope = "[data-site-root]"): string {
  const rules: string[] = [];
  for (const it of items) {
    const s = sanitizeHomeStyle(it.homeStyle);
    if (!s || !/^[\w-]+$/.test(it.slug)) continue;
    const sel = `${scope} [data-bslug="${it.slug}"],${scope} [data-bs-root="${it.slug}"]:not([data-bslug] *)`;
    const d: string[] = [];
    if (s.colStart) d.push(`grid-column:${s.colStart} / span ${s.colSpan ?? 1}!important`);
    else if (s.colSpan) d.push(`grid-column:span ${s.colSpan} / span ${s.colSpan}!important`);
    if (s.rowStart) d.push(`grid-row-start:${s.rowStart}!important`);
    if (s.height) d.push(`min-height:${s.height}px!important`);
    if (s.widthPct && s.widthPct < 100) {
      d.push(`width:${s.widthPct}%!important`);
      const al = s.blockAlign ?? "left";
      d.push(al === "center" ? "margin-inline:auto!important" : al === "right" ? "margin-left:auto!important" : "margin-right:auto!important");
    }
    if (s.bgGradient) d.push(`background:${gradientCss(s.bgGradient)}!important`);
    else if (s.bg) d.push(`background:${s.bg}!important`);
    if (s.fg) d.push(`color:${s.fg}!important`, `--fg:${s.fg}`, `--ink:${s.fg}`);
    if (s.radius !== undefined) d.push(`border-radius:${s.radius}px!important`, "overflow:hidden!important");
    if (s.pad !== undefined) d.push(`padding:${s.pad}px!important`);
    const fam = homeFontFamily(s.textFont);
    if (fam) d.push(`font-family:${fam}!important`);
    if (d.length) rules.push(`${sel}{${d.join(";")}}`);
    if (fam) rules.push(`${scope} [data-bslug="${it.slug}"] :is(p,span,small,time,li,.kicker,.entry-dek,.meta),${scope} [data-bs-root="${it.slug}"] :is(p,span,small,time,li,.kicker,.entry-dek,.meta){font-family:${fam}!important}`);
  }
  return rules.join("\n");
}
