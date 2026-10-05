import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Enlaces de baja firmados. El token es una firma HMAC del id del suscriptor
 * con el secreto del despliegue: no hace falta guardar nada en la base y nadie
 * puede dar de baja a otra persona adivinando ids.
 */
function secret(): string {
  const s = process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "development" ? "contexto-ganadero-dev-secret" : "");
  if (!s) throw new Error("AUTH_SECRET es obligatorio para firmar enlaces.");
  return s;
}

// Token de baja de un suscriptor: HMAC de su id, truncado a 32 caracteres.
export function unsubscribeToken(subscriberId: string): string {
  return createHmac("sha256", secret()).update(`baja:${subscriberId}`).digest("base64url").slice(0, 32);
}

// Verifica un token de baja comparando en tiempo constante; ante cualquier error responde que no es válido.
export function verifyUnsubscribeToken(subscriberId: string, token: string): boolean {
  try {
    const a = Buffer.from(unsubscribeToken(subscriberId));
    const b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
