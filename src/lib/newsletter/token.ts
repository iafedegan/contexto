import "server-only";
import { createHmac } from "node:crypto";
import { firmar, igualesSeguro, secretoRaiz } from "@/lib/claves";

/**
 * Enlaces de baja firmados. El token es una firma HMAC del id del suscriptor
 * con la clave de este uso (`NEWSLETTER_LINK_SECRET` o, si no existe, la derivada
 * de `AUTH_SECRET`; ver `src/lib/claves.ts`): no hace falta guardar nada en la
 * base y nadie puede dar de baja a otra persona adivinando ids.
 *
 * Los boletines ya enviados llevan enlaces firmados con el esquema anterior (HMAC
 * directo de `AUTH_SECRET`). Quien quiera darse de baja con uno de ellos debe poder
 * hacerlo siempre —es un derecho, no una comodidad—, así que la verificación acepta
 * ambos esquemas y solo los enlaces nuevos usan la clave por propósito.
 */

// Token de baja de un suscriptor: HMAC de su id con la clave del propósito, truncado a 32 caracteres.
export function unsubscribeToken(subscriberId: string): string {
  return firmar("baja-boletin", `baja:${subscriberId}`).slice(0, 32);
}

// Token del esquema anterior: HMAC directo del secreto de la aplicación. Solo se acepta, nunca se emite.
function tokenHeredado(subscriberId: string): string {
  return createHmac("sha256", secretoRaiz()).update(`baja:${subscriberId}`).digest("base64url").slice(0, 32);
}

// Verifica un token de baja comparando en tiempo constante; ante cualquier error responde que no es válido.
export function verifyUnsubscribeToken(subscriberId: string, token: string): boolean {
  try {
    if (!token || token.length > 64) return false;
    return igualesSeguro(unsubscribeToken(subscriberId), token) || igualesSeguro(tokenHeredado(subscriberId), token);
  } catch {
    return false;
  }
}
