import "server-only";
import { headers, cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Passkeys (WebAuthn) — helpers compartidos por el alta (Configuración →
 * Seguridad) y el login (público, /panel/login).
 *
 * El "Relying Party ID" (rpID) tiene que ser EXACTAMENTE el dominio desde el
 * que el navegador hace la petición — no un valor fijo en variable de
 * entorno — porque el sitio corre en varios dominios a la vez (los `.vercel.app`
 * de cada despliegue y, cuando esté listo, el dominio propio). Una passkey
 * creada en un dominio no sirve en otro: es una propiedad del estándar, no
 * un bug de esta implementación.
 */
export async function rpInfo(): Promise<{ rpID: string; rpName: string; origin: string }> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3100";
  const rpID = host.split(":")[0];
  const proto = h.get("x-forwarded-proto") ?? (rpID === "localhost" ? "http" : "https");
  return { rpID, rpName: "CONtexto Ganadero", origin: `${proto}://${host}` };
}

// Secreto con el que se firma el token puente; en producción es obligatorio.
function secret(): string {
  const s =
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV === "development" ? "contexto-ganadero-dev-secret" : undefined);
  if (!s) throw new Error("AUTH_SECRET es obligatorio.");
  return s;
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

/**
 * Puente de un solo uso hacia NextAuth: una vez verificada la respuesta
 * WebAuthn del lado del servidor, este token (firmado, caduca en 60 s) es lo
 * que el formulario de login le pasa al proveedor Credentials para terminar
 * de crear la sesión sin volver a pedir contraseña ni TOTP.
 */
export function firmarTokenPasskey(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + 60_000 })).toString(
    "base64url",
  );
  const firma = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${firma}`;
}

// Verifica la firma y la caducidad del token puente; devuelve el id del usuario o null.
export function verificarTokenPasskey(token: string): string | null {
  const [payload, firma] = token.split(".");
  if (!payload || !firma) return null;

  const esperada = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      uid?: string;
      exp?: number;
    };
    if (typeof uid !== "string" || typeof exp !== "number" || Date.now() > exp) return null;
    return uid;
  } catch {
    return null;
  }
}
