import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { decryptSecret, maskSecret } from "@/lib/secrets";
import {
  DEFAULT_AI_SETTINGS,
  providerMeta,
  type AiSettings,
  type KeyStatus,
} from "@/lib/ai-providers";

/**
 * Proveedor de modelo configurable desde /panel/configuracion.
 *
 * El medio no queda casado con un proveedor: se elige cuál usar y se guarda su
 * clave cifrada. El entorno tiene prioridad sobre el panel — en producción la
 * clave la pone quien despliega y no debe poder sustituirse desde una sesión.
 */
export const SECRETS_KEY = "secrets";

export {
  AI_PROVIDERS,
  DEFAULT_AI_SETTINGS,
  providerMeta,
  type AiProviderId,
  type AiSettings,
  type KeyStatus,
} from "@/lib/ai-providers";

const readSettings = cache(async (): Promise<AiSettings> => {
  try {
    const [row] = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, SECRETS_KEY))
      .limit(1);
    return { ...DEFAULT_AI_SETTINGS, ...((row?.value as Partial<AiSettings>) ?? {}) };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
});

/** Clave efectiva del proveedor activo: entorno primero, panel después. */
async function resolveKey(
  settings: AiSettings,
): Promise<{ key: string | null; source: "entorno" | "panel" | null }> {
  const fromEnv = process.env[providerMeta(settings.provider).envVar];
  if (fromEnv) return { key: fromEnv, source: "entorno" };

  const stored = settings.keys[settings.provider];
  const plain = stored ? decryptSecret(stored) : null;
  return plain ? { key: plain, source: "panel" } : { key: null, source: null };
}

/** Estado para la pantalla de configuración: nunca devuelve la clave entera. */
export async function getKeyStatus(): Promise<KeyStatus> {
  const settings = await readSettings();
  const { key, source } = await resolveKey(settings);
  return {
    provider: settings.provider,
    model: settings.model,
    chartModel: settings.chartModel ?? "",
    models: settings.models?.[settings.provider] ?? [],
    present: Boolean(key),
    source,
    masked: key ? maskSecret(key) : null,
  };
}

/**
 * Modelo listo para usar, o `null` si no hay clave. Quien llama decide qué
 * hacer sin ella (el asistente degrada a búsqueda; el editor entrega un
 * esqueleto) en vez de reventar.
 */
export async function getAiModel() {
  const settings = await readSettings();
  const { key } = await resolveKey(settings);
  if (!key) return null;

  return settings.provider === "google"
    ? createGoogleGenerativeAI({ apiKey: key })(settings.model)
    : createAnthropic({ apiKey: key })(settings.model);
}

/**
 * Gemini con búsqueda en Google (datos con fuentes citables). Solo existe con
 * el proveedor Google: Anthropic no tiene esa herramienta. `null` = no hay
 * clave; `"otro-proveedor"` = hay clave pero de otro proveedor.
 */
export async function getGroundedAi() {
  const settings = await readSettings();
  const { key } = await resolveKey(settings);
  if (!key) return null;
  if (settings.provider !== "google") return "otro-proveedor" as const;
  const google = createGoogleGenerativeAI({ apiKey: key });
  return { model: google(settings.chartModel || settings.model), tools: { google_search: google.tools.googleSearch({}) } };
}
