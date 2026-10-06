/**
 * Reconoce el TIPO REAL de una imagen o un video por los primeros bytes del archivo (su «firma»), en vez de fiarse del
 * tipo que declara quien lo sube (`file.type`, que lo escribe el navegador o quien llama a la API). Sin esto, un HTML o
 * un ejecutable renombrado como `.png` entraba al almacenamiento público con ese tipo (H-22).
 *
 * Es una función pura y sin dependencias: sirve en el servidor y se prueba sin servidor.
 */

/** Lo que se sabe de un archivo reconocido. */
export type TipoMedia = { mime: string; ext: string; kind: "imagen" | "video" };

// ¿Los bytes desde `desde` coinciden con este texto ASCII?
const ascii = (b: Uint8Array, desde: number, texto: string) => [...texto].every((c, i) => b[desde + i] === c.charCodeAt(0));

// Marcas de un contenedor ISO (ftyp) que son imágenes AVIF; cualquier otra marca es un video MP4/MOV.
const MARCAS_AVIF = new Set(["avif", "avis"]);

/** Tipo real del archivo según sus primeros bytes, o `null` si no es una imagen o un video admitido. Basta con ~32 bytes. */
export function tipoPorFirma(b: Uint8Array): TipoMedia | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg", kind: "imagen" };
  if (b[0] === 0x89 && ascii(b, 1, "PNG") && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return { mime: "image/png", ext: "png", kind: "imagen" };
  if (ascii(b, 0, "GIF87a") || ascii(b, 0, "GIF89a")) return { mime: "image/gif", ext: "gif", kind: "imagen" };
  if (ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP")) return { mime: "image/webp", ext: "webp", kind: "imagen" };
  // Contenedor ISO base: 4 bytes de tamaño, «ftyp» y la marca principal. AVIF es imagen; el resto (isom, mp42, avc1, M4V…) es video.
  if (ascii(b, 4, "ftyp")) {
    const marca = String.fromCharCode(b[8], b[9], b[10], b[11]);
    return MARCAS_AVIF.has(marca) ? { mime: "image/avif", ext: "avif", kind: "imagen" } : { mime: "video/mp4", ext: "mp4", kind: "video" };
  }
  // EBML (Matroska/WebM).
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { mime: "video/webm", ext: "webm", kind: "video" };
  return null;
}
