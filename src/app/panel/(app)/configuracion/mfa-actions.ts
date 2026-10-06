"use server";

/**
 * Alta y baja del segundo factor (TDR §10: MFA).
 *
 * El secreto se genera en el servidor y solo se guarda cuando la persona
 * demuestra con un código válido que su aplicación ya lo tiene: así nadie se
 * queda con el 2FA activado y sin poder entrar. Hasta ese momento el secreto
 * viaja en el formulario, nunca a la base de datos.
 */

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { generateSecret, generateURI } from "otplib";
import QRCode from "qrcode";
import { db } from "@/db";
import { users } from "@/db/schema";
import { auth, requireRole } from "@/lib/auth";
import { getSiteIdentity } from "@/lib/site-identity";
import { codigoTotpValido, verificarCodigoTotp } from "@/lib/totp";

// Datos para activar el segundo factor: secreto, código QR y enlace.
export type MfaSetup = { secret: string; qr: string; uri: string };

/** Genera un secreto nuevo y su código QR, sin tocar todavía la cuenta. */
export async function iniciarMfa(): Promise<MfaSetup> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("NO_AUTENTICADO");

  const { name } = await getSiteIdentity();
  const secret = generateSecret();
  const uri = generateURI({ secret, label: session.user.email, issuer: name });
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 240 });
  return { secret, qr, uri };
}

// Estado que se devuelve al formulario: si salió bien y el mensaje.
export type MfaState = { ok: boolean; message: string } | null;

/** Activa el 2FA si el código corresponde al secreto recién generado. */
export async function confirmarMfa(_prev: MfaState, formData: FormData): Promise<MfaState> {
  const me = await requireRole("redactor");
  const secret = String(formData.get("secret") ?? "");
  const token = String(formData.get("token") ?? "").replace(/\s/g, "");

  if (!secret || !token) return { ok: false, message: "Falta el código de verificación." };
  // Solo demuestra que la aplicación ya tiene el secreto: no se gasta el código (ver `codigoTotpValido`).
  if (!codigoTotpValido(secret, token)) {
    return { ok: false, message: "El código no coincide. Comprueba la hora del teléfono e inténtalo otra vez." };
  }

  await db
    .update(users)
    .set({ totpSecret: secret, totpEnabled: true, updatedAt: new Date() })
    .where(eq(users.id, me.id));

  revalidatePath("/panel/configuracion");
  return { ok: true, message: "Verificación en dos pasos activada." };
}

/** Desactiva el 2FA exigiendo un código válido: no basta con estar dentro. */
export async function desactivarMfa(_prev: MfaState, formData: FormData): Promise<MfaState> {
  const me = await requireRole("redactor");
  const token = String(formData.get("token") ?? "").replace(/\s/g, "");

  const [u] = await db
    .select({ totpSecret: users.totpSecret })
    .from(users)
    .where(eq(users.id, me.id))
    .limit(1);

  if (!u?.totpSecret) return { ok: false, message: "La cuenta no tiene verificación en dos pasos." };
  const verificacion = await verificarCodigoTotp(me.id, u.totpSecret, token);
  if (!verificacion.ok) {
    return {
      ok: false,
      message: verificacion.motivo === "reutilizado" ? "Ese código ya se usó. Espera al siguiente (cambia cada 30 s)." : "El código no coincide.",
    };
  }

  await db
    .update(users)
    .set({ totpSecret: null, totpEnabled: false, updatedAt: new Date() })
    .where(eq(users.id, me.id));

  revalidatePath("/panel/configuracion");
  return { ok: true, message: "Verificación en dos pasos desactivada." };
}
