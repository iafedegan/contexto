import type { Gradient, SectionElId, SectionElStyle } from "@/db/schema";
import { HOME_FONTS, homeFontFamily, type HomeTitleFont } from "@/lib/home-fonts";
import { acotar, colorHex as hex } from "@/lib/validate";

/**
 * Cada elemento suelto del encabezado de una sección (migas, etiqueta, título,
 * descripción, datos, filtros) se estila por separado: tipografía, tamaño EXACTO
 * en px, grosor, color o degradado, mayúsculas y espaciado. Valen para TODAS las
 * plantillas porque cada una marca esos elementos con `data-el` (ver
 * src/components/section/section-layout.tsx); aquí solo se genera la hoja CSS.
 * Todo valor se valida antes de convertirse en CSS.
 */
export const SECTION_ELS: Array<{ id: SectionElId; label: string; hint: string; gradient: boolean }> = [
  { id: "breadcrumb", label: "Migas", hint: "Inicio / Sección", gradient: false },
  { id: "kicker", label: "Etiqueta", hint: "La palabra «Sección» sobre el título", gradient: true },
  { id: "title", label: "Título", hint: "El nombre de la sección", gradient: true },
  { id: "description", label: "Descripción", hint: "La frase bajo el título", gradient: true },
  { id: "chips", label: "Datos", hint: "Publicaciones · actualizado", gradient: false },
  { id: "filters", label: "Filtros", hint: "Atajos de fecha y subsección", gradient: false },
];

// Rangos permitidos (tamaño y espaciado entre letras) de los textos del encabezado de sección.
export const EL_RANGES = {
  size: { min: 8, max: 220 },
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
  for (const { id, gradient } of SECTION_ELS) {
    const raw = (input as Record<string, unknown>)[id];
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const weight = typeof r.weight === "number" && (WEIGHTS as readonly number[]).includes(r.weight) ? r.weight : undefined;
    const s: SectionElStyle = {
      font: HOME_FONTS.some((f) => f.id === r.font) ? (r.font as HomeTitleFont) : undefined,
      size: clamp(r.size, EL_RANGES.size.min, EL_RANGES.size.max),
      weight,
      color: hex(r.color),
      gradient: gradient ? sanitizeGradient(r.gradient) : undefined,
      upper: r.upper === true ? true : r.upper === false ? false : undefined,
      tracking: clamp(r.tracking, EL_RANGES.tracking.min, EL_RANGES.tracking.max),
    };
    const clean = Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)) as SectionElStyle;
    if (Object.keys(clean).length) out[id] = clean;
  }
  return out;
}

/** Hoja CSS de los elementos del encabezado. Cadena vacía si no hay nada. */
export function sectionElsCss(input: unknown, scope = "[data-site-root]"): string {
  const els = sanitizeSectionEls(input);
  const rules: string[] = [];
  for (const { id } of SECTION_ELS) {
    const s = els[id];
    if (!s) continue;
    const sel = `${scope} [data-el="${id}"]`;
    const all = `${sel},${sel} *`;
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
      rules.unshift(`${sel}{background-image:none!important}`);
    }
    if (d.length) rules.push(`${all}{${d.join(";")}}`);
    // En móvil un tamaño de escritorio desborda: se reduce a ~70 % si es grande.
    if (s.size !== undefined && s.size > 24) {
      rules.push(`@media(max-width:640px){${all}{font-size:${Math.max(12, Math.round(s.size * 0.7))}px!important}}`);
    }
  }
  return rules.join("\n");
}
