/**
 * Copia las imágenes (y audios) del sitio anterior a nuestro almacenamiento (bucket público «media» de Supabase Storage), para que
 * las notas sigan viéndose el día que se apague Storyblok. Cada archivo se identifica por la huella de su dirección original, así que
 * es idempotente: repetir la copia no duplica nada. Lleva un registro local (`.migracion-cache/imagenes.jsonl`) de lo ya copiado.
 *
 * Las fotos JPG/PNG se pasan a WebP y se reducen a un máximo de 1.600 px de ancho; las que ya son WebP y caben se suben tal cual.
 */
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { CACHE, credencialesStorage, dormir, pedir } from "./comun";

const BUCKET = "media";
const ANCHO_MAX = 1600;
const ARCHIVO_REGISTRO = join(CACHE, "imagenes.jsonl");

type Entrada = { origen: string; url: string | null; bytes?: number; motivo?: string };

/** Nombre del objeto en el bucket: huella de la dirección original + extensión. Sin carpetas (la limpieza diaria solo lista la raíz). */
export const nombreObjeto = (origen: string, ext: string) => `mig-${createHash("sha1").update(origen).digest("hex").slice(0, 24)}.${ext}`;

const EXT_POR_TIPO: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/svg+xml": "svg", "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/wav": "wav", "audio/x-wav": "wav" };
const TIPO_POR_EXT: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", svg: "image/svg+xml", mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg", wav: "audio/wav" };

export class CopiadorDeImagenes {
  private registro = new Map<string, Entrada>();
  private enCurso = new Map<string, Promise<string | null>>();
  private cred = credencialesStorage();
  private libres: number;
  private cola: Array<() => void> = [];
  /** Cuenta de lo ocurrido en esta corrida, para el informe. */
  estadisticas = { copiadas: 0, yaEstaban: 0, fallidas: 0, bytesSubidos: 0 };

  constructor(concurrencia = 8) {
    this.libres = concurrencia;
    if (existsSync(ARCHIVO_REGISTRO)) {
      for (const l of readFileSync(ARCHIVO_REGISTRO, "utf8").split("\n")) {
        if (!l) continue;
        try {
          const e = JSON.parse(l) as Entrada;
          // Solo vale lo copiado a ESTE almacenamiento (un ensayo contra otro servidor no debe colarse en la carga real).
          if (e.url && !e.url.startsWith(`${this.cred.url}/`)) continue;
          this.registro.set(e.origen, e);
        } catch {
          /* línea cortada: se ignora */
        }
      }
    }
  }

  // Semáforo sencillo: limita cuántas copias corren a la vez.
  private async turno<T>(f: () => Promise<T>): Promise<T> {
    if (this.libres <= 0) await new Promise<void>((ok) => this.cola.push(ok));
    this.libres--;
    try {
      return await f();
    } finally {
      this.libres++;
      this.cola.shift()?.();
    }
  }

  /** Dirección pública nueva de un archivo ya copiado (null si no se pudo copiar o aún no se intentó). */
  conocida(origen: string): string | null | undefined {
    const e = this.registro.get(origen);
    return e ? e.url : undefined;
  }

  /** Copia un archivo (si no estaba) y devuelve su dirección pública; null si no se pudo (queda anotado para no insistir). */
  copiar(origen: string): Promise<string | null> {
    const ya = this.registro.get(origen);
    if (ya) {
      if (ya.url) this.estadisticas.yaEstaban++;
      return Promise.resolve(ya.url);
    }
    let p = this.enCurso.get(origen);
    if (!p) {
      p = this.turno(() => this.copiarUna(origen)).finally(() => this.enCurso.delete(origen));
      this.enCurso.set(origen, p);
    }
    return p;
  }

  private anotar(e: Entrada) {
    this.registro.set(e.origen, e);
    appendFileSync(ARCHIVO_REGISTRO, JSON.stringify(e) + "\n");
  }

  private async copiarUna(origen: string): Promise<string | null> {
    try {
      const r = await pedir(origen, { timeoutMs: 60_000 });
      if (!r.ok) {
        this.estadisticas.fallidas++;
        this.anotar({ origen, url: null, motivo: `HTTP ${r.status}` });
        return null;
      }
      const original = Buffer.from(await r.arrayBuffer());
      const tipoRespuesta = (r.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      const extOrigen = origen.split(".").pop()?.toLowerCase() ?? "";
      let tipo = EXT_POR_TIPO[tipoRespuesta] ? tipoRespuesta : TIPO_POR_EXT[extOrigen] ?? tipoRespuesta;
      let bytes = original;
      if (tipo === "image/jpeg" || tipo === "image/png" || tipo === "image/webp") {
        const img = sharp(original, { failOn: "none" }).rotate();
        const meta = await img.metadata();
        const hayQueReducir = (meta.width ?? 0) > ANCHO_MAX;
        if (tipo !== "image/webp" || hayQueReducir) {
          bytes = await img.resize({ width: ANCHO_MAX, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
          tipo = "image/webp";
        }
      }
      const ext = EXT_POR_TIPO[tipo];
      if (!ext) {
        this.estadisticas.fallidas++;
        this.anotar({ origen, url: null, motivo: `tipo no admitido (${tipoRespuesta || "?"})` });
        return null;
      }
      const nombre = nombreObjeto(origen, ext);
      await this.subir(nombre, bytes, tipo);
      const url = `${this.cred.url}/storage/v1/object/public/${BUCKET}/${nombre}`;
      this.estadisticas.copiadas++;
      this.estadisticas.bytesSubidos += bytes.length;
      this.anotar({ origen, url, bytes: bytes.length });
      return url;
    } catch (e) {
      this.estadisticas.fallidas++;
      // Un fallo de red no se anota como definitivo: se reintentará en la próxima corrida.
      appendFileSync(join(CACHE, "imagenes-fallos.log"), `${origen}\t${e instanceof Error ? e.message : String(e)}\n`);
      return null;
    }
  }

  private async subir(nombre: string, bytes: Buffer, tipo: string): Promise<void> {
    let ultimo = "";
    for (let i = 0; i < 4; i++) {
      const r = await fetch(`${this.cred.url}/storage/v1/object/${BUCKET}/${nombre}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.cred.key}`, apikey: this.cred.key, "Content-Type": tipo, "x-upsert": "true", "cache-control": "max-age=31536000" },
        body: new Uint8Array(bytes),
        signal: AbortSignal.timeout(90_000),
      }).catch((e: unknown) => e as Error);
      if (r instanceof Response) {
        if (r.ok) return;
        ultimo = `HTTP ${r.status} ${(await r.text().catch(() => "")).slice(0, 120)}`;
        if (r.status === 400 || r.status === 413) break;
      } else ultimo = r.message;
      await dormir(1000 * (i + 1) ** 2);
    }
    throw new Error(`No se pudo subir ${nombre}: ${ultimo}`);
  }
}

/** Para pruebas y para el modo «sin copiar»: devuelve siempre la misma dirección. */
export const copiadorNulo = { copiar: async () => null as string | null, conocida: () => undefined as string | null | undefined, estadisticas: { copiadas: 0, yaEstaban: 0, fallidas: 0, bytesSubidos: 0 } };
