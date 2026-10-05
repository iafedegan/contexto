import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { decryptSecret, maskSecret } from "@/lib/secrets";
import { DEFAULT_NEWSLETTER_SETTINGS, sanitizeNewsletterSettings, type NewsletterSettings } from "@/lib/newsletter/types";

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

/** Estado del proveedor de correo (Resend): entorno primero, panel después. */
export type ProviderStatus = {
  configured: boolean;
  source: "entorno" | "panel" | "prueba" | null;
  masked: string | null;
  /** Solo en desarrollo, sin clave: se simula el envío y no sale ningún correo. */
  dryRun: boolean;
};

// Clave de Resend: la del entorno manda sobre la guardada en el panel; indica de dónde sale.
export async function resolveResendKey(): Promise<{ key: string | null; source: "entorno" | "panel" | null }> {
  const fromEnv = process.env.RESEND_API_KEY?.trim();
  if (fromEnv) return { key: fromEnv, source: "entorno" };
  try {
    const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, NEWSLETTER_SECRET_KEY)).limit(1);
    const enc = (row?.value as { resend?: string } | undefined)?.resend;
    const plain = enc ? decryptSecret(enc) : null;
    return plain ? { key: plain, source: "panel" } : { key: null, source: null };
  } catch {
    return { key: null, source: null };
  }
}

// Estado del proveedor de correo para el panel: si hay clave, de dónde sale (enmascarada) o si los envíos son simulados.
export async function getProviderStatus(): Promise<ProviderStatus> {
  const { key, source } = await resolveResendKey();
  if (key) return { configured: true, source, masked: maskSecret(key), dryRun: false };
  const dryRun = process.env.NODE_ENV === "development";
  return { configured: dryRun, source: dryRun ? "prueba" : null, masked: null, dryRun };
}
