import "server-only";
import { randomUUID } from "node:crypto";
import { eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { newsletterSubscribers as t } from "@/db/schema";
import { hit } from "@/lib/rate-limit";

/**
 * Alta en el boletín con doble opt-in: el ÚNICO sitio que decide qué pasa cuando llega una dirección. Lo usan el
 * formulario del sitio (`src/app/acciones/boletin.ts`) y la API pública (`/api/v1/boletin/suscripcion`).
 *
 * Reglas (hallazgo H-11):
 *  - Confirmada y sin baja: no se hace nada ni se revela (la respuesta es igual a la de un alta nueva).
 *  - Quien se dio de baja es un alta nueva: token nuevo y a confirmar otra vez (`confirmed` seguía en `true`).
 *  - Alta pendiente (nunca confirmada): se conserva su token y NO se sobrescribe nada de lo guardado; solo se completan
 *    los campos que estaban vacíos. Así un tercero no puede pisar los datos de una dirección ajena ni invalidar el
 *    enlace que su dueño ya tiene en el correo.
 *  - Como máximo 3 correos de confirmación por hora a una misma dirección, vengan de la IP que vengan.
 */

/** Datos opcionales del alta. Solo se guardan donde la persona aún no tenía un valor. */
export type DatosAlta = Partial<{
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  mobile: string | null;
  signupPostal: string | null;
  neighborhood: string | null;
  signupGeoSource: string | null;
  signupGeoAccuracy: string | null;
  signupIp: string | null;
  signupCity: string | null;
  signupCountry: string | null;
  signupLat: string | null;
  signupLon: string | null;
}>;

/** Qué hacer tras recibir una dirección: nada (ya suscrita) o enviar el correo de confirmación con este token. */
export type ResultadoAlta = { estado: "ya_suscrito" } | { estado: "pendiente"; token: string; enviar: boolean };

/** Correos de confirmación por hora y dirección. */
const CORREOS_POR_HORA = 3;

// Columnas que se completan con `coalesce` (solo si están vacías) y el tipo con que se compara cada una.
const COMPLETABLES: Record<keyof DatosAlta, { columna: SQL; tipo: "text" | "date" | "numeric" }> = {
  firstName: { columna: sql`${t.firstName}`, tipo: "text" },
  lastName: { columna: sql`${t.lastName}`, tipo: "text" },
  birthDate: { columna: sql`${t.birthDate}`, tipo: "date" },
  mobile: { columna: sql`${t.mobile}`, tipo: "text" },
  signupPostal: { columna: sql`${t.signupPostal}`, tipo: "text" },
  neighborhood: { columna: sql`${t.neighborhood}`, tipo: "text" },
  signupGeoSource: { columna: sql`${t.signupGeoSource}`, tipo: "text" },
  signupGeoAccuracy: { columna: sql`${t.signupGeoAccuracy}`, tipo: "numeric" },
  signupIp: { columna: sql`${t.signupIp}`, tipo: "text" },
  signupCity: { columna: sql`${t.signupCity}`, tipo: "text" },
  signupCountry: { columna: sql`${t.signupCountry}`, tipo: "text" },
  signupLat: { columna: sql`${t.signupLat}`, tipo: "numeric" },
  signupLon: { columna: sql`${t.signupLon}`, tipo: "numeric" },
};

// Valores `coalesce(columna, nuevo)` solo para los datos que llegaron: lo ya guardado nunca se pisa.
function soloVacios(datos: DatosAlta): Record<string, SQL> {
  const set: Record<string, SQL> = {};
  for (const [clave, valor] of Object.entries(datos) as [keyof DatosAlta, string | null | undefined][]) {
    if (valor === null || valor === undefined || valor === "") continue;
    const { columna, tipo } = COMPLETABLES[clave];
    const nuevo = tipo === "text" ? sql`${valor}` : tipo === "date" ? sql`${valor}::date` : sql`${valor}::numeric`;
    set[clave] = sql`coalesce(${columna}, ${nuevo})`;
  }
  return set;
}

// Valores limpios para un alta nueva: sin nulos ni vacíos.
function limpios(datos: DatosAlta): DatosAlta {
  return Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== null && v !== undefined && v !== "")) as DatosAlta;
}

/** Registra la solicitud de alta y dice qué hacer a continuación. No envía el correo: eso lo hace quien llama. */
export async function solicitarAlta(email: string, datos: DatosAlta = {}): Promise<ResultadoAlta> {
  const leer = async () =>
    (
      await db
        .select({ id: t.id, confirmed: t.confirmed, unsubscribedAt: t.unsubscribedAt, confirmToken: t.confirmToken })
        .from(t)
        .where(eq(t.email, email))
        .limit(1)
    )[0];

  let existente = await leer();
  // Confirmada y sin baja: ya está suscrita. No se confirma ni se niega nada distinto de un alta nueva.
  if (existente?.confirmed && !existente.unsubscribedAt) return { estado: "ya_suscrito" };

  const enviar = (await hit(`boletin:correo:${email}`, CORREOS_POR_HORA, 60 * 60)).allowed;

  if (!existente) {
    const token = randomUUID();
    const [nueva] = await db
      .insert(t)
      .values({ email, confirmToken: token, ...limpios(datos) })
      .onConflictDoNothing({ target: t.email })
      .returning({ id: t.id });
    if (nueva) return { estado: "pendiente", token, enviar };
    // Otra solicitud la creó un instante antes: se sigue como alta pendiente.
    existente = await leer();
    if (!existente) return { estado: "pendiente", token, enviar: false };
  }

  const pendiente = !existente.confirmed && !!existente.confirmToken;
  const token = pendiente ? existente.confirmToken! : randomUUID();
  if (enviar) {
    const cambios: Record<string, SQL | string | boolean | null> = { ...soloVacios(datos) };
    if (!pendiente) Object.assign(cambios, { confirmToken: token, confirmed: false, unsubscribedAt: null });
    if (Object.keys(cambios).length) await db.update(t).set(cambios).where(eq(t.id, existente.id));
  }
  return { estado: "pendiente", token, enviar };
}
