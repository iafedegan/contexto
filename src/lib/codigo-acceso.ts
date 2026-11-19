import "server-only";
import { randomInt } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { verificationTokens } from "@/db/schema";
import { firmar, igualesSeguro } from "@/lib/claves";
import { hit } from "@/lib/rate-limit";

/**
 * Código de acceso por correo (segundo paso del login con contraseña). Tras comprobar correo y contraseña se envía un código de
 * 4 dígitos al correo de la cuenta; sin él no se entra. Vale 10 minutos, una sola vez, y admite 5 intentos: con 10.000 combinaciones,
 * adivinarlo a ciegas tiene una probabilidad de 1 en 2.000 por código, y cada código nuevo exige volver a pasar por la contraseña.
 *
 * Se guarda en `verification_tokens` (identificador `codigo-acceso:<id>`) solo su firma HMAC con una clave propia (`claves.ts`).
 * La passkey no pasa por aquí: ya es un segundo factor (el dispositivo más la huella, el rostro o el PIN).
 *
 * `LOGIN_SIN_CODIGO=1` lo apaga (para emergencias: si el correo deja de salir, nadie podría entrar con contraseña).
 */
export const VIGENCIA_CODIGO_MIN = 10;
export const INTENTOS_CODIGO = 5;
const id = (userId: string) => `codigo-acceso:${userId}`;
const huella = (userId: string, codigo: string) => firmar("codigo-acceso", `${userId}:${codigo}`);

/** ¿Se exige el código por correo? */
export const codigoActivo = () => process.env.LOGIN_SIN_CODIGO?.trim() !== "1";

/** Crea un código nuevo para la cuenta (anula el anterior) y lo devuelve para enviarlo. */
export async function crearCodigoAcceso(userId: string): Promise<string> {
  const codigo = String(randomInt(0, 10_000)).padStart(4, "0");
  await db.transaction(async (tx) => {
    await tx.delete(verificationTokens).where(eq(verificationTokens.identifier, id(userId)));
    await tx.insert(verificationTokens).values({ identifier: id(userId), token: huella(userId, codigo), expires: new Date(Date.now() + VIGENCIA_CODIGO_MIN * 60_000) });
  });
  return codigo;
}

/** ¿Hay un código vigente para la cuenta? (sin él, ni se mira la contraseña: no hay nada que adivinar). */
export async function hayCodigoVigente(userId: string): Promise<boolean> {
  const [v] = await db.select({ token: verificationTokens.token }).from(verificationTokens).where(and(eq(verificationTokens.identifier, id(userId)), gt(verificationTokens.expires, sql`now()`))).limit(1);
  return Boolean(v);
}

/**
 * Comprueba el código y, si es correcto, lo consume (se borra en la misma sentencia que lo reclama: no sirve dos veces). Cada intento
 * cuenta; al quinto fallo el código se anula y hay que pedir otro.
 */
export async function usarCodigoAcceso(userId: string, codigo: string): Promise<"ok" | "incorrecto" | "agotado"> {
  const limpio = codigo.replace(/\D/g, "");
  const intento = await hit(`codigo-acceso:intentos:${userId}`, INTENTOS_CODIGO, VIGENCIA_CODIGO_MIN * 60);
  if (!intento.allowed) {
    await db.delete(verificationTokens).where(eq(verificationTokens.identifier, id(userId)));
    return "agotado";
  }
  const [v] = await db.select({ token: verificationTokens.token }).from(verificationTokens).where(and(eq(verificationTokens.identifier, id(userId)), gt(verificationTokens.expires, sql`now()`))).limit(1);
  if (!v || limpio.length !== 4 || !igualesSeguro(v.token, huella(userId, limpio))) return "incorrecto";
  const reclamado = await db.delete(verificationTokens).where(and(eq(verificationTokens.identifier, id(userId)), eq(verificationTokens.token, v.token))).returning({ token: verificationTokens.token });
  return reclamado.length ? "ok" : "incorrecto";
}

/** Borra los códigos vencidos (los usados se borran al usarlos). */
export async function purgarCodigosAcceso(): Promise<void> {
  await db.delete(verificationTokens).where(and(sql`${verificationTokens.identifier} like 'codigo-acceso:%'`, sql`${verificationTokens.expires} < now()`));
}
