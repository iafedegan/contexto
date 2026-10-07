import "server-only";
import { createHash, createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

/**
 * Claves por propósito (hallazgo H-17).
 *
 * Antes, el mismo `AUTH_SECRET` firmaba las sesiones, cifraba las claves de API guardadas, firmaba el token de
 * passkey y los enlaces de baja y, además, derivaba el secreto del webhook de Telegram: una filtración o una
 * rotación lo afectaba todo a la vez. Ahora cada uso tiene su propia clave, derivada con HKDF-SHA256 (RFC 5869)
 * de la raíz y del nombre del propósito: conocer la clave de uno no revela la raíz ni las de los demás.
 * (Las sesiones las cifra Auth.js, que ya deriva su propia clave con HKDF a partir del secreto.)
 *
 * Cada propósito puede tener, además, su propia variable de entorno (ver `ENV_PROPIO`): si existe, es la raíz de
 * ese propósito y se puede rotar sin tocar a los demás. Sin ella se deriva de `AUTH_SECRET`.
 *
 * En producción el secreto es obligatorio: el valor de respaldo solo existe en `next dev`.
 */

/** Usos que tienen clave propia. */
export type Proposito = "cifrado-secretos" | "passkey-puente" | "baja-boletin" | "webhook-telegram" | "token-previa" | "sesion-asistente" | "lectura-boletin";

/** Variable de entorno que, si se define, sustituye a `AUTH_SECRET` como raíz de ese propósito. */
export const ENV_PROPIO: Record<Proposito, string> = {
  "cifrado-secretos": "SECRETS_ENCRYPTION_KEY",
  "passkey-puente": "PASSKEY_BRIDGE_SECRET",
  "baja-boletin": "NEWSLETTER_LINK_SECRET",
  "webhook-telegram": "TELEGRAM_WEBHOOK_SECRET",
  "token-previa": "PREVIEW_TOKEN_SECRET",
  "sesion-asistente": "ASSISTANT_SESSION_SECRET",
  "lectura-boletin": "NEWSLETTER_READING_SECRET",
};

// Secreto fijo que solo se usa con `next dev`, para que el panel funcione sin configurar nada.
const SECRETO_DESARROLLO = "contexto-ganadero-dev-secret";

/** Secreto raíz de la aplicación (`AUTH_SECRET`). Fuera de `next dev` lanza un error si falta. */
export function secretoRaiz(): string {
  const s = process.env.AUTH_SECRET?.trim();
  if (s) return s;
  if (process.env.NODE_ENV === "development") return SECRETO_DESARROLLO;
  throw new Error("AUTH_SECRET es obligatorio.");
}

// Raíz con la que se deriva un propósito: su variable propia, o el secreto de la aplicación.
function raizDe(p: Proposito): string {
  const propio = process.env[ENV_PROPIO[p]]?.trim();
  return propio || secretoRaiz();
}

/** Clave de `bytes` bytes (32 por defecto) derivada con HKDF-SHA256 para un propósito. Determinista entre instancias. */
export function claveDe(p: Proposito, bytes = 32): Buffer {
  return Buffer.from(hkdfSync("sha256", raizDe(p), "contexto-ganadero/v1", `proposito:${p}`, bytes));
}

/** Firma HMAC-SHA256 (base64url) de `datos` con la clave del propósito. */
export function firmar(p: Proposito, datos: string): string {
  return createHmac("sha256", claveDe(p)).update(datos).digest("base64url");
}

/**
 * Compara dos cadenas en tiempo constante, sea cual sea su longitud: se comparan sus huellas SHA-256, que
 * siempre miden lo mismo, así que ni el contenido ni el largo se filtran por el tiempo de respuesta.
 */
export function igualesSeguro(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}
