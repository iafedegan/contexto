/** Consentimiento de ubicación del lector: cookie con la decisión + coordenadas en localStorage. */
export const LOC_COOKIE = "cg_loc";
// Clave de localStorage donde se guarda la última ubicación compartida.
export const GEO_KEY = "cg:geo";
// Evento del navegador que avisa a otros componentes de que cambió la ubicación.
export const GEO_EVENT = "cg-geo";

// Punto geográfico: latitud, longitud, precisión opcional y momento de captura.
export type GeoPoint = { lat: number; lon: number; acc?: number; t: number };

// Lee una cookie por nombre; null si no existe.
export function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

// Escribe una cookie con vigencia en días (marcada Secure solo en HTTPS).
export function writeCookie(name: string, value: string, days: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${days * 86400}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

// Lee la ubicación guardada, sin fallar si el navegador no permite el almacenamiento.
export function readGeo(): string | null {
  try {
    return localStorage.getItem(GEO_KEY);
  } catch {
    return null;
  }
}

// Guarda la ubicación con la precisión redondeada y la hora de captura.
export function storeGeo(lat: number, lon: number, acc?: number) {
  try {
    localStorage.setItem(GEO_KEY, JSON.stringify({ lat, lon, acc: acc === undefined ? undefined : Math.round(acc), t: Date.now() } satisfies GeoPoint));
    window.dispatchEvent(new Event(GEO_EVENT));
  } catch {
    /* sin almacenamiento */
  }
}

// Pide la posición al navegador; resuelve con null si la persona la niega o falla.
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
