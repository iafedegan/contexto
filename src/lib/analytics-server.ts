import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { decryptSecret, maskSecret } from "@/lib/secrets";
import {
  ANALYTICS_KEY,
  DEFAULT_ANALYTICS,
  type AnalyticsSettings,
  type AnalyticsStatus,
} from "@/lib/analytics";

export const readAnalytics = cache(async (): Promise<AnalyticsSettings> => {
  try {
    const [row] = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, ANALYTICS_KEY))
      .limit(1);
    return { ...DEFAULT_ANALYTICS, ...((row?.value as Partial<AnalyticsSettings>) ?? {}) };
  } catch {
    return DEFAULT_ANALYTICS;
  }
});

/** Identificador GA4 efectivo: el entorno manda sobre lo guardado en el panel. */
export async function getGa4Id(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_GA4_ID;
  if (env) return env;
  return (await readAnalytics()).ga4Id;
}

/** Clave de PageSpeed efectiva, en claro. Solo para llamadas desde el servidor. */
export async function getPsiKey(): Promise<{ key: string | null; source: "entorno" | "panel" | null }> {
  const env = process.env.PAGESPEED_API_KEY;
  if (env) return { key: env, source: "entorno" };
  const stored = (await readAnalytics()).psiKey;
  const plain = stored ? decryptSecret(stored) : null;
  return plain ? { key: plain, source: "panel" } : { key: null, source: null };
}

/** Contenedor de GTM efectivo: el entorno manda sobre el panel. */
export async function getGtmId(): Promise<string> {
  return process.env.NEXT_PUBLIC_GTM_ID ?? (await readAnalytics()).gtmId;
}

/** Código de verificación de Search Console, para la etiqueta meta. */
export async function getSearchConsoleToken(): Promise<string> {
  return (await readAnalytics()).searchConsoleToken;
}

export async function getAnalyticsStatus(): Promise<AnalyticsStatus> {
  const settings = await readAnalytics();
  const { key, source } = await getPsiKey();
  return {
    ga4Id: process.env.NEXT_PUBLIC_GA4_ID ?? settings.ga4Id,
    gtmId: process.env.NEXT_PUBLIC_GTM_ID ?? settings.gtmId,
    searchConsoleToken: settings.searchConsoleToken,
    publicBaseUrl: settings.publicBaseUrl,
    psiPresent: Boolean(key),
    psiSource: source,
    psiMasked: key ? maskSecret(key) : null,
  };
}
