"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/types";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { db } from "@/db";
import { passkeys, users } from "@/db/schema";
import { DominioNoPermitido, guardarChallenge, leerYBorrarChallenge, rpInfo, firmarTokenPasskey } from "@/lib/passkey";
import { clientIp, hit } from "@/lib/rate-limit";

/** Intentos de passkey por IP y ventana: más holgados que los de contraseña porque cada uno exige un gesto del dispositivo. */
const INTENTOS_POR_IP = 20;
// Ventana de los límites de passkey, en segundos.
const VENTANA = 15 * 60;
// Mensaje cuando se supera un límite.
const DEMASIADOS = "Demasiados intentos. Espera unos minutos y vuelve a probar.";

// Resultado de pedir el desafío: las opciones para el navegador o un mensaje.
export type InicioPasskeyState =
  | { ok: true; options: PublicKeyCredentialRequestOptionsJSON }
  | { ok: false; message: string };

/**
 * Login con passkey (WebAuthn "sin usuario"): el navegador ofrece cualquier
 * passkey registrada para este dominio, sin pedir el correo antes. Por eso
 * `generateAuthenticationOptions` no lleva `allowCredentials` — es a
 * propósito, no un olvido.
 *
 * La passkey sustituye a contraseña, Turnstile y TOTP, así que (H-09) se exige
 * verificación del usuario (`required`: PIN, huella o rostro; una llave que
 * solo se toca no basta) y los intentos se limitan por IP.
 */
export async function iniciarLoginPasskey(): Promise<InicioPasskeyState> {
  const ip = clientIp(await headers());
  if (!(await hit(`passkey:inicio:${ip}`, INTENTOS_POR_IP, VENTANA)).allowed) return { ok: false, message: DEMASIADOS };

  let rpID: string;
  try {
    ({ rpID } = await rpInfo());
  } catch (e) {
    if (e instanceof DominioNoPermitido) return { ok: false, message: "Las passkeys no están habilitadas para este dominio." };
    throw e;
  }
  const options = await generateAuthenticationOptions({ rpID, userVerification: "required" });
  await guardarChallenge(options.challenge);
  return { ok: true, options };
}

// Resultado de verificar la passkey: el token puente o un mensaje.
export type LoginPasskeyState = { ok: boolean; token?: string; message: string };

// Verifica la respuesta del navegador a la passkey (firma, origen, contador y verificación del usuario) y, si es válida, entrega el token de un solo uso que completa el inicio de sesión.
export async function confirmarLoginPasskey(
  respuesta: AuthenticationResponseJSON,
): Promise<LoginPasskeyState> {
  // Se cuenta el intento ANTES de comprobar nada, por IP y por credencial: ni siquiera un fallo permite insistir sin freno.
  const ip = clientIp(await headers());
  const credencial = String(respuesta?.id ?? "").slice(0, 200);
  const [porIp, porCredencial] = await Promise.all([
    hit(`passkey:confirmar:${ip}`, INTENTOS_POR_IP, VENTANA),
    hit(`passkey:credencial:${credencial}`, 10, VENTANA),
  ]);
  if (!porIp.allowed || !porCredencial.allowed) return { ok: false, message: DEMASIADOS };

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
    .where(eq(passkeys.credentialId, credencial));
  if (!cred) return { ok: false, message: "Esa passkey no está registrada aquí." };

  const [u] = await db.select({ active: users.active }).from(users).where(eq(users.id, cred.userId));
  if (!u?.active) return { ok: false, message: "Cuenta inactiva." };

  let rp: { rpID: string; origin: string };
  try {
    rp = await rpInfo();
  } catch (e) {
    if (e instanceof DominioNoPermitido) return { ok: false, message: "Las passkeys no están habilitadas para este dominio." };
    throw e;
  }
  let verificacion;
  try {
    verificacion = await verifyAuthenticationResponse({
      response: respuesta,
      expectedChallenge: challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      // Explícito aunque sea el valor por defecto de la librería: el contrato no debe depender de ella.
      requireUserVerification: true,
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
