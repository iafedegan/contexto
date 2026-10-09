import type { HomeStyle } from "@/db/schema";
import { HOME_FONTS, homeFontFamily, type HomeTitleFont } from "@/lib/home-fonts";
import { gradientCss, sanitizeGradient } from "@/lib/section-els";
import { acotar as num, colorHex as hex } from "@/lib/validate";

/**
 * Estilo de título fijado a mano en /panel/portada, resuelto a CSS. Compartido
 * por `ArticleCard` y las fichas propias de cada plantilla de portada, para
 * que el control por-tarjeta del panel (fuente, negrilla, cursiva, escala)
 * funcione igual sin importar qué tan distinto sea el diseño de la plantilla.
 */
/**
 * Tamaño de titular fluido: los grandes (más de 24 px) se reducen en pantallas
 * estrechas —a ~62 % a 360 px— y llegan a su tamaño completo a ~1100 px. Un
 * titular de 56 px en un teléfono ocupaba la pantalla entera.
 */
function fluidRem(px: number): string {
  if (px <= 24) return `${px / 16}rem`;
  const min = Math.max(22, Math.round(px * 0.62));
  const k = ((px - min) / (1100 - 360)).toFixed(4);
  return `clamp(${min / 16}rem, calc(${min / 16}rem + (100vw - 22.5rem) * ${k}), ${px / 16}rem)`;
}

// Estilos CSS del titular de una tarjeta según su configuración manual (tamaño, tipografía, negrilla, cursiva y color).
export function homeStyleTitleCss(
  style: HomeStyle | null | undefined,
  basePx: number,
  lineHeight = 1.2,
): React.CSSProperties {
  const scale = (style?.titleScale ?? 100) / 100;
  const grad = style?.titleGradient;
  return {
    fontSize: style?.titlePx ? `${style.titlePx / 16}rem` : fluidRem(basePx * scale),
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

// Escala de la imagen de una tarjeta en porcentaje; 100 si no se fijó.
export function homeStyleImageScale(style: HomeStyle | null | undefined): number {
  return style?.imageScale ?? 100;
}

/**
 * Caja de la imagen de una tarjeta. El porcentaje de siempre, o medidas exactas en px que mandan sobre él: solo el ancho
 * conserva la proporción de la foto; solo el alto la recorta a esa altura con el ancho de la tarjeta; con las dos, la foto se
 * recorta a esa caja. La imagen nunca pasa del ancho de la tarjeta y el resto (titular, resumen, notas vecinas) sigue el flujo,
 * así que se acomoda solo. `alto` avisa a la tarjeta de que la altura es fija (la imagen debe llenarla, no usar su proporción).
 */
export function homeStyleImageBox(style: HomeStyle | null | undefined): { css: React.CSSProperties | undefined; alto: boolean } {
  const ancho = style?.imageWidth;
  const alto = style?.imageHeight;
  const pct = style?.imageScale ?? 100;
  const css: React.CSSProperties = {};
  if (ancho) {
    css.width = `${ancho}px`;
    css.maxWidth = "100%";
    css.marginInline = "auto";
  } else if (pct !== 100) {
    css.width = `${pct}%`;
    css.marginInline = "auto";
  }
  if (alto) {
    css.height = `${alto}px`;
    css.aspectRatio = "auto";
  }
  return { css: Object.keys(css).length ? css : undefined, alto: !!alto };
}

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
    imageWidth: num(r.imageWidth, 40, 2000),
    imageHeight: num(r.imageHeight, 40, 1600),
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
