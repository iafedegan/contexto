import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { claveDe, secretoRaiz } from "@/lib/claves";

/**
 * Cifrado de secretos guardados en la base (claves de API del panel).
 *
 * AES-256-GCM. Guardar una clave de API en texto plano significa que cualquier volcado de la base —un backup,
 * un log de consulta, un acceso de solo lectura— la regala. Cifrarla obliga a tener además el secreto del
 * despliegue.
 *
 * La clave de cifrado es propia de este uso (HKDF desde `SECRETS_ENCRYPTION_KEY` o, si no existe, desde
 * `AUTH_SECRET`; ver `src/lib/claves.ts`). Lo guardado lleva el prefijo `v2.`; lo que se guardó antes, sin
 * prefijo, se sigue descifrando con la derivación anterior (scrypt de `AUTH_SECRET`) y pasa al formato nuevo la
 * próxima vez que se vuelva a guardar. Así no hay que volver a introducir ninguna clave al actualizar.
 *
 * Consecuencia a tener presente: si cambias la clave de este propósito, los secretos ya guardados dejan de
 * poder descifrarse y hay que volver a introducirlos.
 */
const ALGO = "aes-256-gcm";
// Marca del formato actual; lo guardado sin ella usa la derivación heredada.
const PREFIJO = "v2.";

// Clave heredada (formato sin prefijo): scrypt de `AUTH_SECRET` con sal fija. Solo sirve para descifrar lo antiguo.
function claveHeredada(): Buffer {
  return scryptSync(secretoRaiz(), "contexto-ganadero/secrets", 32);
}

/** Devuelve `v2.iv.tag.datos` en base64url, listo para guardar como texto. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, claveDe("cifrado-secretos"), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIJO + [iv, tag, data].map((b) => b.toString("base64url")).join(".");
}

/** `null` si el secreto no se puede descifrar (clave cambiada, dato corrupto). */
export function decryptSecret(payload: string): string | null {
  try {
    const nuevo = payload.startsWith(PREFIJO);
    const [iv, tag, data] = (nuevo ? payload.slice(PREFIJO.length) : payload).split(".").map((p) => Buffer.from(p, "base64url"));
    const decipher = createDecipheriv(ALGO, nuevo ? claveDe("cifrado-secretos") : claveHeredada(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** `true` si el secreto guardado usa todavía el formato anterior (se actualiza al volver a guardarlo). */
export const usaFormatoHeredado = (payload: string) => !payload.startsWith(PREFIJO);

/** Muestra lo justo para reconocerla sin revelarla: `sk-ant-…a1b2`. */
export function maskSecret(value: string): string {
  if (value.length <= 12) return "•".repeat(value.length);
  return `${value.slice(0, 7)}…${value.slice(-4)}`;
}
