import "server-only";
import { randomBytes } from "node:crypto";
import { headers, cookies } from "next/headers";
import { firmar, igualesSeguro } from "@/lib/claves";
import { avisoSinHosts, hostPermitido, hostnameDe } from "@/lib/passkey-hosts";
import { usoUnico } from "@/lib/rate-limit";

/**
 * Passkeys (WebAuthn) — helpers compartidos por el alta (Configuración →
 * Seguridad) y el login (público, /panel/login).
 *
 * El "Relying Party ID" (rpID) tiene que ser EXACTAMENTE el dominio desde el
 * que el navegador hace la petición, porque el sitio corre en varios dominios
 * a la vez (los `.vercel.app` de cada despliegue y, cuando esté listo, el
 * dominio propio). Una passkey creada en un dominio no sirve en otro: es una
 * propiedad del estándar, no un bug de esta implementación.
 *
 * Esa cabecera, sin embargo, solo sirve para ELEGIR entre los dominios que el
 * despliegue declara (ver `src/lib/passkey-hosts.ts`): un dominio que no esté
 * en la lista se rechaza (H-09).
 */

/** El dominio de la petición no figura entre los permitidos para passkeys. */
export class DominioNoPermitido extends Error {
  constructor(host: string) {
    super(`Dominio no permitido para passkeys: ${host || "(vacío)"}`);
    this.name = "DominioNoPermitido";
  }
}

// Avisa una sola vez por proceso de que la lista de dominios está vacía y, por tanto, no se filtra nada.
let avisado = false;

export async function rpInfo(): Promise<{ rpID: string; rpName: string; origin: string }> {
  const h = await headers();
  // Con varios proxies `x-forwarded-host` puede traer una lista: vale el primero, que es el que escribió la persona.
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  if (!hostPermitido(host)) throw new DominioNoPermitido(host);
  if (!avisado && avisoSinHosts()) {
    avisado = true;
    console.warn("[passkey] el despliegue no declara dominios (NEXT_PUBLIC_SITE_URL / PASSKEY_ALLOWED_HOSTS): se acepta el de la petición.");
  }
  const rpID = hostnameDe(host) ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? (rpID === "localhost" ? "http" : "https");
  return { rpID, rpName: "CONtexto Ganadero", origin: `${proto}://${host}` };
}

// Cookie temporal que guarda el desafío de la ceremonia WebAuthn.
const CHALLENGE_COOKIE = "contexto.passkey-challenge";

/** Guarda el challenge de una ceremonia WebAuthn en curso (registro o login). */
export async function guardarChallenge(challenge: string) {
  (await cookies()).set(CHALLENGE_COOKIE, challenge, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 5 * 60,
  });
}

// Lee el desafío guardado y lo borra: solo sirve una vez.
export async function leerYBorrarChallenge(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(CHALLENGE_COOKIE)?.value ?? null;
  jar.delete(CHALLENGE_COOKIE);
  return v;
}

/** Vida del token puente. */
const TOKEN_TTL_MS = 60_000;

/**
 * Puente hacia NextAuth: una vez verificada la respuesta WebAuthn del lado del servidor, este token (firmado con la
 * clave del propósito «passkey-puente», caduca en 60 s y lleva un identificador propio) es lo que el formulario de
 * login le pasa al proveedor Credentials para terminar de crear la sesión sin volver a pedir contraseña ni TOTP.
 * Solo vale UNA vez: `consumirTokenPasskey` registra su identificador y rechaza cualquier repetición.
 */
export function firmarTokenPasskey(userId: string, ahora = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: ahora + TOKEN_TTL_MS, jti: randomBytes(16).toString("base64url") }),
  ).toString("base64url");
  return `${payload}.${firmar("passkey-puente", payload)}`;
}

/**
 * Comprueba la firma y la caducidad del token y devuelve su contenido, SIN consumirlo. Para autenticar hay que usar
 * `consumirTokenPasskey`; esta función existe para poder probar la firma por separado.
 */
export function leerTokenPasskey(token: string, ahora = Date.now()): { uid: string; jti: string } | null {
  const [payload, firma, resto] = token.split(".");
  if (!payload || !firma || resto !== undefined) return null;
  try {
    if (!igualesSeguro(firma, firmar("passkey-puente", payload))) return null;
    const { uid, exp, jti } = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      uid?: string;
      exp?: number;
      jti?: string;
    };
    if (typeof uid !== "string" || typeof jti !== "string" || typeof exp !== "number" || ahora > exp) return null;
    return { uid, jti };
  } catch {
    return null;
  }
}

/**
 * Valida el token puente Y lo gasta: devuelve el id de la cuenta la primera vez y `null` en cualquier repetición,
 * aunque no haya caducado. El gasto es un UPSERT atómico en Postgres, así que vale entre instancias.
 */
export async function consumirTokenPasskey(token: string): Promise<string | null> {
  const t = leerTokenPasskey(token);
  if (!t) return null;
  // Se recuerda un poco más que la vida del token: nunca puede reaparecer una vez gastado.
  if (!(await usoUnico(`passkey-token:${t.jti}`, 180))) return null;
  return t.uid;
}
