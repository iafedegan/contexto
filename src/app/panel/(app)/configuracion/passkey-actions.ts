"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";
import type { PublicKeyCredentialCreationOptionsJSON, RegistrationResponseJSON } from "@simplewebauthn/types";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { db } from "@/db";
import { passkeys } from "@/db/schema";
import { auth } from "@/lib/auth";
import { DominioNoPermitido, guardarChallenge, leerYBorrarChallenge, rpInfo } from "@/lib/passkey";

// Estado que se devuelve al formulario: si salió bien y el mensaje.
export type PasskeyState = { ok: boolean; message: string } | null;

/** Lista las passkeys de la sesión activa, para pintarlas en Configuración. */
export async function listarPasskeys() {
  const session = await auth();
  if (!session?.user) return [];
  return db
    .select({
      id: passkeys.id,
      label: passkeys.label,
      deviceType: passkeys.deviceType,
      createdAt: passkeys.createdAt,
      lastUsedAt: passkeys.lastUsedAt,
    })
    .from(passkeys)
    .where(eq(passkeys.userId, session.user.id));
}

// Resultado de pedir el reto de alta: las opciones para el navegador o un mensaje.
export type InicioRegistroState =
  | { ok: true; options: PublicKeyCredentialCreationOptionsJSON }
  | { ok: false; message: string };

/** Paso 1 del alta: genera el reto que el navegador debe firmar. */
export async function iniciarRegistroPasskey(): Promise<InicioRegistroState> {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado.");

  const existentes = await db
    .select({ credentialId: passkeys.credentialId, transports: passkeys.transports })
    .from(passkeys)
    .where(eq(passkeys.userId, session.user.id));

  let rp: { rpID: string; rpName: string };
  try {
    rp = await rpInfo();
  } catch (e) {
    if (e instanceof DominioNoPermitido) return { ok: false, message: "Las passkeys no están habilitadas para este dominio." };
    throw e;
  }
  const { rpID, rpName } = rp;
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: session.user.id,
    userName: session.user.email ?? session.user.id,
    userDisplayName: session.user.name ?? session.user.email ?? "Editor",
    attestationType: "none",
    excludeCredentials: existentes.map((e) => ({
      id: isoBase64URL.toBuffer(e.credentialId),
      type: "public-key" as const,
      transports: e.transports ? (JSON.parse(e.transports) as AuthenticatorTransport[]) : undefined,
    })),
    // La passkey sustituye a contraseña y segundo factor: solo se aceptan llaves que verifican a la persona (PIN, huella
    // o rostro), la misma exigencia con la que luego se usan (ver `iniciarLoginPasskey`).
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
  });

  await guardarChallenge(options.challenge);
  return { ok: true, options };
}

/** Paso 2: verifica la respuesta del navegador y guarda la credencial. */
export async function confirmarRegistroPasskey(
  respuesta: RegistrationResponseJSON,
  label: string,
): Promise<PasskeyState> {
  const session = await auth();
  if (!session?.user) return { ok: false, message: "Sesión expirada, vuelve a entrar." };

  const challenge = await leerYBorrarChallenge();
  if (!challenge) return { ok: false, message: "El registro expiró, inténtalo de nuevo." };

  let rp: { rpID: string; origin: string };
  try {
    rp = await rpInfo();
  } catch (e) {
    if (e instanceof DominioNoPermitido) return { ok: false, message: "Las passkeys no están habilitadas para este dominio." };
    throw e;
  }
  let verificacion;
  try {
    verificacion = await verifyRegistrationResponse({
      response: respuesta,
      expectedChallenge: challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      requireUserVerification: true,
    });
  } catch (e) {
    console.error("passkey: fallo al verificar el registro", e);
    return { ok: false, message: "No se pudo verificar el dispositivo." };
  }

  if (!verificacion.verified || !verificacion.registrationInfo) {
    return { ok: false, message: "El navegador no confirmó el registro." };
  }

  const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } =
    verificacion.registrationInfo;

  await db.insert(passkeys).values({
    userId: session.user.id,
    credentialId: isoBase64URL.fromBuffer(credentialID),
    publicKey: isoBase64URL.fromBuffer(credentialPublicKey),
    counter,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    label: label.trim() || "Dispositivo sin nombre",
  });

  revalidatePath("/panel/configuracion");
  return { ok: true, message: "Passkey agregada." };
}

// Elimina una passkey de la cuenta de la persona con sesión. Solo las suyas: sin filtrar por dueña, cualquiera con
// sesión podía borrar la passkey de otra cuenta conociendo su id.
export async function eliminarPasskey(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado.");
  await db.delete(passkeys).where(and(eq(passkeys.id, id), eq(passkeys.userId, session.user.id)));
  revalidatePath("/panel/configuracion");
}
