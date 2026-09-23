import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Cifrado de secretos guardados en la base (claves de API del panel).
 *
 * AES-256-GCM con clave derivada de `AUTH_SECRET`. Guardar una clave de API en
 * texto plano significa que cualquier volcado de la base —un backup, un log de
 * consulta, un acceso de solo lectura— la regala. Cifrarla obliga a tener
 * además el secreto del despliegue.
 *
 * Consecuencia a tener presente: si cambias `AUTH_SECRET`, los secretos ya
 * guardados dejan de poder descifrarse y hay que volver a introducirlos.
 */
const ALGO = "aes-256-gcm";

function key(): Buffer {
  const secret =
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV === "development" ? "contexto-ganadero-dev-secret" : undefined);
  if (!secret) throw new Error("AUTH_SECRET es obligatorio para cifrar secretos.");
  // Sal fija: el secreto ya es de alta entropía y así el cifrado es estable
  // entre procesos (varias instancias descifran lo mismo).
  return scryptSync(secret, "contexto-ganadero/secrets", 32);
}

/** Devuelve `iv.tag.datos` en base64url, listo para guardar como texto. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, data].map((b) => b.toString("base64url")).join(".");
}

/** `null` si el secreto no se puede descifrar (AUTH_SECRET cambiado, dato corrupto). */
export function decryptSecret(payload: string): string | null {
  try {
    const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
    const decipher = createDecipheriv(ALGO, key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Muestra lo justo para reconocerla sin revelarla: `sk-ant-…a1b2`. */
export function maskSecret(value: string): string {
  if (value.length <= 12) return "•".repeat(value.length);
  return `${value.slice(0, 7)}…${value.slice(-4)}`;
}
