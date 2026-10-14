/**
 * Utilidades compartidas por los scripts de la migración del sitio anterior (contextoganadero.com, Next.js + Storyblok):
 * rutas de la caché local, lectura de la configuración (sin imprimirla nunca) y funciones de red con reintentos.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Sitio que se migra. */
export const SITIO_ANTIGUO = "https://www.contextoganadero.com";

/** Carpeta local (fuera de git) donde se guarda lo descargado, para poder reanudar y repetir sin volver a pedir nada. */
export const CACHE = join(process.cwd(), ".migracion-cache");
export const DIR_HISTORIAS = join(CACHE, "historias");

/** Crea las carpetas de la caché si no existen. */
export function prepararCache(): void {
  for (const d of [CACHE, DIR_HISTORIAS]) if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

/**
 * Cadena de conexión a la base: de la variable DATABASE_URL o, si no está, del archivo `.env.migracion` (primera dirección
 * `postgresql://…` que contenga). Nunca se imprime.
 */
export function urlBaseDeDatos(): string {
  const env = process.env.DATABASE_URL?.trim();
  if (env) return env;
  const f = join(process.cwd(), ".env.migracion");
  if (existsSync(f)) {
    const m = readFileSync(f, "utf8").match(/postgres(?:ql)?:\/\/\S+/);
    if (m) return m[0];
  }
  throw new Error("Falta DATABASE_URL (o un .env.migracion con la dirección postgresql://).");
}

/** Credenciales del almacenamiento (Supabase Storage): de las variables de entorno o, si faltan, del `.env.migracion`. Nunca se imprimen. */
export function credencialesStorage(): { url: string; key: string } {
  let url = process.env.SUPABASE_URL?.trim();
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const f = join(process.cwd(), ".env.migracion");
  if ((!url || !key) && existsSync(f)) {
    const txt = readFileSync(f, "utf8");
    url ||= txt.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0];
    key ||= txt.match(/eyJ[\w-]+\.[\w-]+\.[\w-]+/)?.[0];
  }
  if (!url || !key) throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o un .env.migracion que los traiga).");
  return { url: url.replace(/\/$/, ""), key };
}

/** Espera `ms` milisegundos. */
export const dormir = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

const UA = "Mozilla/5.0 (compatible; MigracionFedegan/1.0; +https://www.contextoganadero.com)";

/** Pausa global cuando el origen pide ir más despacio (429/503): todas las descargas esperan a la vez. */
let pausaHasta = 0;

/** GET con reintentos y espera creciente; respeta una pausa global si el origen se satura. Devuelve la respuesta o lanza. */
export async function pedir(url: string, opciones: { intentos?: number; timeoutMs?: number; aceptar404?: boolean } = {}): Promise<Response> {
  const { intentos = 5, timeoutMs = 45_000, aceptar404 = true } = opciones;
  let ultimo: unknown;
  for (let i = 0; i < intentos; i++) {
    const espera = pausaHasta - Date.now();
    if (espera > 0) await dormir(espera);
    try {
      const r = await fetch(url, { headers: { "user-agent": UA, "accept-encoding": "gzip, br" }, signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
      if (r.status === 429 || r.status === 503 || r.status === 520 || r.status === 522 || r.status === 524) {
        pausaHasta = Math.max(pausaHasta, Date.now() + 15_000 * (i + 1));
        ultimo = new Error(`HTTP ${r.status}`);
        await r.arrayBuffer().catch(() => {});
        continue;
      }
      if (r.status >= 500) { ultimo = new Error(`HTTP ${r.status}`); await r.arrayBuffer().catch(() => {}); await dormir(1000 * (i + 1)); continue; }
      if (r.status === 404 && !aceptar404) throw new Error("HTTP 404");
      return r;
    } catch (e) {
      ultimo = e;
      await dormir(800 * (i + 1) ** 2);
    }
  }
  throw new Error(`No se pudo pedir ${url}: ${ultimo instanceof Error ? ultimo.message : String(ultimo)}`);
}
