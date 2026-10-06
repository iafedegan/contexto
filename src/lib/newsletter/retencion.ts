import "server-only";
import { and, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { newsletterSubscribers as t } from "@/db/schema";
import { getProviderStatus } from "@/lib/newsletter/settings";

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
 *
 * Dos salvaguardas, porque borrar es irreversible:
 *  - Mientras NO haya proveedor de correo configurado nadie ha recibido el correo de confirmación, así que nadie ha
 *    podido confirmar: no se elimina ninguna alta pendiente (el paso 2 se omite y se dice en el resultado).
 *  - `RETENCION_BOLETIN=off` detiene todo el trabajo sin tocar código.
 */
export const RETENCION = {
  /** Días que una alta sin confirmar espera antes de eliminarse. */
  altaSinConfirmarDias: 30,
  /** Días tras una baja antes de borrar los datos personales. */
  trasBajaDias: 30,
} as const;

/** Qué hizo una pasada de retención (y qué se saltó, con el motivo). */
export type ResultadoRetencion = { ipsBorradas: number; altasSinConfirmarEliminadas: number; bajasDepuradas: number; omitidas?: string[] };

/** Opciones de una pasada: la hora de referencia y, para las pruebas, si hay proveedor de correo (por defecto se consulta). */
export type OpcionesRetencion = { ahora?: Date; proveedorConfigurado?: boolean };

/** Aplica los plazos de retención. Idempotente: se puede ejecutar las veces que haga falta. */
export async function aplicarRetencion(opciones: OpcionesRetencion = {}): Promise<ResultadoRetencion> {
  if (process.env.RETENCION_BOLETIN === "off") {
    return { ipsBorradas: 0, altasSinConfirmarEliminadas: 0, bajasDepuradas: 0, omitidas: ["todo: desactivada con RETENCION_BOLETIN=off"] };
  }
  const ahora = opciones.ahora ?? new Date();
  const proveedorConfigurado = opciones.proveedorConfigurado ?? (await getProviderStatus()).configured;
  const omitidas: string[] = [];
  const dias = (n: number) => new Date(ahora.getTime() - n * 24 * 3600_000);

  // 1. IP de quien ya confirmó.
  const ips = await db
    .update(t)
    .set({ signupIp: null })
    .where(and(eq(t.confirmed, true), isNotNull(t.signupIp)))
    .returning({ id: t.id });

  // 2. Altas que nunca se confirmaron (solo si alguien pudo recibir el correo de confirmación).
  let sinConfirmar: { id: string }[] = [];
  if (proveedorConfigurado) {
    sinConfirmar = await db
      .delete(t)
      .where(and(eq(t.confirmed, false), isNull(t.unsubscribedAt), lt(t.createdAt, dias(RETENCION.altaSinConfirmarDias))))
      .returning({ id: t.id });
  } else {
    omitidas.push("altas sin confirmar: no hay proveedor de correo configurado, nadie ha podido confirmar");
  }

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

  return { ipsBorradas: ips.length, altasSinConfirmarEliminadas: sinConfirmar.length, bajasDepuradas: bajas.length, ...(omitidas.length ? { omitidas } : {}) };
}
