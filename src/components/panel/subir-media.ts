import { confirmarSubidaMedia, prepararSubidaMedia, uploadMedia, type UploadResult } from "@/app/panel/(app)/articulos/media-actions";

/** Hasta este tamaño el archivo viaja por la propia acción del servidor; más grande, directo al almacenamiento. */
const MAX_POR_ACCION = 3.5 * 1024 * 1024;

/** Por debajo de este peso una foto ya es liviana y no vale la pena recomprimirla. */
const MIN_PARA_COMPRIMIR = 300 * 1024;
/** Ancho máximo al que se reduce: cubre el mayor tamaño que sirve el sitio (1920 px) con margen. */
const ANCHO_MAX = 2048;

/**
 * Convierte un PNG o JPEG pesado a WebP, sin cambiar su proporción, antes de subirlo: las fotos llegaban de ~3 MB y cada lector que las
 * pedía sin pasar por el optimizador las bajaba enteras (salida de datos de Supabase). Hecho en el navegador porque `sharp` no va en las
 * funciones de Vercel. Se conserva la transparencia; los GIF, WebP, AVIF y video no se tocan. Si algo falla o no se ahorra peso, sube el original.
 */
export async function aWebpEnNavegador(file: File): Promise<File> {
  if (!/^image\/(png|jpeg)$/.test(file.type) || file.size < MIN_PARA_COMPRIMIR) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const escala = Math.min(1, ANCHO_MAX / bmp.width);
    const w = Math.round(bmp.width * escala);
    const h = Math.round(bmp.height * escala);
    const lienzo = document.createElement("canvas");
    lienzo.width = w;
    lienzo.height = h;
    const ctx = lienzo.getContext("2d");
    if (!ctx) {
      bmp.close();
      return file;
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/webp", 0.85));
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}

/**
 * Sube una imagen o un video desde el navegador y devuelve su dirección pública. Los pequeños pasan por la acción
 * `uploadMedia`; los grandes (hasta 25 MB) se envían directo a Supabase Storage con una dirección firmada y después se
 * confirman: la función de Vercel no admite cuerpos de más de ~4,5 MB, así que no podían pasar por ella.
 */
export async function subirMedia(original: File): Promise<UploadResult> {
  const file = await aWebpEnNavegador(original);
  if (file.size <= MAX_POR_ACCION) {
    const fd = new FormData();
    fd.set("file", file);
    return uploadMedia(fd);
  }
  const preparada = await prepararSubidaMedia({ name: file.name, type: file.type, size: file.size });
  if (!preparada.ok) return preparada;
  // Mismo `cache-control` que las subidas del servidor (CACHE_CONTROL_MEDIA en media-storage.ts, que es solo del servidor).
  const put = await fetch(preparada.uploadUrl, { method: "PUT", headers: { "content-type": file.type, "cache-control": "max-age=31536000" }, body: file });
  if (!put.ok) return { ok: false, error: `No se pudo subir el archivo (${put.status}).` };
  return confirmarSubidaMedia({ path: preparada.path });
}
