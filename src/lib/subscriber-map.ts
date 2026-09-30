import "server-only";
import { db } from "@/db";
import { newsletterSubscribers } from "@/db/schema";
import type { SubscriberPoint } from "@/components/panel/subscriber-map";

/** Agrupa las altas del boletín con lat/lon por ciudad, para el mapa del
 * panel (Resumen editorial y Newsletter → Suscriptores comparten esta
 * agregación). Un círculo por ciudad, no uno por persona. */
export async function subscriberCityPoints(): Promise<SubscriberPoint[]> {
  const rows = await db
    .select({
      signupLat: newsletterSubscribers.signupLat,
      signupLon: newsletterSubscribers.signupLon,
      signupCity: newsletterSubscribers.signupCity,
      signupCountry: newsletterSubscribers.signupCountry,
      signupPostal: newsletterSubscribers.signupPostal,
    })
    .from(newsletterSubscribers);

  const porCiudad = new Map<string, SubscriberPoint>();
  for (const r of rows) {
    if (r.signupLat == null || r.signupLon == null) continue;
    const lat = Number(r.signupLat);
    const lon = Number(r.signupLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const key = r.signupCity ?? `${lat.toFixed(1)},${lon.toFixed(1)}`;
    const actual = porCiudad.get(key);
    const postal = r.signupPostal?.trim();
    if (actual) {
      actual.n += 1;
      if (postal) actual.postales[postal] = (actual.postales[postal] ?? 0) + 1;
    } else {
      porCiudad.set(key, {
        lat,
        lon,
        city: r.signupCity,
        country: r.signupCountry,
        n: 1,
        postales: postal ? { [postal]: 1 } : {},
      });
    }
  }
  return [...porCiudad.values()];
}
