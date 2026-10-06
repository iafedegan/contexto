import "server-only";
import { firmar, igualesSeguro } from "@/lib/claves";

/**
 * Enlaces de vista previa firmados y caducables.
 *
 * Sirven para dos cosas: enseñar un borrador a alguien sin cuenta y, sobre
 * todo, que PageSpeed Insights pueda rastrear la nota ANTES de publicarla. El
 * token va firmado con la clave de este uso (`PREVIEW_TOKEN_SECRET` o la derivada
 * de `AUTH_SECRET`; ver `src/lib/claves.ts`), caduca, y la página se sirve siempre
 * con `noindex, nofollow` y fuera del sitemap y del robots.txt.
 */

/** Una semana: cubre el ciclo de revisión sin dejar enlaces vivos para siempre. */
export const PREVIEW_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Calcula la firma HMAC de un id y su fecha de caducidad.
function sign(id: string, exp: number): string {
  return firmar("token-previa", `${id}.${exp}`);
}

// Crea un token de vista previa: lleva la caducidad y su firma.
export function signPreviewToken(id: string, ttlMs = PREVIEW_TTL_MS): string {
  const exp = Date.now() + ttlMs;
  return `${exp}.${sign(id, exp)}`;
}

// Comprueba que el token sea auténtico (firma en tiempo constante) y no haya caducado.
export function verifyPreviewToken(id: string, token: string | undefined): boolean {
  if (!token) return false;
  const [expRaw, mac] = token.split(".");
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || !mac || exp < Date.now()) return false;
  try {
    return igualesSeguro(sign(id, exp), mac);
  } catch {
    return false; // sin secreto configurado: ningún token es válido
  }
}
