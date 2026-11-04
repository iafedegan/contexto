/**
 * ¿El portal se está viendo dentro del navegador incrustado de una app (no en Safari, Chrome u otro navegador completo)?
 * Así se abre la MiniApp en la SuperApp de FEDEGÁN mientras no use `/superapp/launch`. Función pura (sin `window`) para poder probarla.
 *
 *  - iPhone/iPad: el navegador incrustado (WKWebView) no lleva la marca `Safari/`; Safari, Chrome (CriOS), Firefox (FxiOS) y Edge (EdgiOS) sí
 *    o la suya propia.
 *  - Android: el navegador incrustado lleva `; wv)`.
 *
 * Confirmado el 2026-11-04 en producción: la SuperApp en iPhone llega como `…(KHTML, like Gecko) Mobile/15E148` (sin `Safari/` ni nombre de la
 * app) y en Android con `; wv)`.
 *
 * Las apps de redes sociales también usan navegador incrustado, pero ahí el lector llega desde un enlace compartido y SÍ se le pregunta por la
 * medición: por eso se excluyen.
 */
const REDES = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|WhatsApp|Line\/|Twitter|TikTok|musical_ly|BytedanceWebview|LinkedInApp|Snapchat|Pinterest|GSA\/|Telegram|MicroMessenger/i;

export function esNavegadorIncrustado(ua: string | null | undefined): boolean {
  if (!ua) return false;
  if (REDES.test(ua)) return false;
  const ios = /\b(iPhone|iPad|iPod)\b/.test(ua);
  if (ios) return /AppleWebKit\//.test(ua) && !/Safari\//.test(ua) && !/\b(CriOS|FxiOS|EdgiOS|OPiOS)\//.test(ua);
  return /\bAndroid\b/.test(ua) && /; wv\)/.test(ua);
}
