import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { decryptSecret, maskSecret } from "@/lib/secrets";
import { DEFAULT_NEWSLETTER_SETTINGS, sanitizeNewsletterSettings, type NewsletterSettings } from "@/lib/newsletter/types";
import type { CredencialesGmail } from "@/lib/newsletter/gmail";

// Clave de site_settings con los ajustes del boletín.
export const NEWSLETTER_KEY = "newsletter_settings";
/** Clave de API del proveedor, cifrada (AES-256-GCM, ver src/lib/secrets.ts). */
export const NEWSLETTER_SECRET_KEY = "newsletter_secret";

// Lee los ajustes del boletín (una consulta por petición); si falla, usa los valores por defecto.
export const getNewsletterSettings = cache(async (): Promise<NewsletterSettings> => {
  try {
    const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, NEWSLETTER_KEY)).limit(1);
    return row ? sanitizeNewsletterSettings(row.value) : DEFAULT_NEWSLETTER_SETTINGS;
  } catch {
    return DEFAULT_NEWSLETTER_SETTINGS;
  }
});

/** Estado del proveedor de correo (Resend o Gmail): entorno primero, panel después. */
export type ProviderStatus = {
  configured: boolean;
  source: "entorno" | "panel" | "prueba" | null;
  masked: string | null;
  /** Solo en desarrollo, sin clave: se simula el envío y no sale ningún correo. */
  dryRun: boolean;
  /** Con qué se envía: Resend si tiene clave; si no, Gmail (Google Cloud) si tiene sus tres datos. */
  tipo: "resend" | "gmail" | null;
  /** Estado de Gmail por separado, para su sección del panel. */
  gmail: { configured: boolean; source: "entorno" | "panel" | null; clientId: string | null };
};

// Secretos guardados en el panel (cifrados): la clave de Resend y las credenciales de Gmail.
async function secretosPanel(): Promise<{ resend?: string; gmail?: string }> {
  try {
    const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, NEWSLETTER_SECRET_KEY)).limit(1);
    return (row?.value as { resend?: string; gmail?: string } | undefined) ?? {};
  } catch {
    return {};
  }
}

/** Credenciales de Gmail: las del entorno (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN) mandan sobre las del panel. */
export async function resolveGmail(): Promise<{ cred: CredencialesGmail | null; source: "entorno" | "panel" | null }> {
  const env = { clientId: process.env.GMAIL_CLIENT_ID?.trim() ?? "", clientSecret: process.env.GMAIL_CLIENT_SECRET?.trim() ?? "", refreshToken: process.env.GMAIL_REFRESH_TOKEN?.trim() ?? "" };
  if (env.clientId && env.clientSecret && env.refreshToken) return { cred: env, source: "entorno" };
  const enc = (await secretosPanel()).gmail;
  const plain = enc ? decryptSecret(enc) : null;
  if (!plain) return { cred: null, source: null };
  try {
    const c = JSON.parse(plain) as CredencialesGmail;
    return c.clientId && c.clientSecret && c.refreshToken ? { cred: c, source: "panel" } : { cred: null, source: null };
  } catch {
    return { cred: null, source: null };
  }
}

// Clave de Resend: la del entorno manda sobre la guardada en el panel; indica de dónde sale.
export async function resolveResendKey(): Promise<{ key: string | null; source: "entorno" | "panel" | null }> {
  const fromEnv = process.env.RESEND_API_KEY?.trim();
  if (fromEnv) return { key: fromEnv, source: "entorno" };
  const enc = (await secretosPanel()).resend;
  const plain = enc ? decryptSecret(enc) : null;
  return plain ? { key: plain, source: "panel" } : { key: null, source: null };
}

// Estado del proveedor de correo para el panel: si hay clave, de dónde sale (enmascarada) o si los envíos son simulados.
export async function getProviderStatus(): Promise<ProviderStatus> {
  const [{ key, source }, g] = await Promise.all([resolveResendKey(), resolveGmail()]);
  const gmail = { configured: Boolean(g.cred), source: g.source, clientId: g.cred ? g.cred.clientId.replace(/^(\d{4})\d*/, "$1…") : null };
  if (key) return { configured: true, source, masked: maskSecret(key), dryRun: false, tipo: "resend", gmail };
  if (g.cred) return { configured: true, source: g.source, masked: null, dryRun: false, tipo: "gmail", gmail };
  const dryRun = process.env.NODE_ENV === "development";
  return { configured: dryRun, source: dryRun ? "prueba" : null, masked: null, dryRun, tipo: null, gmail };
}
