import "server-only";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { verifySync as verifyTotp } from "otplib";
import { db } from "@/db";
import { users, type UserRole } from "@/db/schema";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: UserRole } & DefaultSession["user"];
  }
  interface User {
    role: UserRole;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/panel/login" },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
        totp: {}, // código de 6 dígitos del segundo factor
      },
      async authorize(creds) {
        const email = String(creds?.email ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        const totp = String(creds?.totp ?? "").trim();
        if (!email || !password) return null;

        const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!u || !u.active || !u.passwordHash) return null;

        const ok = await bcrypt.compare(password, u.passwordHash);
        if (!ok) return null;

        // Segundo factor obligatorio si está habilitado para la cuenta.
        if (u.totpEnabled) {
          if (!u.totpSecret || !totp) return null;
          const valid = verifyTotp({ token: totp, secret: u.totpSecret }).valid;
          if (!valid) return null;
        }

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
    session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.role = token.role as UserRole;
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
  if (!session?.user) throw new Error("NO_AUTENTICADO");
  if (ROLE_RANK[session.user.role] < ROLE_RANK[min]) throw new Error("SIN_PERMISO");
  return session.user;
}

export function canPublish(role: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.editor;
}
