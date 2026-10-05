"use server";

import { eq } from "drizzle-orm";
import { generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { db } from "@/db";
import { passkeys, users } from "@/db/schema";
import { guardarChallenge, leerYBorrarChallenge, rpInfo, firmarTokenPasskey } from "@/lib/passkey";

/**
 * Login con passkey (WebAuthn "sin usuario"): el navegador ofrece cualquier
 * passkey registrada para este dominio, sin pedir el correo antes. Por eso
 * `generateAuthenticationOptions` no lleva `allowCredentials` — es a
 * propósito, no un olvido.
 */
export async function iniciarLoginPasskey() {
  const { rpID } = await rpInfo();
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
  });
  await guardarChallenge(options.challenge);
  return options;
}

// Resultado de verificar la passkey: el token puente o un mensaje.
export type LoginPasskeyState = { ok: boolean; token?: string; message: string };

// Verifica la respuesta del navegador a la passkey (firma, origen y contador) y, si es válida, entrega el token que completa el inicio de sesión.
export async function confirmarLoginPasskey(
  respuesta: AuthenticationResponseJSON,
): Promise<LoginPasskeyState> {
  const challenge = await leerYBorrarChallenge();
  if (!challenge) return { ok: false, message: "El intento expiró, vuelve a intentarlo." };

  const [cred] = await db
    .select({
      id: passkeys.id,
      userId: passkeys.userId,
      credentialId: passkeys.credentialId,
      publicKey: passkeys.publicKey,
      counter: passkeys.counter,
      transports: passkeys.transports,
    })
    .from(passkeys)
    .where(eq(passkeys.credentialId, respuesta.id));
  if (!cred) return { ok: false, message: "Esa passkey no está registrada aquí." };

  const [u] = await db.select({ active: users.active }).from(users).where(eq(users.id, cred.userId));
  if (!u?.active) return { ok: false, message: "Cuenta inactiva." };

  const { rpID, origin } = await rpInfo();
  let verificacion;
  try {
    verificacion = await verifyAuthenticationResponse({
      response: respuesta,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: isoBase64URL.toBuffer(cred.credentialId),
        credentialPublicKey: isoBase64URL.toBuffer(cred.publicKey),
        counter: cred.counter,
        transports: cred.transports ? (JSON.parse(cred.transports) as AuthenticatorTransport[]) : undefined,
      },
    });
  } catch (e) {
    console.error("passkey: fallo al verificar el login", e);
    return { ok: false, message: "No se pudo verificar la passkey." };
  }

  if (!verificacion.verified) return { ok: false, message: "El navegador no confirmó la passkey." };

  await db
    .update(passkeys)
    .set({ counter: verificacion.authenticationInfo.newCounter, lastUsedAt: new Date() })
    .where(eq(passkeys.id, cred.id));

  return { ok: true, token: firmarTokenPasskey(cred.userId), message: "" };
}
