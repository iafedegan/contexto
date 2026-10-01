import "server-only";

/** Valida coordenadas recibidas del navegador. */
export function validCoords(lat: unknown, lon: unknown): { lat: number; lon: number } | null {
  if (lat === null || lat === "" || lon === null || lon === "") return null;
  const a = Number(lat), b = Number(lon);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 ? { lat: a, lon: b } : null;
}

/** Precisión en metros (0–100 000); si no llega, null. */
export function validAccuracy(v: unknown): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100_000 ? Math.round(n) : null;
}

/** "gps" si la precisión es de unos pocos metros; "red" si viene de Wi-Fi/antenas (cientos de metros). */
export const sourceFromAccuracy = (acc: number | null): "gps" | "red" => (acc !== null && acc > 150 ? "red" : "gps");

/** Barrio y código postal a partir de coordenadas (OpenStreetMap Nominatim). Falla en silencio. */
export async function reverseGeocode(lat: number, lon: number): Promise<{ neighborhood: string | null; postal: string | null }> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&addressdetails=1&accept-language=es&lat=${lat}&lon=${lon}`,
      { headers: { "User-Agent": "contexto-ganadero/1.0 (ia@fedegan.org.co)" }, signal: AbortSignal.timeout(3000) },
    );
    if (!r.ok) return { neighborhood: null, postal: null };
    const a = ((await r.json()) as { address?: Record<string, string> }).address ?? {};
    return {
      neighborhood: (a.neighbourhood ?? a.suburb ?? a.quarter ?? a.city_district ?? null)?.slice(0, 120) ?? null,
      postal: a.postcode?.slice(0, 20) ?? null,
    };
  } catch {
    return { neighborhood: null, postal: null };
  }
}
