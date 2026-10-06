import "server-only";
import { tipoPorFirma } from "@/lib/media-firma";
import { subirBytesMedia } from "@/lib/media-storage";

/**
 * Sube bytes de una imagen (portada generada por IA, foto recibida por Telegram) al bucket público «media» de Supabase.
 * Sin permisos propios: quien llama ya los comprobó. El tipo con el que se guarda y se sirve lo decide la FIRMA real de
 * los bytes (H-22), no el que declara quien llama (un modelo de IA puede etiquetar como PNG una imagen JPEG): si no son
 * los de una imagen, no se sube.
 */
export async function subirImagenBytes(bytes: Uint8Array): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const tipo = tipoPorFirma(bytes);
  if (!tipo || tipo.kind !== "imagen") return { ok: false, error: "El archivo no es una imagen válida." };
  const sub = await subirBytesMedia(bytes, tipo);
  return sub.ok ? { ok: true, url: sub.url } : sub;
}
