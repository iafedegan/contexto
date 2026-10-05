import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Une clases CSS resolviendo los conflictos de Tailwind.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Base absoluta del sitio, para canónicas, sitemaps, Open Graph y enlaces
 * firmados.
 *
 * Se comprueba que la variable tenga contenido y no solo que esté definida:
 * en Vercel, `NEXT_PUBLIC_SITE_URL` llega como cadena vacía cuando no se ha
 * configurado, y `??` no la descarta porque "" no es null. Eso hacía fallar el
 * build entero con `Invalid URL`.
 *
 * Sin variable propia se usa el dominio que asigna Vercel: primero el de
 * producción, que es estable, y si no el de este despliegue concreto.
 */
function baseUrl(): string {
  const propia = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (propia) return propia.replace(/\/$/, "");

  const produccion = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (produccion) return `https://${produccion}`;

  const despliegue = process.env.VERCEL_URL?.trim();
  if (despliegue) return `https://${despliegue}`;

  return "http://localhost:3000";
}

// Dirección absoluta de una ruta del sitio.
export function siteUrl(path = "/"): string {
  return new URL(path, baseUrl()).toString();
}

// Convierte un texto en una dirección legible: minúsculas, sin tildes ni símbolos.
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 96);
}

/**
 * Fecha larga. El idioma viene de la INTERFAZ, no del contenido: en la versión
 * inglesa del sitio "19 de septiembre de 2026" se lee "September 19, 2026",
 * aunque la nota siga en español.
 */
export function formatDate(date: Date | string, locale: string = "es-CO"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  // Zona fija: el servidor (UTC) y el navegador (Colombia) daban días distintos
  // entre las 19:00 y las 24:00 y React fallaba al hidratar (error #418).
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Bogota",
  }).format(d);
}

/** Estima tokens de forma barata (~4 chars/token) para topes de presupuesto. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
