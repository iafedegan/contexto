import "server-only";
import sharp from "sharp";

/**
 * Deja una imagen lista para publicar como portada: WebP, EXACTAMENTE 16:9, de un ancho que sirve a Discover (≥ 1200 px) sin pasarse y con un peso
 * que carga rápido. Se usa con las portadas que genera la IA (salen de ~3 MB y a veces a 43:24, casi 16:9): se recortan al centro a 16:9, se
 * redimensionan a `anchoMax` si son mayores (nunca se amplían), se comprimen como WebP y, si aún pesan más que `pesoMaxBytes`, se baja la calidad
 * por pasos hasta que entren.
 */
export type OpcionesWebp = { anchoMax?: number; pesoMaxBytes?: number; calidadInicial?: number };
export type ImagenWebp = { bytes: Uint8Array; ancho: number; alto: number; calidad: number };

export const ANCHO_MAX_PORTADA = 2048;
export const PESO_MAX_PORTADA = 500 * 1024;

export async function aWebp(entrada: Uint8Array, { anchoMax = ANCHO_MAX_PORTADA, pesoMaxBytes = PESO_MAX_PORTADA, calidadInicial = 84 }: OpcionesWebp = {}): Promise<ImagenWebp> {
  const origen = await sharp(entrada, { failOn: "none" }).rotate().toBuffer({ resolveWithObject: true });
  const ancho = Math.min(anchoMax, origen.info.width);
  const alto = Math.round((ancho * 9) / 16);
  const base = sharp(origen.data).resize({ width: ancho, height: alto, fit: "cover", position: "centre" });
  let calidad = calidadInicial;
  let salida = await base.clone().webp({ quality: calidad, effort: 5 }).toBuffer({ resolveWithObject: true });
  // Baja la calidad por pasos mientras pese de más (sin pasar de un mínimo en el que ya se nota).
  while (salida.data.length > pesoMaxBytes && calidad > 58) {
    calidad -= 6;
    salida = await base.clone().webp({ quality: calidad, effort: 5 }).toBuffer({ resolveWithObject: true });
  }
  return { bytes: new Uint8Array(salida.data), ancho: salida.info.width, alto: salida.info.height, calidad };
}
