import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { accesoGmail } from "@/lib/newsletter/gmail";
import { resolveGmail } from "@/lib/newsletter/settings";

/**
 * Estado de la conexión con Google (último resultado de comprobarla).
 *
 * Por qué existe: el refresh token de Gmail deja de servir si pasan 6 meses sin usarse, o si Google lo revoca (cambio de contraseña de
 * la cuenta que envía, acceso retirado, política del administrador). Un boletín se envía de vez en cuando, así que sin esto el fallo se
 * descubriría el día del envío. Una comprobación diaria lo mantiene en uso y avisa en el panel si algo se rompió.
 */
export const NEWSLETTER_HEALTH_KEY = "newsletter_google_health";

export type GoogleHealth = { ok: boolean; checkedAt: string; error?: string };

// Último resultado guardado, o null si nunca se comprobó (o si la base no responde).
export async function getGoogleHealth(): Promise<GoogleHealth | null> {
  try {
    const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, NEWSLETTER_HEALTH_KEY)).limit(1);
    const v = row?.value as Partial<GoogleHealth> | undefined;
    if (!v || typeof v.ok !== "boolean" || typeof v.checkedAt !== "string") return null;
    return { ok: v.ok, checkedAt: v.checkedAt, ...(v.error ? { error: String(v.error).slice(0, 300) } : {}) };
  } catch {
    return null;
  }
}

export async function recordGoogleHealth(h: GoogleHealth): Promise<void> {
  await db
    .insert(siteSettings)
    .values({ key: NEWSLETTER_HEALTH_KEY, value: h })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: h, updatedAt: sql`now()` } });
}

export async function clearGoogleHealth(): Promise<void> {
  await db.delete(siteSettings).where(eq(siteSettings.key, NEWSLETTER_HEALTH_KEY));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Cambia el refresh token por un permiso de acceso (eso cuenta como uso, así que no caduca por inactividad) y registra el resultado.
 * Un solo reintento ante un fallo, para que un corte de red de un segundo no deje una alerta encendida todo el día.
 * Sin credenciales de Gmail: no hace nada.
 */
export async function keepGoogleAlive(): Promise<GoogleHealth | null> {
  const { cred } = await resolveGmail();
  if (!cred) return null;

  let error = "No se pudo comprobar la conexión con Google.";
  for (let intento = 0; intento < 2; intento++) {
    const acceso = await accesoGmail(cred);
    if (acceso.ok) {
      const h: GoogleHealth = { ok: true, checkedAt: new Date().toISOString() };
      await recordGoogleHealth(h);
      return h;
    }
    error = acceso.error;
    if (intento === 0) await sleep(3000);
  }
  const h: GoogleHealth = { ok: false, checkedAt: new Date().toISOString(), error: error.slice(0, 300) };
  await recordGoogleHealth(h);
  return h;
}
