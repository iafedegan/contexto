/**
 * Lógica pura (sin red ni base de datos) para sacar de las notas lo que aún se aloja en la infraestructura del sitio anterior
 * (`storage.contextoganadero.com`, `static.contextoganadero.com` y su bucket de Amazon) y apuntarlo a nuestro almacenamiento.
 * La usa `copiar-archivos-viejos.ts`; está aparte para poder probarla sin credenciales.
 */
import { createHash } from "node:crypto";

/** Servidores del sitio anterior cuyos archivos hay que traer. */
const ORIGEN = /^(?:https?:)?\/\/(storage\.contextoganadero\.com|static\.contextoganadero\.com(?:\.s3\.amazonaws\.com)?)(\/.*)?$/i;
/** Prefijo mal armado que dejó la migración: `http://www.contextoganadero.comhttps://storage…`. */
const PREFIJO_ROTO = /^(?:https?:)?\/\/(?:www\.)?contextoganadero\.com(?=https?:)/i;

/** Qué se hace con cada extensión: se copia al almacenamiento propio, o se deja para otro trato (páginas HTML interactivas). */
export type Clase = "copiar" | "html" | "desconocida";

const TIPOS: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  webm: "video/webm",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
};

/** Decodifica las entidades mínimas que trae un atributo HTML guardado. */
const sinEntidades = (s: string) => s.replace(/&amp;/g, "&").replace(/&#38;/g, "&").replace(/&quot;/g, '"');

/** Dirección canónica (https, sin prefijo roto, espacios codificados) de algo alojado en el sitio anterior; null si es de otro lado. */
export function normalizar(valor: string): string | null {
  let v = sinEntidades(valor.trim()).replace(PREFIJO_ROTO, "");
  if (/^https?:\/\/(?:www\.)?contextoganadero\.com/i.test(v)) return null;
  const m = ORIGEN.exec(v);
  if (!m) return null;
  const host = m[1].toLowerCase();
  let ruta = m[2] ?? "/";
  // Quita la consulta y el ancla: el archivo es el mismo; y codifica espacios y tildes sin doble codificación.
  ruta = ruta.replace(/[?#].*$/, "");
  try {
    ruta = encodeURI(decodeURI(ruta));
  } catch {
    ruta = encodeURI(ruta);
  }
  v = `https://${host}${ruta}`;
  return v;
}

/** Extensión en minúsculas de una dirección normalizada ("" si no tiene). */
export const extension = (origen: string): string => (/\.([A-Za-z0-9]{2,5})$/.exec(origen)?.[1] ?? "").toLowerCase();

export function clasificar(origen: string): Clase {
  const ext = extension(origen);
  if (ext in TIPOS) return "copiar";
  if (ext === "html" || ext === "htm") return "html";
  return "desconocida";
}

export const tipoMime = (origen: string): string => TIPOS[extension(origen)] ?? "application/octet-stream";

/** Nombre del objeto en el bucket «media»: huella del origen + extensión. Sin carpetas (la limpieza diaria solo lista la raíz). */
export const nombreObjeto = (origen: string): string => `leg-${createHash("sha1").update(origen).digest("hex").slice(0, 24)}.${extension(origen)}`;

/** Cada atributo `src`/`href` de la nota que apunta al sitio anterior: su texto tal cual está en el HTML y su dirección canónica. */
export function referencias(html: string): { crudo: string; origen: string }[] {
  const salida: { crudo: string; origen: string }[] = [];
  const vistos = new Set<string>();
  for (const m of html.matchAll(/\b(?:src|href)="([^"]+)"/gi)) {
    if (vistos.has(m[1])) continue;
    const origen = normalizar(m[1]);
    if (origen) {
      vistos.add(m[1]);
      salida.push({ crudo: m[1], origen });
    }
  }
  return salida;
}

/** Cambia cada referencia cuya copia se conoce. Devuelve el HTML nuevo y cuántas direcciones cambió. */
export function reescribir(html: string, nueva: (origen: string) => string | null | undefined): { html: string; cambios: number } {
  let salida = html;
  let cambios = 0;
  for (const { crudo, origen } of referencias(html)) {
    const destino = nueva(origen);
    if (!destino) continue;
    salida = salida.split(`"${crudo}"`).join(`"${destino}"`);
    cambios++;
  }
  return { html: salida, cambios };
}
