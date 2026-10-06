import "server-only";
import { and, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { newsletterSubscribers as t } from "@/db/schema";

/**
 * Retención de los datos personales de suscriptores (hallazgo H-21; Ley 1581 de 2012: finalidad y minimización).
 *
 * El aviso de privacidad (src/content/institucional.ts, «Política de privacidad») declara estos plazos y el código los
 * cumple solo: `aplicarRetencion` corre cada día desde el cron de mantenimiento.
 *
 *  1. La IP del alta se borra en cuanto la persona confirma (solo sirve para el límite de intentos mientras el alta
 *     está pendiente).
 *  2. Un alta que nadie confirmó en 30 días se elimina por completo: nunca hubo autorización.
 *  3. A los 30 días de una baja se borra todo menos el correo y la fecha de baja, que se conservan para no volver a
 *     escribirle (lista de exclusión). El administrador puede borrarlo también si la persona lo pide.
 */
export const RETENCION = {
  /** Días que una alta sin confirmar espera antes de eliminarse. */
  altaSinConfirmarDias: 30,
  /** Días tras una baja antes de borrar los datos personales. */
  trasBajaDias: 30,
} as const;

/** Qué hizo una pasada de retención. */
export type ResultadoRetencion = { ipsBorradas: number; altasSinConfirmarEliminadas: number; bajasDepuradas: number };

/** Aplica los plazos de retención. Idempotente: se puede ejecutar las veces que haga falta. */
export async function aplicarRetencion(ahora = new Date()): Promise<ResultadoRetencion> {
  const dias = (n: number) => new Date(ahora.getTime() - n * 24 * 3600_000);

  // 1. IP de quien ya confirmó.
  const ips = await db
    .update(t)
    .set({ signupIp: null })
    .where(and(eq(t.confirmed, true), isNotNull(t.signupIp)))
    .returning({ id: t.id });

  // 2. Altas que nunca se confirmaron.
  const sinConfirmar = await db
    .delete(t)
    .where(and(eq(t.confirmed, false), isNull(t.unsubscribedAt), lt(t.createdAt, dias(RETENCION.altaSinConfirmarDias))))
    .returning({ id: t.id });

  // 3. Bajas con más de 30 días: solo quedan el correo y la fecha de baja. La condición «aún tiene algún dato» hace
  //    que cada fila se depure una sola vez y que el recuento sea real.
  const bajas = await db
    .update(t)
    .set({
      firstName: null,
      lastName: null,
      birthDate: null,
      mobile: null,
      signupIp: null,
      signupCity: null,
      signupCountry: null,
      signupPostal: null,
      neighborhood: null,
      signupLat: null,
      signupLon: null,
      signupGeoSource: null,
      signupGeoAccuracy: null,
      confirmToken: null,
    })
    .where(
      and(
        isNotNull(t.unsubscribedAt),
        lt(t.unsubscribedAt, dias(RETENCION.trasBajaDias)),
        or(
          isNotNull(t.firstName),
          isNotNull(t.lastName),
          isNotNull(t.birthDate),
          isNotNull(t.mobile),
          isNotNull(t.signupIp),
          isNotNull(t.signupCity),
          isNotNull(t.signupCountry),
          isNotNull(t.signupPostal),
          isNotNull(t.neighborhood),
          isNotNull(t.signupLat),
          isNotNull(t.signupLon),
          isNotNull(t.confirmToken),
          sql`${t.signupGeoSource} is not null`,
        ),
      ),
    )
    .returning({ id: t.id });

  return { ipsBorradas: ips.length, altasSinConfirmarEliminadas: sinConfirmar.length, bajasDepuradas: bajas.length };
}
