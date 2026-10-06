import "server-only";
import { randomUUID } from "node:crypto";
import { tipoPorFirma, type TipoMedia } from "@/lib/media-firma";

/**
 * Acceso al almacenamiento de medios (bucket público «media» de Supabase Storage) por su API REST, sin el SDK. Un solo
 * sitio para subir, firmar, inspeccionar, borrar y listar, que usan las subidas del panel y la limpieza diaria.
 */

// Cubeta de Supabase Storage donde se guardan los medios.
export const BUCKET = "media";
/** 25 MB: suficiente para una foto de portada o un clip corto. */
export const MAX_BYTES_MEDIA = 25 * 1024 * 1024;

// Credenciales del servidor; `null` si falta configurar Supabase.
function credenciales(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}
// Cabeceras de autorización con la clave de servicio.
const auth = (key: string) => ({ Authorization: `Bearer ${key}`, apikey: key });

/** Mensaje cuando falta configurar el almacenamiento. */
export const SIN_STORAGE = "Falta configurar SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el servidor.";

/** Dirección pública de un objeto del bucket. */
export function urlPublicaMedia(path: string): string | null {
  const c = credenciales();
  return c ? `${c.url}/storage/v1/object/public/${BUCKET}/${path}` : null;
}

/** Sube bytes ya validados (con el tipo REAL detectado por su firma) y devuelve su dirección pública. */
export async function subirBytesMedia(bytes: Uint8Array, tipo: TipoMedia): Promise<{ ok: true; url: string; path: string } | { ok: false; error: string }> {
  const c = credenciales();
  if (!c) return { ok: false, error: SIN_STORAGE };
  const path = `${randomUUID()}.${tipo.ext}`;
  const res = await fetch(`${c.url}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { ...auth(c.key), "Content-Type": tipo.mime, "x-upsert": "false" },
    body: Buffer.from(bytes),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) return { ok: false, error: `No se pudo subir el archivo a Supabase (${res.status}).` };
  return { ok: true, url: urlPublicaMedia(path)!, path };
}

/** Pide una dirección de subida firmada para que el navegador envíe el archivo DIRECTO al almacenamiento (sin pasar por la función, que en Vercel admite ~4,5 MB). */
export async function firmarSubidaMedia(path: string): Promise<{ ok: true; uploadUrl: string } | { ok: false; error: string }> {
  const c = credenciales();
  if (!c) return { ok: false, error: SIN_STORAGE };
  const res = await fetch(`${c.url}/storage/v1/object/upload/sign/${BUCKET}/${path}`, {
    method: "POST",
    headers: { ...auth(c.key), "Content-Type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return { ok: false, error: `No se pudo preparar la subida (${res.status}).` };
  const data = (await res.json()) as { url?: string };
  if (!data.url) return { ok: false, error: "Supabase no devolvió la dirección de subida." };
  return { ok: true, uploadUrl: data.url.startsWith("http") ? data.url : `${c.url}/storage/v1${data.url}` };
}

/** Lo que se sabe de un objeto ya subido, leyendo solo sus primeros bytes. */
export type InspeccionMedia = { ok: true; tipo: TipoMedia | null; contentType: string; bytes: number | null } | { ok: false; error: string };

/** Lee los primeros bytes de un objeto (y su tipo y tamaño servidos) para comprobar que es lo que dice ser. */
export async function inspeccionarMedia(path: string): Promise<InspeccionMedia> {
  const c = credenciales();
  if (!c) return { ok: false, error: SIN_STORAGE };
  const res = await fetch(`${c.url}/storage/v1/object/${BUCKET}/${path}`, { headers: { ...auth(c.key), Range: "bytes=0-63" }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return { ok: false, error: `No se encontró el archivo subido (${res.status}).` };
  // Se leen como mucho 64 bytes: si el servidor ignora `Range` y envía el archivo entero, se corta la lectura.
  const lector = res.body?.getReader();
  const trozos: Uint8Array[] = [];
  let total = 0;
  while (lector && total < 64) {
    const { done, value } = await lector.read();
    if (done || !value) break;
    trozos.push(value);
    total += value.length;
  }
  await lector?.cancel().catch(() => {});
  const cabeza = new Uint8Array(Math.min(total, 64));
  let pos = 0;
  for (const t of trozos) {
    const n = Math.min(t.length, cabeza.length - pos);
    cabeza.set(t.subarray(0, n), pos);
    pos += n;
  }
  // Tamaño real: de `Content-Range: bytes 0-63/TOTAL` si hay rango; si no, de `Content-Length`.
  const rango = res.headers.get("content-range")?.match(/\/(\d+)$/)?.[1];
  const largo = rango ?? res.headers.get("content-length");
  return { ok: true, tipo: tipoPorFirma(cabeza), contentType: (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase(), bytes: largo ? Number(largo) : null };
}

/** Borra un objeto del bucket. `true` si ya no existe. */
export async function borrarMedia(path: string): Promise<boolean> {
  const c = credenciales();
  if (!c) return false;
  try {
    const res = await fetch(`${c.url}/storage/v1/object/${BUCKET}/${path}`, { method: "DELETE", headers: auth(c.key), signal: AbortSignal.timeout(15_000) });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

/** Un objeto del bucket, tal como lo lista Storage. */
export type ObjetoMedia = { name: string; createdAt: string };

/** Lista los archivos de la raíz del bucket (las «carpetas» se omiten), de a 1.000, hasta `maximo` (por defecto 20.000). */
export async function listarMedia(maximo = 20_000): Promise<ObjetoMedia[]> {
  const c = credenciales();
  if (!c) return [];
  const salida: ObjetoMedia[] = [];
  for (let offset = 0; offset < maximo; offset += 1000) {
    const res = await fetch(`${c.url}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers: { ...auth(c.key), "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "", limit: 1000, offset, sortBy: { column: "created_at", order: "asc" } }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Storage ${res.status}`);
    const pagina = (await res.json()) as Array<{ id?: string | null; name: string; created_at?: string }>;
    for (const o of pagina) if (o.id && o.created_at) salida.push({ name: o.name, createdAt: o.created_at });
    if (pagina.length < 1000) break;
  }
  return salida;
}
