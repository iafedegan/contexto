import "server-only";
import { randomUUID } from "node:crypto";

// Extensión de archivo que corresponde a cada tipo de imagen admitido.
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Sube bytes de una imagen al bucket público «media» de Supabase. Sin permisos propios: quien llama ya los comprobó. */
export async function subirImagenBytes(bytes: Uint8Array, mime: "image/png" | "image/jpeg" | "image/webp"): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return { ok: false, error: "Falta configurar SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el servidor." };
  const name = `${randomUUID()}.${EXT[mime]}`;
  const res = await fetch(`${supabaseUrl}/storage/v1/object/media/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": mime, "x-upsert": "false" },
    body: Buffer.from(bytes),
  });
  if (!res.ok) return { ok: false, error: `No se pudo subir la imagen a Supabase (${res.status}).` };
  return { ok: true, url: `${supabaseUrl}/storage/v1/object/public/media/${name}` };
}
