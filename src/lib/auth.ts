import "server-only";
import { redirect } from "next/navigation";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { verifySync as verifyTotp } from "otplib";
import { db } from "@/db";
import { users, type UserRole } from "@/db/schema";
import { clearHits, clientIp, hit } from "@/lib/rate-limit";
import { verifyHuman } from "@/lib/turnstile";
import { verificarTokenPasskey } from "@/lib/passkey";
import { tienePermiso } from "@/lib/permisos-server";
import type { PermisoId } from "@/lib/permisos";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: UserRole } & DefaultSession["user"];
  }
  interface User {
    role: UserRole;
  }
}

/**
 * En producción el secreto viene siempre de `AUTH_SECRET`. En el MVP local
 * (sin `.env.local`) se usa un secreto fijo de desarrollo para que el panel
 * funcione sin configuración; nunca se aplica fuera de `next dev`.
 */
const secret =
  process.env.AUTH_SECRET ??
  (process.env.NODE_ENV === "development" ? "contexto-ganadero-dev-secret" : undefined);

/**
 * Nombre de cookie propio del proyecto. Las cookies ignoran el puerto: varias
 * apps Next en `localhost` comparten jar y se pisan la `authjs.session-token`
 * entre sí, dejando al panel en un bucle /panel → /panel/login. Con prefijo
 * propio cada app conserva su sesión.
 */
const COOKIE_PREFIX = "contexto";
const useSecureCookies = process.env.NODE_ENV === "production";
export const SESSION_COOKIE = `${COOKIE_PREFIX}.session-token`;
export const SESSION_COOKIE_SECURE = `__Secure-${COOKIE_PREFIX}.session-token`;

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret,
  trustHost: true,
  cookies: {
    sessionToken: {
      name: useSecureCookies ? SESSION_COOKIE_SECURE : SESSION_COOKIE,
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: useSecureCookies },
    },
    csrfToken: {
      name: useSecureCookies ? `__Host-${COOKIE_PREFIX}.csrf-token` : `${COOKIE_PREFIX}.csrf-token`,
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: useSecureCookies },
    },
    callbackUrl: {
      name: useSecureCookies
        ? `__Secure-${COOKIE_PREFIX}.callback-url`
        : `${COOKIE_PREFIX}.callback-url`,
      options: { sameSite: "lax", path: "/", secure: useSecureCookies },
    },
  },
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/panel/login" },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
        totp: {}, // código de 6 dígitos del segundo factor
        captcha: {}, // token de Cloudflare Turnstile (verificación humana)
        passkeyToken: {}, // puente firmado desde confirmarLoginPasskey (ver src/lib/passkey.ts)
      },
      async authorize(creds, request) {
        const email = String(creds?.email ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        const totp = String(creds?.totp ?? "").trim();
        const passkeyToken = String(creds?.passkeyToken ?? "").trim();

        /**
         * Hacia fuera, cualquier fallo es indistinguible: decir "ese correo no
         * existe" permitiría enumerar cuentas. Hacia dentro se registra el
         * motivo real en la consola del servidor, que es donde el equipo puede
         * verlo, porque un único mensaje genérico hace imposible distinguir una
         * clave mal tecleada de una cuenta desactivada o de un 2FA pendiente.
         */
        const rechazar = (motivo: string) => {
          console.warn(`[login] rechazado (${email || "sin correo"}): ${motivo}`);
          return null;
        };

        // Login con passkey: la verificación criptográfica ya ocurrió en
        // confirmarLoginPasskey (src/app/panel/login/actions.ts); este token
        // firmado y de 60 s solo confirma que fue ESTA petición la que pasó
        // por ahí, sin repetir contraseña ni TOTP.
        if (passkeyToken) {
          const uid = verificarTokenPasskey(passkeyToken);
          if (!uid) return rechazar("token de passkey inválido o caducado");
          const [u] = await db.select().from(users).where(eq(users.id, uid)).limit(1);
          if (!u) return rechazar("passkey de una cuenta que ya no existe");
          if (!u.active) return rechazar("la cuenta está desactivada");
          return { id: u.id, name: u.name, email: u.email, role: u.role };
        }

        if (!email || !password) return rechazar("faltan correo o contraseña");

        // Frenos contra la fuerza bruta: 5 intentos por cuenta y 20 por IP
        // cada 15 minutos. Se cuentan ANTES de comprobar la clave, así que
        // tampoco sirven para adivinar qué correos existen.
        const ip = request?.headers ? clientIp(request.headers) : "0.0.0.0";
        const [porIp, porCuenta] = await Promise.all([
          hit(`login:ip:${ip}`, 20, 15 * 60),
          hit(`login:email:${email}`, 5, 15 * 60),
        ]);
        if (!porIp.allowed || !porCuenta.allowed) {
          return rechazar(`demasiados intentos (ip ${ip}); bloqueado ${Math.max(porIp.retryAfter, porCuenta.retryAfter)} s`);
        }
        if (!(await verifyHuman(String(creds?.captcha ?? ""), ip))) {
          return rechazar("verificación humana (Turnstile) fallida");
        }

        const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!u) return rechazar("no hay ninguna cuenta con ese correo");
        if (!u.active) return rechazar("la cuenta está desactivada");
        if (!u.passwordHash) return rechazar("la cuenta no tiene contraseña definida");

        const ok = await bcrypt.compare(password, u.passwordHash);
        if (!ok) return rechazar("contraseña incorrecta");

        // Segundo factor obligatorio si está habilitado para la cuenta.
        if (u.totpEnabled) {
          if (!u.totpSecret) return rechazar("2FA activado pero sin secreto guardado");
          if (!totp) return rechazar("falta el código de verificación (2FA)");
          if (!verifyTotp({ token: totp, secret: u.totpSecret }).valid) {
            return rechazar("código de verificación incorrecto");
          }
        }

        await clearHits(`login:email:${email}`);
        return { id: u.id, name: u.name, email: u.email, role: u.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as { role: UserRole }).role;
      }
      return token;
    },
    // Nombre/correo/rol se leen de la BD en cada petición, no del JWT: el
    // JWT solo se refresca al iniciar sesión, así que sin esto un cambio en
    // "Mis datos" dejaba el header con el nombre viejo hasta un re-login.
    async session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.role = token.role as UserRole;
      const [row] = await db
        .select({ name: users.name, email: users.email, role: users.role })
        .from(users)
        .where(eq(users.id, token.uid as string))
        .limit(1);
      if (row) {
        session.user.name = row.name;
        session.user.email = row.email;
        session.user.role = row.role;
      }
      return session;
    },
  },
});

// --- Autorización por rol ------------------------------------------------

const ROLE_RANK: Record<UserRole, number> = {
  redactor: 1,
  editor: 2,
  administrador: 3,
};

export async function requireRole(min: UserRole) {
  const session = await auth();
  if (!session?.user) redirect("/panel/login");
  if (ROLE_RANK[session.user.role] < ROLE_RANK[min]) throw new Error("SIN_PERMISO");

  // La sesión JWT sobrevive a la cuenta: en local la BD se recrea en cada
  // arranque y los ids cambian, aunque el correo siga siendo el mismo. Se
  // valida por id y, si no aparece, se reconcilia por correo (estable) para
  // no echar al editor de una sesión que sigue siendo legítima.
  const [byId] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (byId) return session.user;

  const email = session.user.email?.toLowerCase().trim();
  if (email) {
    const [byEmail] = await db
      .select({ id: users.id, role: users.role, active: users.active })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (byEmail?.active && ROLE_RANK[byEmail.role] >= ROLE_RANK[min]) {
      return { ...session.user, id: byEmail.id, role: byEmail.role };
    }
  }

  // La cuenta ya no existe: login limpio en vez de una excepción en mitad de
  // una Server Action.
  redirect("/panel/login");
}

/**
 * Como `requireRole`, pero por permiso: el rol da los de base y el
 * administrador puede ajustarlos por persona (ver src/lib/permisos.ts). Se usa
 * en cada pantalla y acción de un área, en vez de un rol mínimo fijo.
 */
export async function requirePermiso(id: PermisoId) {
  const user = await requireRole("redactor");
  if (!(await tienePermiso(user.id, user.role, id))) throw new Error("SIN_PERMISO");
  return user;
}

export function canPublish(role: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.editor;
}
