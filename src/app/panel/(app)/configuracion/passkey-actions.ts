"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { db } from "@/db";
import { passkeys } from "@/db/schema";
import { auth } from "@/lib/auth";
import { guardarChallenge, leerYBorrarChallenge, rpInfo } from "@/lib/passkey";

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

/** Paso 1 del alta: genera el reto que el navegador debe firmar. */
export async function iniciarRegistroPasskey() {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado.");

  const existentes = await db
    .select({ credentialId: passkeys.credentialId, transports: passkeys.transports })
    .from(passkeys)
    .where(eq(passkeys.userId, session.user.id));

  const { rpID, rpName } = await rpInfo();
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
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });

  await guardarChallenge(options.challenge);
  return options;
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

  const { rpID, origin } = await rpInfo();
  let verificacion;
  try {
    verificacion = await verifyRegistrationResponse({
      response: respuesta,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
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

export async function eliminarPasskey(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado.");
  await db.delete(passkeys).where(eq(passkeys.id, id));
  revalidatePath("/panel/configuracion");
}
