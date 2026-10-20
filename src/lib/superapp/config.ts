import "server-only";
import { env } from "@/lib/env";

/**
 * Configuración de la integración con la SuperApp de FEDEGÁN (MiniApp «Contexto Ganadero»). Todo sale del entorno; con falta de cualquier dato la
 * integración queda APAGADA (la ruta de entrada responde «no habilitada»): la entrega de la guía no activa el servicio, lo activa la configuración.
 *
 *  - `SUPERAPP_API_BASE_URL`: origen de la API de FEDEGÁN del ambiente (pruebas o producción), p. ej. `https://api.v2-preview.citizen-life.com`.
 *  - `SUPERAPP_RECEIVER_CREDENTIAL`: credencial del receptor (Bearer). Solo en el servidor, distinta en pruebas y producción.
 *  - `SUPERAPP_SCHEMA_VERSION`: versión de la respuesta acordada con FEDEGÁN (la que añade `sessionReference` y `sessionValidationUrl`).
 *  - `SUPERAPP_AUDIENCE`: por defecto `context-ganadero` (valor acordado en la guía).
 */
export type ConfigSuperApp = { apiBase: string; credencial: string; schemaVersion: string; audience: string };

export const RUTA_INTERCAMBIO = "/v2/miniapps/secure-launch/exchange";
export const RUTA_VALIDACION = "/v2/miniapps/secure-launch/session/validate";

/** La configuración completa, o `null` si la integración no está habilitada. */
export function configSuperApp(): ConfigSuperApp | null {
  const base = env(process.env.SUPERAPP_API_BASE_URL, "");
  const credencial = env(process.env.SUPERAPP_RECEIVER_CREDENTIAL, "");
  const schemaVersion = env(process.env.SUPERAPP_SCHEMA_VERSION, "");
  if (!base || !credencial || !schemaVersion) return null;
  let u: URL;
  try {
    u = new URL(base);
  } catch {
    return null;
  }
  // La API se llama solo por HTTPS (en pruebas locales se admite http://localhost).
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !(local && u.protocol === "http:")) return null;
  return { apiBase: u.origin, credencial, schemaVersion, audience: env(process.env.SUPERAPP_AUDIENCE, "context-ganadero") };
}
