/**
 * Dirección de la versión optimizada de una imagen (`/_next/image`, WebP redimensionado y guardado 31 días en la red de Vercel) en
 * lugar de su original en Supabase Storage. La usa la lectura sin conexión (/api/offline): bajar el original de cada portada
 * (PNG de 2-3 MB) desde cada teléfono era casi todo el «cached egress» de Supabase.
 */

/** Ancho que se descarga para leer sin conexión: uno de `images.deviceSizes` (next.config.ts), así que ya existe en la caché de Vercel. */
export const ANCHO_SIN_CONEXION = 640;
/** Calidad por defecto de next/image (una de `images.qualities`). */
const CALIDAD = 75;

/** `/_next/image?url=…&w=…&q=…`, igual que la arma el cargador por defecto de next/image; `null` si la dirección no sirve. */
export function urlImagenOptimizada(src: string, ancho: number = ANCHO_SIN_CONEXION): string | null {
  const s = src.trim();
  if (!s || /\.svg(\?|$)/i.test(s)) return null;
  const valida = s.startsWith("/") ? !s.startsWith("//") : /^https:\/\//i.test(s);
  if (!valida) return null;
  return `/_next/image?url=${encodeURIComponent(s)}&w=${ancho}&q=${CALIDAD}`;
}
