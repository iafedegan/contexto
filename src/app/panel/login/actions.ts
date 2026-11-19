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
import { verifyHuman } from "@/lib/turnstile";
import bcrypt from "bcryptjs";
import { claveOlvidadaValida, emitirClaveOlvidada, VIGENCIA_CLAVE_OLVIDADA_MIN } from "@/lib/clave-olvidada";
import { enviarClaveTemporal, enviarCodigoAcceso } from "@/lib/correo-clave-temporal";
import { codigoActivo, crearCodigoAcceso, hayCodigoVigente, VIGENCIA_CODIGO_MIN } from "@/lib/codigo-acceso";

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

// Resultado de pedir la contraseña temporal: siempre el mismo mensaje si se aceptó (no revela si el correo existe).
export type OlvidoState = { ok: boolean; message: string };

/**
 * «Olvidé mi contraseña»: envía una temporal al correo registrado. Límites por IP y por correo y verificación humana, igual que el
 * login. La respuesta es la misma exista o no la cuenta, para no permitir adivinar qué correos tienen acceso al panel.
 */
export async function pedirClaveOlvidada(input: { email: string; captcha?: string }): Promise<OlvidoState> {
  const email = String(input?.email ?? "").toLowerCase().trim().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Escribe el correo con el que entras al panel." };
  const ip = clientIp(await headers());
  const [porIp, porCorreo] = await Promise.all([hit(`olvido:ip:${ip}`, 5, 60 * 60), hit(`olvido:email:${email}`, 3, 60 * 60)]);
  if (!porIp.allowed || !porCorreo.allowed) return { ok: false, message: "Ya pediste varias contraseñas temporales. Revisa tu correo (también el spam) o espera una hora." };
  if (!(await verifyHuman(String(input?.captcha ?? ""), ip))) return { ok: false, message: "No se pudo verificar que eres una persona. Vuelve a intentarlo." };
  try {
    const lista = await emitirClaveOlvidada(email);
    if (lista) {
      const envio = await enviarClaveTemporal({ ...lista, motivo: "olvido" });
      if (!envio.ok) console.warn(`[clave-olvidada] el correo no salió: ${envio.error}`);
    }
  } catch (e) {
    console.error("[clave-olvidada] fallo al emitir", e);
  }
  return {
    ok: true,
    message: `Si ese correo tiene una cuenta activa, en unos minutos te llega una contraseña temporal (revisa también el spam). Sirve una vez y vence en ${VIGENCIA_CLAVE_OLVIDADA_MIN} minutos; tu contraseña de siempre sigue funcionando.`,
  };
}

// Resultado del primer paso del login: pasar al código (con el correo enmascarado), entrar directo (código apagado) o un mensaje.
export type InicioLoginState =
  | { ok: true; paso: "codigo"; correo: string; minutos: number }
  | { ok: true; paso: "directo" }
  | { ok: false; message: string };

const CREDENCIALES_MAL = "Correo o contraseña incorrectos. Tras 5 intentos fallidos la cuenta se bloquea 15 minutos.";

// «ed•••@gmail.com»: se ve a qué correo llegó sin mostrarlo entero en pantalla.
const enmascarar = (email: string) => {
  const [u, d] = email.split("@");
  return `${u.slice(0, 2)}•••@${d ?? ""}`;
};

/** La cuenta si el correo y la contraseña (la de siempre o una temporal de «Olvidé mi contraseña») son correctos. */
async function cuentaConClave(email: string, password: string) {
  const [u] = await db.select({ id: users.id, name: users.name, email: users.email, active: users.active, passwordHash: users.passwordHash }).from(users).where(eq(users.email, email)).limit(1);
  if (!u?.active || !u.passwordHash) return null;
  const ok = (await bcrypt.compare(password, u.passwordHash)) || (await claveOlvidadaValida(u.id, password));
  return ok ? u : null;
}

/** Genera el código, lo envía y devuelve el paso siguiente. */
async function mandarCodigo(u: { id: string; name: string; email: string }): Promise<InicioLoginState> {
  if (!(await hit(`codigo-acceso:envio:${u.id}`, 5, 15 * 60)).allowed) return { ok: false, message: "Ya te enviamos varios códigos. Revisa tu correo (también el spam) o espera 15 minutos." };
  const codigo = await crearCodigoAcceso(u.id);
  const envio = await enviarCodigoAcceso({ nombre: u.name, email: u.email, codigo, minutos: VIGENCIA_CODIGO_MIN });
  if (!envio.ok) {
    if (process.env.NODE_ENV === "development") console.info(`[codigo-acceso] (desarrollo, sin correo) código de ${u.email}: ${codigo}`);
    else {
      console.error(`[codigo-acceso] el correo no salió: ${envio.error}`);
      return { ok: false, message: "No pudimos enviarte el código al correo. Inténtalo en un momento, entra con passkey o avisa a un administrador." };
    }
  }
  return { ok: true, paso: "codigo", correo: enmascarar(u.email), minutos: VIGENCIA_CODIGO_MIN };
}

/**
 * Primer paso del login con contraseña: comprueba correo, contraseña y verificación humana (con los mismos límites que antes) y, si
 * están bien, envía el código de 4 dígitos al correo de la cuenta. La sesión solo se abre en el segundo paso, con el código
 * (`authorize` en src/lib/auth.ts). Con el código apagado (`LOGIN_SIN_CODIGO=1`) se entra directo, como antes.
 */
export async function iniciarLogin(input: { email: string; password: string; captcha?: string }): Promise<InicioLoginState> {
  if (!codigoActivo()) return { ok: true, paso: "directo" };
  const email = String(input?.email ?? "").toLowerCase().trim().slice(0, 200);
  const password = String(input?.password ?? "");
  if (!email || !password) return { ok: false, message: "Escribe tu correo y tu contraseña." };
  const ip = clientIp(await headers());
  const [porIp, porCuenta] = await Promise.all([hit(`login:ip:${ip}`, 20, 15 * 60), hit(`login:email:${email}`, 5, 15 * 60)]);
  if (!porIp.allowed || !porCuenta.allowed) return { ok: false, message: "Demasiados intentos. Espera 15 minutos y vuelve a probar." };
  if (!(await verifyHuman(String(input?.captcha ?? ""), ip))) return { ok: false, message: "No se pudo verificar que eres una persona. Vuelve a intentarlo." };
  const u = await cuentaConClave(email, password);
  if (!u) return { ok: false, message: CREDENCIALES_MAL };
  return mandarCodigo(u);
}

/** «Reenviar el código»: solo mientras siga vivo el anterior (es decir, quien lo pide acaba de pasar la contraseña); si no, a empezar. */
export async function reenviarCodigo(input: { email: string; password: string }): Promise<InicioLoginState> {
  const email = String(input?.email ?? "").toLowerCase().trim().slice(0, 200);
  const ip = clientIp(await headers());
  if (!(await hit(`login:ip:${ip}`, 20, 15 * 60)).allowed) return { ok: false, message: "Demasiados intentos. Espera 15 minutos y vuelve a probar." };
  const u = await cuentaConClave(email, String(input?.password ?? ""));
  if (!u || !(await hayCodigoVigente(u.id))) return { ok: false, message: "El código venció. Vuelve a escribir tu contraseña." };
  return mandarCodigo(u);
}
