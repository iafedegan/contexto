import { localePath, type Locale } from "@/lib/i18n";

/**
 * Dirección pública de una nota. Las notas migradas del sitio anterior se sirven en SU dirección original (`/regiones/titulo`), sin
 * redirección, para no cambiar ni una URL que ya está indexada; las notas nuevas viven en `/articulo/<slug>`.
 */
export function rutaDeNota(a: { slug: string; legacyPath?: string | null; categorySlug?: string | null }): string {
  if (a.legacyPath) return a.legacyPath;
  return esDeOpinion(a.categorySlug) ? `/columna/${a.slug}` : `/articulo/${a.slug}`;
}

/** Secciones cuyas notas son columnas de opinión: viven en `/columna/<título>`, como las del sitio anterior (y llevan la foto redonda del autor). */
export const SECCIONES_COLUMNA = ["columnas", "columna", "opinion", "columnistas"] as const;
export const esDeOpinion = (categorySlug: string | null | undefined): boolean => !!categorySlug && (SECCIONES_COLUMNA as readonly string[]).includes(categorySlug);

/**
 * Enlace a una nota para un idioma. En inglés la interfaz cambia pero la nota es la misma en español: sigue en `/en/articulo/<slug>`
 * (no hay versión inglesa de la dirección original).
 */
export function hrefNota(locale: Locale, a: { slug: string; legacyPath?: string | null; categorySlug?: string | null }): string {
  return locale === "es" ? rutaDeNota(a) : localePath(locale, `/articulo/${a.slug}`);
}
