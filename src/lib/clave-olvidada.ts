import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, verificationTokens } from "@/db/schema";
import { generarClaveTemporal } from "@/lib/clave-temporal";

/**
 * «Olvidé mi contraseña». Quien la pide recibe por correo una contraseña temporal que vale UNA vez y durante 1 hora. Su contraseña de
 * siempre NO se toca al pedirla: así nadie puede dejar a otra persona sin acceso solo con saber su correo. Al entrar con la temporal,
 * esa pasa a ser su contraseña y el panel le obliga a cambiarla (`mustChangePassword`).
 *
 * Se guarda en `verification_tokens` (identificador `clave-temporal:<id>`) solo el hash bcrypt de la temporal, nunca la temporal.
 */
export const VIGENCIA_CLAVE_OLVIDADA_MIN = 60;
const id = (userId: string) => `clave-temporal:${userId}`;

/**
 * Deja lista una temporal si el correo es de una cuenta activa y la devuelve para enviarla por correo (el envío lo hace quien llama: este
 * módulo de acceso no depende del correo). Sin cuenta activa devuelve null; quien llama responde lo mismo en los dos casos.
 */
export async function emitirClaveOlvidada(email: string): Promise<{ nombre: string; email: string; clave: string } | null> {
  const [u] = await db.select({ id: users.id, name: users.name, email: users.email, active: users.active }).from(users).where(eq(users.email, email)).limit(1);
  if (!u?.active) return null;
  const clave = generarClaveTemporal();
  const hash = await bcrypt.hash(clave, 10);
  // Una sola temporal viva por cuenta: pedir otra anula la anterior.
  await db.transaction(async (tx) => {
    await tx.delete(verificationTokens).where(eq(verificationTokens.identifier, id(u.id)));
    await tx.insert(verificationTokens).values({ identifier: id(u.id), token: hash, expires: new Date(Date.now() + VIGENCIA_CLAVE_OLVIDADA_MIN * 60_000) });
  });
  return { nombre: u.name, email: u.email, clave };
}

/**
 * Al entrar: si la contraseña escrita es una temporal vigente de esa cuenta, la consume (se borra en la misma sentencia que la reclama,
 * así no sirve dos veces), la deja como contraseña y marca el cambio obligatorio. Devuelve si entró con ella.
 */
export async function usarClaveOlvidada(userId: string, password: string): Promise<boolean> {
  const vivas = await db
    .select({ token: verificationTokens.token })
    .from(verificationTokens)
    .where(and(eq(verificationTokens.identifier, id(userId)), gt(verificationTokens.expires, sql`now()`)));
  for (const v of vivas) {
    if (!(await bcrypt.compare(password, v.token))) continue;
    const reclamada = await db
      .delete(verificationTokens)
      .where(and(eq(verificationTokens.identifier, id(userId)), eq(verificationTokens.token, v.token)))
      .returning({ token: verificationTokens.token });
    if (!reclamada.length) return false; // otra petición la usó primero
    await db.update(users).set({ passwordHash: v.token, mustChangePassword: true, updatedAt: new Date() }).where(eq(users.id, userId));
    return true;
  }
  return false;
}

/** ¿La contraseña escrita es una temporal vigente de la cuenta? No la consume (primer paso del login, antes del código por correo). */
export async function claveOlvidadaValida(userId: string, password: string): Promise<boolean> {
  const vivas = await db
    .select({ token: verificationTokens.token })
    .from(verificationTokens)
    .where(and(eq(verificationTokens.identifier, id(userId)), gt(verificationTokens.expires, sql`now()`)));
  for (const v of vivas) if (await bcrypt.compare(password, v.token)) return true;
  return false;
}

/** Borra las temporales vencidas (las usadas ya se borran al usarlas). */
export async function purgarClavesOlvidadas(): Promise<void> {
  await db.delete(verificationTokens).where(and(sql`${verificationTokens.identifier} like 'clave-temporal:%'`, sql`${verificationTokens.expires} < now()`));
}
