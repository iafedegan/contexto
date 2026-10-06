import { confirmarSubidaMedia, prepararSubidaMedia, uploadMedia, type UploadResult } from "@/app/panel/(app)/articulos/media-actions";

/** Hasta este tamaño el archivo viaja por la propia acción del servidor; más grande, directo al almacenamiento. */
const MAX_POR_ACCION = 3.5 * 1024 * 1024;

/**
 * Sube una imagen o un video desde el navegador y devuelve su dirección pública. Los pequeños pasan por la acción
 * `uploadMedia`; los grandes (hasta 25 MB) se envían directo a Supabase Storage con una dirección firmada y después se
 * confirman: la función de Vercel no admite cuerpos de más de ~4,5 MB, así que no podían pasar por ella.
 */
export async function subirMedia(file: File): Promise<UploadResult> {
  if (file.size <= MAX_POR_ACCION) {
    const fd = new FormData();
    fd.set("file", file);
    return uploadMedia(fd);
  }
  const preparada = await prepararSubidaMedia({ name: file.name, type: file.type, size: file.size });
  if (!preparada.ok) return preparada;
  const put = await fetch(preparada.uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
  if (!put.ok) return { ok: false, error: `No se pudo subir el archivo (${put.status}).` };
  return confirmarSubidaMedia({ path: preparada.path });
}
