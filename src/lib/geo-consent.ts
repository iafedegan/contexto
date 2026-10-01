/** Consentimiento de ubicación del lector: cookie con la decisión + coordenadas en localStorage. */
export const LOC_COOKIE = "cg_loc";
export const GEO_KEY = "cg:geo";
export const GEO_EVENT = "cg-geo";

export type GeoPoint = { lat: number; lon: number; acc?: number; t: number };

export function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function writeCookie(name: string, value: string, days: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${days * 86400}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

export function readGeo(): string | null {
  try {
    return localStorage.getItem(GEO_KEY);
  } catch {
    return null;
  }
}

export function storeGeo(lat: number, lon: number, acc?: number) {
  try {
    localStorage.setItem(GEO_KEY, JSON.stringify({ lat, lon, acc: acc === undefined ? undefined : Math.round(acc), t: Date.now() } satisfies GeoPoint));
    window.dispatchEvent(new Event(GEO_EVENT));
  } catch {
    /* sin almacenamiento */
  }
}

function getPos(opts: PositionOptions): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), opts);
  });
}

/**
 * Pide la posición por capas: primero GPS (alta precisión) y, si no hay señal
 * (interior, escritorio), la que calcula el navegador con Wi-Fi y antenas.
 * Guarda coordenadas y precisión; resuelve true si obtuvo alguna.
 */
export async function captureGeo(): Promise<boolean> {
  if (!navigator.geolocation) return false;
  const p =
    (await getPos({ enableHighAccuracy: true, timeout: 7000, maximumAge: 0 })) ??
    (await getPos({ enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }));
  if (!p) return false;
  storeGeo(p.coords.latitude, p.coords.longitude, p.coords.accuracy);
  return true;
}
