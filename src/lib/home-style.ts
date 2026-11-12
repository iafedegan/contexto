import type { HomeStyle } from "@/db/schema";
import { HOME_FONTS, homeFontFamily, type HomeTitleFont } from "@/lib/home-fonts";
import { gradientCss, sanitizeGradient } from "@/lib/section-els";
import { acotar as num, colorHex as hex } from "@/lib/validate";
import { MEDIA_PANTALLA, PANTALLAS, estiloEnPantalla } from "@/lib/pantallas";

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

/** Cuánto cambia el titular el tamaño de tarjeta elegido en el panel («Mediana» es el tamaño normal de la plantilla). */
export const FACTOR_TAMANO: Record<NonNullable<HomeStyle["size"]>, number> = { sm: 0.85, md: 1, lg: 1.25 };
// Factor de tamaño del titular de una tarjeta; 1 si no se fijó.
export const factorTamano = (style: HomeStyle | null | undefined) => (style?.size && !style.pantallas ? FACTOR_TAMANO[style.size] : 1);

/**
 * El estilo que la tarjeta puede resolver al pintarse. Con ajustes por pantalla no se sabe en el servidor qué pantalla es: la tarjeta se
 * pinta neutra, con unas marcas en `style` (`--cg-t-esc`, `--cg-caja-foto`, `--cg-mini-foto`, `--cg-hero-foto`), y lo pone `blockStylesCss`.
 */
export const estiloFijo = (style: HomeStyle | null | undefined): HomeStyle | null | undefined => (style?.pantallas ? null : style);

// Estilos CSS del titular de una tarjeta según su configuración manual (tamaño, tipografía, negrilla, cursiva y color).
export function homeStyleTitleCss(
  style: HomeStyle | null | undefined,
  basePx: number,
  lineHeight = 1.2,
): React.CSSProperties {
  if (style?.pantallas) return { fontSize: `var(--cg-t-px, calc(${fluidRem(basePx)} * var(--cg-t-esc, 1)))`, lineHeight };
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
  if (style?.pantallas) return { css: { ["--cg-caja-foto" as string]: "1" }, alto: false };
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
  const pantallas: NonNullable<HomeStyle["pantallas"]> = {};
  for (const id of ["pc", "tablet", "movil"] as const) {
    const propio = (r.pantallas as Record<string, unknown> | undefined)?.[id];
    if (propio && typeof propio === "object") pantallas[id] = sanitizeHomeStyle({ ...propio, pantallas: undefined }) ?? {};
  }
  const s: HomeStyle = {
    pantallas: Object.keys(pantallas).length ? pantallas : undefined,
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
    textPos: r.textPos === "arriba-izq" || r.textPos === "arriba-der" ? r.textPos : undefined,
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

// Declaraciones de la caja de un bloque (posición, tamaño, fondo, texto y forma).
function cajaBloque(s: HomeStyle): string[] {
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
  return d;
}

// Lo que una tarjeta sin ajustes por pantalla resuelve al pintarse (titular, foto, tamaño), como reglas para las marcas que deja en `style`.
function reglasDeTarjeta(s: HomeStyle, en: (interior: string) => string): string[] {
  const out: string[] = [];
  const titulo: string[] = [];
  const fam = homeFontFamily(s.font);
  if (fam) titulo.push(`font-family:${fam}!important`);
  if (s.bold) titulo.push("font-weight:800!important");
  if (s.italic) titulo.push("font-style:italic!important");
  if (s.titleGradient) {
    titulo.push(`background-image:${gradientCss(s.titleGradient)}!important`, "-webkit-background-clip:text!important", "background-clip:text!important", "-webkit-text-fill-color:transparent!important", "color:transparent!important");
  } else if (s.color) titulo.push(`color:${s.color}!important`);
  if (titulo.length) out.push(`${en(`[style*="--cg-t-esc"]`)}{${titulo.join(";")}}`);

  const caja: string[] = [];
  const hero: string[] = [];
  const pct = s.imageScale ?? 100;
  if (s.imageWidth) {
    const w = `width:${s.imageWidth}px!important;max-width:100%!important;margin-inline:auto!important`;
    caja.push(w);
    hero.push(w);
  } else if (pct !== 100) caja.push(`width:${pct}%!important;margin-inline:auto!important`);
  if (s.imageHeight) {
    caja.push(`height:${s.imageHeight}px!important;aspect-ratio:auto!important`);
    hero.push(`height:${s.imageHeight}px!important;min-height:0!important;max-height:none!important`);
    out.push(`${en(`[style*="--cg-caja-foto"]>*`)}{height:100%!important;aspect-ratio:auto!important}`);
  } else if (pct !== 100) hero.push(`height:calc(46dvh * ${pct / 100})!important;min-height:0!important`);
  if (caja.length) out.push(`${en(`[style*="--cg-caja-foto"]`)}{${caja.join(";")}}`);
  if (hero.length) out.push(`${en(`[style*="--cg-hero-foto"]`)}{${hero.join(";")}}`);
  const mini = pct !== 100 ? Math.round((84 * pct) / 100) : undefined;
  const lado = { w: s.imageWidth ?? s.imageHeight ?? mini, h: s.imageHeight ?? s.imageWidth ?? mini };
  if (lado.w && lado.h) out.push(`${en(`[style*="--cg-mini-foto"]`)}{width:${lado.w}px!important;height:${lado.h}px!important}`);

  if (s.size === "sm") out.push(`${en(`:is([style*="--cg-caja-foto"],[style*="--cg-mini-foto"],[data-cg-resumen])`)}{display:none!important}`);
  if (s.size === "lg") out.push(`${en("[data-cg-resumen]")}{-webkit-line-clamp:4!important;line-clamp:4!important}`);
  if (s.textPos) {
    // En la apertura «de cine» el velo oscuro sigue al texto: si el texto sube, el velo se voltea.
    out.push(`${en(".lead-cine-velo")}{transform:scaleY(-1)!important}`);
    out.push(`${en("[data-cg-panel]")}{align-self:start!important;justify-self:${s.textPos === "arriba-der" ? "end" : "start"}!important${s.textPos === "arriba-der" ? ";text-align:right!important" : ""}}`);
  }
  return out;
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
    const en = (interior: string) => `${scope} [data-bslug="${it.slug}"] ${interior},${scope} [data-bs-root="${it.slug}"] ${interior}`;
    // Las reglas de un estilo; con `tarjeta`, también lo que la tarjeta no resolvió al pintarse.
    const reglas = (e: HomeStyle, tarjeta: boolean) => {
      const out: string[] = [];
      const d = cajaBloque(e);
      if (tarjeta) {
        d.push(`--cg-t-esc:${((e.titleScale ?? 100) / 100) * (e.size ? FACTOR_TAMANO[e.size] : 1)}`);
        if (e.titlePx) d.push(`--cg-t-px:${e.titlePx / 16}rem`);
        if (e.span === 2 && !e.colSpan && !e.colStart) d.push("grid-column:span 2 / span 2!important");
      }
      if (d.length) out.push(`${sel}{${d.join(";")}}`);
      const fam = homeFontFamily(e.textFont);
      if (fam) out.push(`${en(":is(p,span,small,time,li,.kicker,.entry-dek,.meta)")}{font-family:${fam}!important}`);
      if (tarjeta) out.push(...reglasDeTarjeta(e, en));
      return out;
    };
    if (s.pantallas) {
      for (const { id } of PANTALLAS) {
        const css = reglas(estiloEnPantalla(s, id), true);
        if (css.length) rules.push(`@media ${MEDIA_PANTALLA[id]}{\n${css.join("\n")}\n}`);
      }
    } else rules.push(...reglas(s, false));
  }
  return rules.join("\n");
}
