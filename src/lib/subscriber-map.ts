import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { newsletterSubscribers } from "@/db/schema";
import type { SubscriberPoint } from "@/components/panel/subscriber-map";

/** Un punto por suscripción con ubicación, para el mapa del panel (Resumen y
 * Newsletter → Suscriptores). La geo-IP da coordenadas a nivel de ciudad, así
 * que varias altas caen en el mismo punto exacto: a las repetidas se les
 * separa ~250 m en espiral para que cada una se vea y se pueda pulsar. */
export async function subscriberPoints(): Promise<SubscriberPoint[]> {
  const rows = await db
    .select({
      email: newsletterSubscribers.email,
      firstName: newsletterSubscribers.firstName,
      lastName: newsletterSubscribers.lastName,
      signupLat: newsletterSubscribers.signupLat,
      signupLon: newsletterSubscribers.signupLon,
      signupCity: newsletterSubscribers.signupCity,
      signupCountry: newsletterSubscribers.signupCountry,
      signupPostal: newsletterSubscribers.signupPostal,
      neighborhood: newsletterSubscribers.neighborhood,
      signupGeoSource: newsletterSubscribers.signupGeoSource,
      createdAt: newsletterSubscribers.createdAt,
    })
    .from(newsletterSubscribers)
    .orderBy(asc(newsletterSubscribers.createdAt));

  const usados = new Map<string, number>();
  const out: SubscriberPoint[] = [];
  for (const r of rows) {
    if (r.signupLat == null || r.signupLon == null) continue;
    let lat = Number(r.signupLat);
    let lon = Number(r.signupLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const k = usados.get(key) ?? 0;
    usados.set(key, k + 1);
    if (k > 0 && r.signupGeoSource !== "gps") {
      const ang = k * 2.4;
      const dist = 0.0022 * Math.sqrt(k);
      lat += dist * Math.sin(ang);
      lon += (dist * Math.cos(ang)) / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    }

    out.push({
      lat,
      lon,
      name: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || null,
      email: r.email,
      city: r.signupCity,
      country: r.signupCountry,
      postal: r.signupPostal?.trim() || null,
      neighborhood: r.neighborhood,
      exact: r.signupGeoSource === "gps",
      date: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : null,
    });
  }
  return out;
}
