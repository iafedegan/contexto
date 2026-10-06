"use server";

/**
 * Subida de medios del panel editorial.
 *
 * Va a Supabase Storage (bucket público "media") vía su API REST, sin el SDK
 * `@supabase/supabase-js`, para no sumar una dependencia nueva solo por esto.
 * En Vercel el disco es efímero — `public/subidas/` nunca sobrevivía a una
 * segunda petición, así que la imagen "se subía" pero desaparecía enseguida.
 *
 * Dos caminos (H-22):
 *  - Archivos pequeños (hasta ~3,5 MB) llegan por la propia acción (`uploadMedia`).
 *  - Archivos grandes (hasta 25 MB) se suben DIRECTO del navegador al almacenamiento con una dirección firmada
 *    (`prepararSubidaMedia` → PUT → `confirmarSubidaMedia`). Antes se anunciaba un máximo de 25 MB, pero la función de
 *    Vercel solo admite ~4,5 MB por petición, así que todo lo grande fallaba.
 *
 * En ambos casos el tipo del archivo se decide por sus primeros bytes (su firma), nunca por lo que declara el navegador.
 * Cada persona puede subir hasta 60 archivos por hora. Los archivos que nadie usa se borran solos (ver
 * `src/lib/media-limpieza.ts`).
 */

import { randomUUID } from "node:crypto";
import { requirePermiso } from "@/lib/auth";
import { hit } from "@/lib/rate-limit";
import { tipoPorFirma } from "@/lib/media-firma";
import { MAX_BYTES_MEDIA, SIN_STORAGE, borrarMedia, firmarSubidaMedia, inspeccionarMedia, subirBytesMedia, urlPublicaMedia } from "@/lib/media-storage";

// Tipos que se aceptan DECLARAR y su extensión (la firma real decide después).
const TIPOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};
// Formatos que se muestran a la persona cuando uno no es admitido.
const FORMATOS = "JPG, PNG, WebP, AVIF, GIF, MP4 o WebM";
/** Archivos que pasan por la propia acción: bajo el tope de ~4,5 MB por petición de Vercel, con margen. */
const MAX_DIRECTO = 4 * 1024 * 1024;
// Subidas por persona y hora.
const CUPO_POR_HORA = 60;

// Resultado de subir un archivo: su dirección pública y tipo, o un error.
export type UploadResult =
  | { ok: true; url: string; kind: "imagen" | "video" }
  | { ok: false; error: string };

// Comprueba el cupo de subidas de la persona.
async function dentroDelCupo(userId: string): Promise<boolean> {
  return (await hit(`media:${userId}`, CUPO_POR_HORA, 3600)).allowed;
}
// Texto de error para un formato no admitido.
const formatoNoAdmitido = (declarado: string) => `Formato no admitido (${declarado || "desconocido"}). Usa ${FORMATOS}.`;
// Texto de error para un archivo demasiado grande.
const demasiadoGrande = (bytes: number) => `El archivo pesa ${(bytes / 1024 / 1024).toFixed(1)} MB y el máximo son ${MAX_BYTES_MEDIA / 1024 / 1024} MB.`;

// Sube una imagen o un video pequeño tras comprobar, por su firma, que de verdad lo es.
export async function uploadMedia(formData: FormData): Promise<UploadResult> {
  const user = await requirePermiso("articulos");
  if (!(await dentroDelCupo(user.id))) return { ok: false, error: "Has subido muchos archivos en la última hora. Espera un poco e inténtalo de nuevo." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No llegó ningún archivo." };
  if (file.size > MAX_BYTES_MEDIA) return { ok: false, error: demasiadoGrande(file.size) };
  if (file.size > MAX_DIRECTO) return { ok: false, error: "Este archivo es grande para enviarlo así; vuelve a intentarlo (se sube directo al almacenamiento)." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const tipo = tipoPorFirma(bytes);
  if (!tipo) return { ok: false, error: formatoNoAdmitido(file.type) };

  const sub = await subirBytesMedia(bytes, tipo);
  return sub.ok ? { ok: true, url: sub.url, kind: tipo.kind } : sub;
}

// Resultado de preparar una subida directa: la dirección firmada y la ruta, o un error.
export type PrepararSubidaResult = { ok: true; uploadUrl: string; path: string } | { ok: false; error: string };

/** Paso 1 de una subida grande: valida el tipo declarado y el tamaño, aparta el cupo y devuelve una dirección firmada. */
export async function prepararSubidaMedia(input: { name: string; type: string; size: number }): Promise<PrepararSubidaResult> {
  const user = await requirePermiso("articulos");
  if (!(await dentroDelCupo(user.id))) return { ok: false, error: "Has subido muchos archivos en la última hora. Espera un poco e inténtalo de nuevo." };
  const ext = TIPOS[String(input.type ?? "")];
  if (!ext) return { ok: false, error: formatoNoAdmitido(input.type) };
  const size = Number(input.size);
  if (!Number.isFinite(size) || size <= 0) return { ok: false, error: "No llegó ningún archivo." };
  if (size > MAX_BYTES_MEDIA) return { ok: false, error: demasiadoGrande(size) };

  const path = `${randomUUID()}.${ext}`;
  const firma = await firmarSubidaMedia(path);
  return firma.ok ? { ok: true, uploadUrl: firma.uploadUrl, path } : firma;
}

/**
 * Paso 2 de una subida grande: ya con el archivo en el almacenamiento, lee sus primeros bytes y comprueba que es una
 * imagen o un video de verdad, que se sirve con ese mismo tipo y que no supera el máximo. Si algo no cuadra, lo BORRA.
 */
export async function confirmarSubidaMedia(input: { path: string }): Promise<UploadResult> {
  await requirePermiso("articulos");
  // Solo objetos de la raíz con el formato de nombre que genera `prepararSubidaMedia`: no sirve para tocar otros.
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp|avif|gif|mp4|webm)$/.test(String(input.path ?? ""))) return { ok: false, error: "Subida no válida." };

  const info = await inspeccionarMedia(input.path);
  if (!info.ok) return info;
  if (!info.tipo || info.contentType !== info.tipo.mime || (info.bytes ?? 0) > MAX_BYTES_MEDIA) {
    await borrarMedia(input.path);
    return { ok: false, error: info.bytes && info.bytes > MAX_BYTES_MEDIA ? demasiadoGrande(info.bytes) : `El archivo no es una imagen o un video válido. Usa ${FORMATOS}.` };
  }
  const url = urlPublicaMedia(input.path);
  return url ? { ok: true, url, kind: info.tipo.kind } : { ok: false, error: SIN_STORAGE };
}
