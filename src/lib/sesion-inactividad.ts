import { decode, encode, type JWT } from "next-auth/jwt";
import type { NextRequest } from "next/server";

/**
 * Cierre de sesión por inactividad: la sesión del panel dura 4 horas DESDE EL ÚLTIMO USO, no desde que se entró. El `proxy` renueva el
 * vencimiento firmado dentro de la sesión (el `exp` del JWT) en cada página o acción del panel; si pasan 4 horas sin usarla, el JWT
 * vence, Auth.js deja de aceptarlo y hay que volver a entrar (con contraseña y código). Lo decide el servidor: el vencimiento va firmado
 * dentro de la sesión, no en una cookie aparte que el navegador pudiera conservar.
 */
export const INACTIVIDAD_SEG = 4 * 60 * 60;
/** Se renueva como mucho cada 5 minutos: no hace falta reescribir la cookie en cada petición. */
const RENOVAR_CADA_SEG = 5 * 60;

// Mismos nombres que `SESSION_COOKIE` / `SESSION_COOKIE_SECURE` en src/lib/auth.ts (este archivo no importa auth.ts: lo usa el proxy).
const NOMBRES = ["__Secure-contexto.session-token", "contexto.session-token"] as const;

function secreto(): string | undefined {
  return process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "development" ? "contexto-ganadero-dev-secret" : undefined);
}

export type RevisionSesion =
  | { estado: "sin-sesion" }
  | { estado: "vencida"; cookie: string }
  | { estado: "vigente"; renovada?: { nombre: string; valor: string } };

/** Mira la sesión de la petición: si venció por inactividad y, si sigue viva, si toca renovarla. */
export async function revisarSesion(req: NextRequest): Promise<RevisionSesion> {
  const nombre = NOMBRES.find((n) => req.cookies.has(n));
  const valor = nombre ? req.cookies.get(nombre)?.value : undefined;
  const s = secreto();
  if (!nombre || !valor || !s) return { estado: "sin-sesion" };
  let token: JWT | null;
  try {
    token = await decode<JWT>({ token: valor, secret: s, salt: nombre });
  } catch {
    token = null;
  }
  // `decode` rechaza el JWT vencido: 4 horas sin usar el panel (o una sesión dañada).
  if (!token) return { estado: "vencida", cookie: nombre };
  const ahora = Math.floor(Date.now() / 1000);
  const exp = typeof token.exp === "number" ? token.exp : 0;
  if (exp - ahora > INACTIVIDAD_SEG - RENOVAR_CADA_SEG) return { estado: "vigente" };
  const { exp: _e, iat: _i, jti: _j, ...resto } = token;
  void _e; void _i; void _j;
  const nuevo = await encode({ token: resto, secret: s, salt: nombre, maxAge: INACTIVIDAD_SEG });
  return { estado: "vigente", renovada: { nombre, valor: nuevo } };
}
