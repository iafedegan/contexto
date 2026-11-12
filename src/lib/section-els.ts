import type { Gradient, SectionElId, SectionElStyle } from "@/db/schema";
import { HOME_FONTS, homeFontFamily, type HomeTitleFont } from "@/lib/home-fonts";
import { acotar, colorHex as hex } from "@/lib/validate";
import { selectoresDeModo } from "@/lib/modo-selectores";

/**
 * Cada elemento suelto del encabezado de una sección (migas, etiqueta, título,
 * descripción, datos, filtros) se estila por separado: tipografía, tamaño EXACTO
 * en px, grosor, color o degradado, mayúsculas y espaciado. Valen para TODAS las
 * plantillas porque cada una marca esos elementos con `data-el` (ver
 * src/components/section/section-layout.tsx); aquí solo se genera la hoja CSS.
 * Todo valor se valida antes de convertirse en CSS.
 */
export const SECTION_ELS: Array<{ id: SectionElId; label: string; hint: string; gradient: boolean; /** Dónde vive: el encabezado de una sección, una nota o la cabecera del sitio. */ group?: "nota" | "cabecera" }> = [
  { id: "breadcrumb", label: "Migas", hint: "Inicio / Sección", gradient: false },
  { id: "kicker", label: "Etiqueta", hint: "La palabra «Sección» sobre el título", gradient: true },
  { id: "title", label: "Título", hint: "El nombre de la sección", gradient: true },
  { id: "description", label: "Descripción", hint: "La frase bajo el título", gradient: true },
  { id: "chips", label: "Datos", hint: "Publicaciones · actualizado", gradient: false },
  { id: "filters", label: "Filtros", hint: "Atajos de fecha y subsección", gradient: false },
  { id: "n-title", label: "Titular", hint: "El título de la nota", gradient: true, group: "nota" },
  { id: "n-excerpt", label: "Resumen", hint: "La frase bajo el titular", gradient: true, group: "nota" },
  { id: "n-byline", label: "Autor y fecha", hint: "Quién firma, fecha y minutos de lectura", gradient: false, group: "nota" },
  { id: "n-photo", label: "Foto", hint: "La foto de la nota: el tamaño es su ancho en px", gradient: false, group: "nota" },
  { id: "n-body", label: "Texto de la nota", hint: "El cuerpo del artículo", gradient: false, group: "nota" },
  { id: "h-nombre", label: "Nombre del sitio", hint: "«CONtexto Ganadero Media» en la cabecera", gradient: true, group: "cabecera" },
  { id: "h-logo", label: "Logo", hint: "El emblema junto al nombre: el tamaño es su alto en px", gradient: true, group: "cabecera" },
  { id: "h-lema", label: "Lema", hint: "La frase bajo el nombre", gradient: true, group: "cabecera" },
  { id: "h-fecha", label: "Fecha", hint: "El día de hoy bajo el nombre", gradient: false, group: "cabecera" },
  { id: "h-menu", label: "Menú", hint: "Los enlaces de las secciones", gradient: false, group: "cabecera" },
  { id: "h-cintillo", label: "Cintillo", hint: "La franja de titulares que corre arriba", gradient: false, group: "cabecera" },
];

// Rangos permitidos (tamaño y espaciado entre letras) de los textos del encabezado de sección.
export const EL_RANGES = {
  size: { min: 8, max: 220 },
  // Ancho de la foto de la nota, en px.
  photo: { min: 80, max: 1400 },
  // Alto del logo de la cabecera, en px.
  logo: { min: 16, max: 200 },
  tracking: { min: -2, max: 20 },
} as const;

// Grosores de letra permitidos.
export const WEIGHTS = [300, 400, 500, 600, 700, 800, 900] as const;

// Valida un número y lo acota al rango dado, con un decimal.
const clamp = (v: unknown, min: number, max: number) => acotar(v, min, max, 1);

// Valida un degradado (dos colores y un ángulo); undefined si no es válido.
export function sanitizeGradient(input: unknown): Gradient | undefined {
  if (!input || typeof input !== "object") return undefined;
  const g = input as Record<string, unknown>;
  const from = hex(g.from), to = hex(g.to);
  const angle = clamp(g.angle, 0, 360);
  return from && to ? { from, to, angle: angle ?? 90 } : undefined;
}

// Convierte un degradado en la función CSS linear-gradient.
export const gradientCss = (g: Gradient) => `linear-gradient(${g.angle}deg,${g.from},${g.to})`;

/** Normaliza lo guardado a un objeto seguro. */
export function sanitizeSectionEls(input: unknown): Partial<Record<SectionElId, SectionElStyle>> {
  if (!input || typeof input !== "object") return {};
  const out: Partial<Record<SectionElId, SectionElStyle>> = {};
  // Valida un estilo suelto (sin modos).
  const uno = (id: SectionElId, gradient: boolean, r: Record<string, unknown>): SectionElStyle | undefined => {
    const weight = typeof r.weight === "number" && (WEIGHTS as readonly number[]).includes(r.weight) ? r.weight : undefined;
    const s: SectionElStyle = {
      font: HOME_FONTS.some((f) => f.id === r.font) ? (r.font as HomeTitleFont) : undefined,
      size: id === "n-photo" ? clamp(r.size, EL_RANGES.photo.min, EL_RANGES.photo.max) : id === "h-logo" ? clamp(r.size, EL_RANGES.logo.min, EL_RANGES.logo.max) : clamp(r.size, EL_RANGES.size.min, EL_RANGES.size.max),
      weight,
      color: hex(r.color),
      gradient: gradient ? sanitizeGradient(r.gradient) : undefined,
      upper: r.upper === true ? true : r.upper === false ? false : undefined,
      tracking: clamp(r.tracking, EL_RANGES.tracking.min, EL_RANGES.tracking.max),
    };
    const clean = Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)) as SectionElStyle;
    return Object.keys(clean).length ? clean : undefined;
  };
  for (const { id, gradient } of SECTION_ELS) {
    const raw = (input as Record<string, unknown>)[id];
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const base: SectionElStyle = uno(id, gradient, r) ?? {};
    for (const m of ["claro", "oscuro"] as const) {
      const v = r[m] && typeof r[m] === "object" ? uno(id, gradient, r[m] as Record<string, unknown>) : undefined;
      if (v) base[m] = v;
    }
    if (Object.keys(base).length) out[id] = base;
  }
  return out;
}

/** Hoja CSS de los elementos del encabezado. Cadena vacía si no hay nada. */
export function sectionElsCss(input: unknown, scope = "[data-site-root]"): string {
  const els = sanitizeSectionEls(input);
  const rules: string[] = [];
  // Reglas de un estilo sobre un selector (que puede ser una lista: se envuelve en :is()).
  const reglas = (id: SectionElId, s: SectionElStyle, selector: string, conMovil: boolean) => {
    const sel = `:is(${selector})`;
    const all = `${sel},${sel} *`;
    // La foto no lleva letras: «tamaño» es su ancho.
    if (id === "n-photo") {
      if (s.size !== undefined) rules.push(`${sel}{width:${s.size}px!important;max-width:100%!important;margin-inline:auto!important}`);
      return;
    }
    // El logo es una máscara pintada con su fondo: «tamaño» es su alto y el color (o degradado) es el fondo, no el de las letras.
    if (id === "h-logo") {
      // El logo actual es un SVG con su propio color (variables --logo-*, ver `soloColor`): a él solo le toca el alto; el fondo es del emblema antiguo.
      if (s.size !== undefined) rules.push(`svg${sel}{height:${s.size}px!important}`);
      const l: string[] = [];
      if (s.size !== undefined) l.push(`height:${s.size}px!important`);
      if (s.gradient) l.push(`background:${gradientCss(s.gradient)}!important`, "animation:none!important");
      else if (s.color) l.push(`background:${s.color}!important`, "animation:none!important");
      if (l.length) rules.push(`${sel}:not(svg){${l.join(";")}}`);
      return;
    }
    const d: string[] = [];
    const family = homeFontFamily(s.font);
    if (family) d.push(`font-family:${family}!important`);
    if (s.size !== undefined) d.push(`font-size:${s.size}px!important`, "line-height:1.15!important");
    if (s.weight !== undefined) d.push(`font-weight:${s.weight}!important`);
    if (s.tracking !== undefined) d.push(`letter-spacing:${s.tracking}px!important`);
    if (s.upper !== undefined) d.push(`text-transform:${s.upper ? "uppercase" : "none"}!important`);
    if (s.gradient) {
      // Texto con degradado: el fondo del propio elemento recortado a las letras.
      rules.push(
        `${sel}{background-image:${gradientCss(s.gradient)}!important;-webkit-background-clip:text!important;background-clip:text!important;-webkit-text-fill-color:transparent!important;color:transparent!important}`,
      );
    } else if (s.color) {
      d.push(`color:${s.color}!important`, `-webkit-text-fill-color:${s.color}!important`);
      rules.push(`${sel}{background-image:none!important}`);
    }
    if (d.length) rules.push(`${all}{${d.join(";")}}`);
    // Lo que lleva su propio color con sentido (la variación ▲ verde / ▼ roja del cintillo) no se pinta con el color de la pieza.
    if (s.color || s.gradient) rules.push(`${sel} [data-color-propio]{color:var(--color-propio)!important;-webkit-text-fill-color:var(--color-propio)!important;background-image:none!important}`);
    // En móvil un tamaño de escritorio desborda: se reduce a ~70 % si es grande.
    if (conMovil && s.size !== undefined && s.size > 24) {
      rules.push(`@media(max-width:640px){${all}{font-size:${Math.max(12, Math.round(s.size * 0.7))}px!important}}`);
    }
  };
  // Piezas que solo toman el COLOR de otra (no su tamaño ni su letra): «14 años» se pinta como el nombre del sitio.
  const soloColor = (s: SectionElStyle, selector: string) => {
    const sel = `:is(${selector})`;
    // El logo en SVG (components/logo-contexto.tsx) toma su color de las variables --logo-*: degradado = de «desde» a «hasta».
    if (s.gradient) {
      rules.push(`${sel}{background-image:${gradientCss(s.gradient)}!important;-webkit-background-clip:text!important;background-clip:text!important;-webkit-text-fill-color:transparent!important;color:transparent!important;animation:none!important}`);
      rules.push(`svg${sel}{background-image:none!important;--logo-oscuro:${s.gradient.from};--logo-medio:${s.gradient.from};--logo-claro:${s.gradient.to}}`);
    } else if (s.color) {
      rules.push(`${sel}{background-image:none!important;color:${s.color}!important;-webkit-text-fill-color:${s.color}!important}`);
      rules.push(`svg${sel}{--logo-oscuro:${s.color};--logo-medio:${s.color};--logo-claro:${s.color}}`);
    }
  };
  for (const { id } of SECTION_ELS) {
    const s = els[id];
    if (!s) continue;
    const { claro, oscuro, ...base } = s;
    if (id === "h-nombre") {
      // Más peso que los colores de título de la barra (región «navbar»), que si no le ganan.
      const alias = ` [data-color-de="h-nombre"]:not(#_):not(#_)`;
      soloColor(base, `${scope}${alias}`);
      if (claro) soloColor(claro, selectoresDeModo("claro", scope, null, alias));
      if (oscuro) soloColor(oscuro, selectoresDeModo("oscuro", scope, null, alias));
    }
    // El menú tiene estilos propios en sus enlaces (y ajustes viejos de «Menú y secciones»): se sube la especificidad para que la pieza mande en todos.
    const peso = id === "h-menu" ? ":not(#_):not(#_)" : "";
    reglas(id, base, `${scope} [data-el="${id}"]${peso}`, true);
    // Lo de cada modo va después: con el mismo peso (`!important`) y más especificidad, manda sobre «los dos modos».
    if (claro) reglas(id, claro, selectoresDeModo("claro", scope, null, ` [data-el="${id}"]${peso}`), true);
    if (oscuro) reglas(id, oscuro, selectoresDeModo("oscuro", scope, null, ` [data-el="${id}"]${peso}`), true);
  }
  return rules.join("\n");
}
