/**
 * Dispositivo, navegador y sistema de quien lee, a partir del `User-Agent`. Es una clasificación gruesa a propósito (para
 * saber si leen en celular o en computador, no para identificar a nadie): pura y probada. El `User-Agent` no se guarda.
 */
export type Dispositivo = "mobile" | "tablet" | "desktop" | "otro";
export type PerfilUa = { device: Dispositivo; browser: string; os: string };

export function perfilDeUa(ua: string | null | undefined): PerfilUa {
  const u = (ua ?? "").slice(0, 400);
  if (!u) return { device: "otro", browser: "Otro", os: "Otro" };
  if (/bot|crawl|spider|slurp|facebookexternalhit|preview|headless/i.test(u)) return { device: "otro", browser: "Robot", os: "Otro" };
  const tablet = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(u);
  const movil = /Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(u);
  const device: Dispositivo = tablet ? "tablet" : movil ? "mobile" : "desktop";
  const os = /iPhone|iPad|iPod/i.test(u) ? "iOS" : /Android/i.test(u) ? "Android" : /Windows/i.test(u) ? "Windows" : /Mac OS X|Macintosh/i.test(u) ? "macOS" : /CrOS/i.test(u) ? "ChromeOS" : /Linux/i.test(u) ? "Linux" : "Otro";
  // El orden importa: Edge, Opera y Samsung dicen «Chrome»; Chrome dice «Safari».
  const browser = /Edg(e|A|iOS)?\//i.test(u) ? "Edge" : /OPR\/|Opera/i.test(u) ? "Opera" : /SamsungBrowser/i.test(u) ? "Samsung" : /Firefox|FxiOS/i.test(u) ? "Firefox" : /Chrome|CriOS/i.test(u) ? "Chrome" : /Safari/i.test(u) ? "Safari" : "Otro";
  return { device, browser, os };
}
