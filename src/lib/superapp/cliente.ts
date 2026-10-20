import "server-only";
import { FORMA_CUPON, FORMA_REFERENCIA, validarRespuesta, validarVigencia, type IdentidadSuperApp } from "./contrato";
import { RUTA_INTERCAMBIO, RUTA_VALIDACION, type ConfigSuperApp } from "./config";

/**
 * Cliente de servidor hacia la API de FEDEGÁN. Nunca se llama desde el navegador y la credencial no sale de aquí. Ante un resultado incierto
 * (red, 5xx, tiempo agotado) NO se concede acceso. Sin redirecciones (un 3xx es un fallo) y sin caché.
 */
export type Motivo = "cupon" | "credencial" | "peticion" | "rechazado" | "servicio" | "respuesta";
export type Resultado = { ok: true; identidad: IdentidadSuperApp; ms: number } | { ok: false; motivo: Motivo; http?: number; ms: number };

type Fetcher = typeof fetch;
const PLAZO_MS = 8_000;

async function post(cfg: ConfigSuperApp, ruta: string, cuerpo: Record<string, string>, f: Fetcher): Promise<{ status: number; json: unknown } | null> {
  try {
    const r = await f(`${cfg.apiBase}${ruta}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.credencial}`, accept: "application/json" },
      body: JSON.stringify({ schemaVersion: "1.0", audience: cfg.audience, ...cuerpo }),
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(PLAZO_MS),
    });
    const json = r.status === 200 ? await r.json().catch(() => null) : (await r.arrayBuffer().catch(() => null), null);
    return { status: r.status, json };
  } catch {
    return null;
  }
}

// Traduce el código HTTP de la guía (§Errores y recuperación) a la acción del receptor.
function motivoDe(status: number): Motivo {
  if (status === 401) return "credencial";
  if (status === 422) return "peticion";
  if (status === 410) return "cupon";
  if (status === 403) return "rechazado";
  return "servicio";
}

/** Canjea el cupón de un solo uso. */
export async function intercambiarCupon(code: string, cfg: ConfigSuperApp, f: Fetcher = fetch): Promise<Resultado> {
  const t0 = Date.now();
  if (!FORMA_CUPON.test(code)) return { ok: false, motivo: "cupon", ms: 0 };
  const r = await post(cfg, RUTA_INTERCAMBIO, { code }, f);
  const ms = Date.now() - t0;
  if (!r) return { ok: false, motivo: "servicio", ms };
  if (r.status !== 200) return { ok: false, motivo: motivoDe(r.status), http: r.status, ms };
  const identidad = validarRespuesta(r.json, cfg);
  return identidad ? { ok: true, identidad, ms } : { ok: false, motivo: "respuesta", http: 200, ms };
}

export type ResultadoVigencia = { ok: true; expiresAt: Date; correlationId: string; ms: number } | { ok: false; motivo: Motivo; http?: number; ms: number };

/**
 * Consulta si la sesión de origen sigue vigente. 200 válido y de la misma persona → vigente; 403 → revocada o vencida (hay que invalidar el acceso
 * integrado); cualquier otra cosa → «no se pudo verificar» (no se permite la operación con datos viejos). La consulta no renueva la sesión.
 */
export async function consultarSesion(sessionReference: string, subject: string, cfg: ConfigSuperApp, f: Fetcher = fetch): Promise<ResultadoVigencia> {
  const t0 = Date.now();
  if (!FORMA_REFERENCIA.test(sessionReference)) return { ok: false, motivo: "respuesta", ms: 0 };
  const r = await post(cfg, RUTA_VALIDACION, { sessionReference }, f);
  const ms = Date.now() - t0;
  if (!r) return { ok: false, motivo: "servicio", ms };
  if (r.status !== 200) return { ok: false, motivo: motivoDe(r.status), http: r.status, ms };
  const v = validarVigencia(r.json, cfg, subject);
  return v ? { ok: true, ...v, ms } : { ok: false, motivo: "respuesta", http: 200, ms };
}
