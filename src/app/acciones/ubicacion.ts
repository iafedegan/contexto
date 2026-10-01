"use server";

import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { newsletterSubscribers } from "@/db/schema";
import { clientIp, hit } from "@/lib/rate-limit";
import { reverseGeocode, sourceFromAccuracy, validAccuracy, validCoords } from "@/lib/geo-reverse";

/**
 * Afina la ubicación de un suscriptor desde el enlace de confirmación del
 * correo (el token es el secreto que solo recibió esa persona). Solo la mejora:
 * reemplaza la aproximada por IP con la que el navegador comparta con permiso.
 */
export async function afinarUbicacion(input: {
  token: string;
  lat: number;
  lon: number;
  accuracy?: number;
}): Promise<{ ok: boolean }> {
  const ip = clientIp(await headers());
  if (!(await hit(`ubicacion:ip:${ip}`, 10, 60 * 60)).allowed) return { ok: false };

  const t = String(input.token ?? "");
  const c = validCoords(input.lat, input.lon);
  if (!c || t.length < 16 || t.length > 80) return { ok: false };
  const acc = validAccuracy(input.accuracy ?? null);

  const [row] = await db
    .select({ id: newsletterSubscribers.id, postal: newsletterSubscribers.signupPostal })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.confirmToken, t))
    .limit(1);
  if (!row) return { ok: false };

  const rev = await reverseGeocode(c.lat, c.lon);
  await db
    .update(newsletterSubscribers)
    .set({
      signupLat: c.lat.toFixed(6),
      signupLon: c.lon.toFixed(6),
      signupGeoSource: sourceFromAccuracy(acc),
      signupGeoAccuracy: acc === null ? null : String(acc),
      neighborhood: rev.neighborhood,
      signupPostal: rev.postal ?? row.postal,
    })
    .where(eq(newsletterSubscribers.id, row.id));
  return { ok: true };
}
