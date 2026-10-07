import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { newsletterSubscribers as n, subscriberVisitors as v } from "@/db/schema";
import { firmar, igualesSeguro } from "@/lib/claves";

/**
 * Relación entre lo que se lee y quién lo lee, SOLO para quien la autorizó. Tres reglas:
 *  1. La persona marca una casilla expresa al suscribirse (`reading_authorized_at`); sin ella no se vincula nada.
 *  2. Un navegador solo se vincula si además aceptó la medición de lectura (cookie `cg_med`) y tiene su código `cg_vid`.
 *  3. El vínculo es «verificado» cuando se probó con un enlace del correo (firmado: solo lo tiene quien recibió el boletín)
 *     o al confirmar la suscripción; si salió del formulario sin esa prueba queda «sin verificar» y el panel lo dice.
 * Darse de baja o eliminar la suscripción borra los vínculos; las lecturas anteriores a vincular no se atribuyen a nadie.
 */

/** Firma del enlace del correo para un suscriptor (el correo de ESE lector lleva `cgs=<id>&cgt=<firma>`). */
export const lectorToken = (subscriberId: string): string => firmar("lectura-boletin", `lectura:${subscriberId}`).slice(0, 32);

/** Comprueba la firma en tiempo constante; ante cualquier error, que no es válida. */
export function lectorTokenValido(subscriberId: string, token: string): boolean {
  try {
    return !!token && token.length <= 64 && igualesSeguro(lectorToken(subscriberId), token);
  } catch {
    return false;
  }
}

/** Marca que la persona autorizó la relación de su lectura con su suscripción (una sola vez; no cambia si ya estaba). */
export async function autorizarLectura(subscriberId: string): Promise<void> {
  await db.update(n).set({ readingAuthorizedAt: sql`coalesce(${n.readingAuthorizedAt}, now())` }).where(eq(n.id, subscriberId));
}

/**
 * Vincula un navegador a un suscriptor que autorizó. Con `verificado` un vínculo antiguo se sube a verificado, nunca se baja.
 * Devuelve false si no hay autorización, o la suscripción está dada de baja.
 */
export async function vincularVisitante(subscriberId: string, visitorId: string, verificado: boolean): Promise<boolean> {
  const [s] = await db
    .select({ id: n.id })
    .from(n)
    .where(and(eq(n.id, subscriberId), isNull(n.unsubscribedAt), sql`${n.readingAuthorizedAt} is not null`))
    .limit(1);
  if (!s) return false;
  await db
    .insert(v)
    .values({ subscriberId, visitorId, verified: verificado })
    .onConflictDoUpdate({ target: [v.subscriberId, v.visitorId], set: { verified: sql`${v.verified} or ${verificado}` } });
  return true;
}

/**
 * Vínculo hecho por un editor desde el navegador de la propia persona (que está presente y lo autoriza): además de vincular,
 * atribuye las lecturas que ese navegador ya había hecho (el vínculo empieza en su primera lectura). Devuelve false si no
 * existe un suscriptor activo con ese correo.
 */
export async function vincularDesdePanel(email: string, visitorId: string, verificado: boolean): Promise<boolean> {
  const [s] = await db.select({ id: n.id }).from(n).where(and(sql`lower(${n.email}) = ${email.toLowerCase()}`, isNull(n.unsubscribedAt))).limit(1);
  if (!s) return false;
  await autorizarLectura(s.id);
  if (!(await vincularVisitante(s.id, visitorId, verificado))) return false;
  await db.execute(sql`update subscriber_visitors sv set linked_at = least(sv.linked_at, coalesce((select min(r.created_at) from reader_sessions r where r.visitor_id = sv.visitor_id), sv.linked_at))
    where sv.subscriber_id = ${s.id}::uuid and sv.visitor_id = ${visitorId}::uuid`);
  return true;
}

/** Borra los vínculos de quien ya se dio de baja (el mantenimiento diario). Devuelve cuántos. */
export async function purgarVinculosDeBajas(): Promise<number> {
  const r = await db.execute(sql`delete from subscriber_visitors sv using newsletter_subscribers s where s.id = sv.subscriber_id and s.unsubscribed_at is not null returning 1`);
  return Array.isArray(r) ? r.length : ((r as { rows?: unknown[] }).rows?.length ?? 0);
}
