import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Enlaces de vista previa firmados y caducables.
 *
 * Sirven para dos cosas: enseñar un borrador a alguien sin cuenta y, sobre
 * todo, que PageSpeed Insights pueda rastrear la nota ANTES de publicarla. El
 * token va firmado con `AUTH_SECRET`, caduca, y la página se sirve siempre con
 * `noindex, nofollow` y fuera del sitemap y del robots.txt.
 */

const SECRET =
  process.env.AUTH_SECRET ??
  (process.env.NODE_ENV === "development" ? "contexto-ganadero-dev-secret" : "");

/** Una semana: cubre el ciclo de revisión sin dejar enlaces vivos para siempre. */
export const PREVIEW_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sign(id: string, exp: number): string {
  return createHmac("sha256", SECRET).update(`${id}.${exp}`).digest("base64url");
}

export function signPreviewToken(id: string, ttlMs = PREVIEW_TTL_MS): string {
  const exp = Date.now() + ttlMs;
  return `${exp}.${sign(id, exp)}`;
}

export function verifyPreviewToken(id: string, token: string | undefined): boolean {
  if (!token || !SECRET) return false;
  const [expRaw, mac] = token.split(".");
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || !mac || exp < Date.now()) return false;

  const expected = Buffer.from(sign(id, exp));
  const got = Buffer.from(mac);
  return expected.length === got.length && timingSafeEqual(expected, got);
}
