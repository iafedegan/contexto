"use server";

/**
 * Subida de medios del panel editorial.
 *
 * En local los archivos van a `public/subidas/`, que Next sirve como estáticos.
 * En producción (Vercel el disco es efímero) esto debe apuntar a Supabase
 * Storage o similar: basta con reemplazar `guardar()` por el SDK del bucket,
 * el resto del editor solo consume la URL devuelta.
 */

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireRole } from "@/lib/auth";

const TIPOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

/** 25 MB: suficiente para una foto de portada o un clip corto. */
const MAX_BYTES = 25 * 1024 * 1024;

export type UploadResult =
  | { ok: true; url: string; kind: "imagen" | "video" }
  | { ok: false; error: string };

export async function uploadMedia(formData: FormData): Promise<UploadResult> {
  await requireRole("redactor");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No llegó ningún archivo." };
  }

  const ext = TIPOS[file.type];
  if (!ext) {
    return {
      ok: false,
      error: `Formato no admitido (${file.type || "desconocido"}). Usa JPG, PNG, WebP, AVIF, GIF, MP4 o WebM.`,
    };
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo son 25 MB.`,
    };
  }

  const dir = path.join(process.cwd(), "public", "subidas");
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));

  return {
    ok: true,
    url: `/subidas/${name}`,
    kind: file.type.startsWith("video/") ? "video" : "imagen",
  };
}
