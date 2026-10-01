/** Consentimiento de ubicación del lector: cookie con la decisión + coordenadas en localStorage. */
export const LOC_COOKIE = "cg_loc";
export const GEO_KEY = "cg:geo";
export const GEO_EVENT = "cg-geo";

export type GeoPoint = { lat: number; lon: number; t: number };

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

export function storeGeo(lat: number, lon: number) {
  try {
    localStorage.setItem(GEO_KEY, JSON.stringify({ lat, lon, t: Date.now() } satisfies GeoPoint));
    window.dispatchEvent(new Event(GEO_EVENT));
  } catch {
    /* sin almacenamiento */
  }
}

/** Pide la posición al navegador y la guarda. Resuelve true si la obtuvo. */
export function captureGeo(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(false);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        storeGeo(p.coords.latitude, p.coords.longitude);
        resolve(true);
      },
      () => resolve(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}
