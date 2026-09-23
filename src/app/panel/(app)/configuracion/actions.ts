"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings, users, type UserRole } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { SITE_IDENTITY_KEY, type SiteIdentity } from "@/lib/site-identity";
import { SECRETS_KEY } from "@/lib/ai-provider";
import { ANALYTICS_KEY, GA4_ID_RE, type AnalyticsSettings } from "@/lib/analytics";
import { readAnalytics } from "@/lib/analytics-server";
import {
  AI_PROVIDERS,
  providerMeta,
  type AiProviderId,
  type AiSettings,
} from "@/lib/ai-providers";
import { verifyApiKey } from "@/lib/ai-verify";
import { encryptSecret } from "@/lib/secrets";

/** Guarda la identidad del sitio y refresca TODO el portal, que la consume. */
export async function saveSiteIdentity(formData: FormData) {
  await requireRole("administrador");

  const identity: SiteIdentity = {
    name: String(formData.get("name") ?? "").trim(),
    tagline: String(formData.get("tagline") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    domain: String(formData.get("domain") ?? "").trim().replace(/^https?:\/\//, ""),
  };
  if (!identity.name) throw new Error("El nombre del sitio no puede quedar vacío.");

  await db
    .insert(siteSettings)
    .values({ key: SITE_IDENTITY_KEY, value: identity })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value: identity, updatedAt: sql`now()` },
    });

  // El nombre y el lema salen en cabecera, pie y metadatos de todas las rutas.
  revalidatePath("/", "layout");
  revalidatePath("/panel/configuracion");
}

/**
 * Cambia el rol de un usuario. Solo administradores y nunca sobre uno mismo:
 * quitarse el propio rol dejaría el panel sin administrador si es el único.
 */
export async function changeUserRole(userId: string, role: UserRole) {
  const me = await requireRole("administrador");
  if (me.id === userId) throw new Error("No puedes cambiar tu propio rol.");

  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
  revalidatePath("/panel/configuracion");
}

/** Activa o desactiva el acceso de un usuario (no borra su historial). */
export async function toggleUserActive(userId: string, active: boolean) {
  const me = await requireRole("administrador");
  if (me.id === userId) throw new Error("No puedes desactivar tu propia cuenta.");

  await db.update(users).set({ active, updatedAt: new Date() }).where(eq(users.id, userId));
  revalidatePath("/panel/configuracion");
}


/**
 * Guarda proveedor, modelo y —si se envía— la clave, CIFRADA
 * (AES-256-GCM, ver `src/lib/secrets.ts`). La clave no vuelve nunca al
 * navegador: la pantalla solo muestra una máscara.
 *
 * Las claves de cada proveedor se conservan por separado, así cambiar de
 * Claude a Gemini y volver no obliga a reintroducirlas.
 */
export async function saveAiSettings(formData: FormData) {
  await requireRole("administrador");

  const provider = String(formData.get("provider") ?? "anthropic") as AiProviderId;
  if (!AI_PROVIDERS.some((p) => p.id === provider)) {
    throw new Error("Proveedor no reconocido.");
  }
  const meta = providerMeta(provider);
  const model = String(formData.get("model") ?? "").trim();
  const raw = String(formData.get("apiKey") ?? "").trim();

  const [row] = await db
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, SECRETS_KEY))
    .limit(1);
  const current = (row?.value as Partial<AiSettings> | undefined) ?? {};
  const keys = { ...(current.keys ?? {}) };
  const models = { ...(current.models ?? {}) };

  if (raw) {
    // Se pregunta al proveedor en vez de adivinar por el prefijo: Google emite
    // varios formatos de clave y rechazar por forma bloquea claves válidas.
    if (/\s/.test(raw) || raw.length < 20) {
      throw new Error("La clave parece incompleta o trae espacios al pegarla.");
    }
    const check = await verifyApiKey(provider, raw);
    if (!check.ok) throw new Error(check.error);

    keys[provider] = encryptSecret(raw);
    // Se guarda el catálogo real de la cuenta para ofrecerlo como desplegable:
    // los nombres de modelo caducan y adivinarlos rompe la generación.
    if (check.models.length > 0) models[provider] = check.models;
  }

  const catalogo = models[provider] ?? [];
  const modeloFinal = model || catalogo[0] || meta.defaultModel;
  if (!modeloFinal) {
    throw new Error("Elige un modelo. Guarda primero la clave para ver los disponibles.");
  }
  if (catalogo.length > 0 && !catalogo.includes(modeloFinal)) {
    throw new Error(
      `${meta.label} no ofrece «${modeloFinal}». Disponibles, por ejemplo: ${catalogo.slice(0, 4).join(", ")}.`,
    );
  }

  const value: AiSettings = { provider, model: modeloFinal, keys, models };
  await db
    .insert(siteSettings)
    .values({ key: SECRETS_KEY, value })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: sql`now()` } });

  revalidatePath("/panel/configuracion");
}

/** Borra la clave guardada del proveedor activo (la del entorno no se toca). */
export async function deleteApiKey(provider: AiProviderId) {
  await requireRole("administrador");

  const [row] = await db
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, SECRETS_KEY))
    .limit(1);
  const current = (row?.value as Partial<AiSettings> | undefined) ?? {};
  const keys = { ...(current.keys ?? {}) };
  delete keys[provider];

  const value: AiSettings = {
    provider: current.provider ?? "anthropic",
    model: current.model ?? providerMeta(provider).defaultModel,
    keys,
  };
  await db
    .insert(siteSettings)
    .values({ key: SECRETS_KEY, value })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: sql`now()` } });

  revalidatePath("/panel/configuracion");
}

/**
 * Analítica y SEO: identificador de GA4 (público, va en el HTML del portal) y
 * clave de PageSpeed Insights (se guarda cifrada, como la del modelo).
 *
 * La clave nueva se comprueba contra la API antes de guardarla: una clave que
 * Google rechaza no debe quedarse en la base de datos.
 */
export async function saveAnalyticsSettings(formData: FormData) {
  await requireRole("administrador");

  const ga4Id = String(formData.get("ga4Id") ?? "").trim();
  if (ga4Id && !GA4_ID_RE.test(ga4Id)) {
    throw new Error("El identificador de GA4 tiene la forma G-XXXXXXXXXX.");
  }

  const publicBaseUrl = String(formData.get("publicBaseUrl") ?? "")
    .trim()
    .replace(/\/$/, "");
  if (publicBaseUrl && !/^https?:\/\//.test(publicBaseUrl)) {
    throw new Error("La base pública debe empezar por http:// o https://");
  }

  const actual = await readAnalytics();
  const nueva = String(formData.get("psiKey") ?? "").trim();

  let psiKey = actual.psiKey;
  if (nueva) {
    const res = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Fexample.com&category=seo&key=${encodeURIComponent(nueva)}`,
      { cache: "no-store" },
    );
    if (res.status === 400 || res.status === 403) {
      const detalle = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      throw new Error(
        detalle?.error?.message
          ? `Google rechazó la clave: ${detalle.error.message.slice(0, 200)}`
          : "Google rechazó la clave de PageSpeed Insights.",
      );
    }
    psiKey = encryptSecret(nueva);
  }

  const value: AnalyticsSettings = { ga4Id, psiKey, publicBaseUrl };
  await db
    .insert(siteSettings)
    .values({ key: ANALYTICS_KEY, value })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: sql`now()` } });

  // El script de GA4 se inyecta en el layout público.
  revalidatePath("/", "layout");
  revalidatePath("/panel/configuracion");
}

/** Borra la clave de PageSpeed guardada en el panel (no toca el entorno). */
export async function deletePsiKey() {
  await requireRole("administrador");
  const actual = await readAnalytics();
  const value: AnalyticsSettings = { ...actual, psiKey: null };
  await db
    .insert(siteSettings)
    .values({ key: ANALYTICS_KEY, value })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: sql`now()` } });
  revalidatePath("/panel/configuracion");
}
