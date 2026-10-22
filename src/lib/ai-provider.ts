import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { wrapLanguageModel, type LanguageModelMiddleware } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { decryptSecret, maskSecret } from "@/lib/secrets";
import { registrarUsoModelo } from "@/lib/ai-uso";
import { getModeloFavorito } from "@/lib/ai-preferencia";
import {
  AI_PROVIDERS,
  DEFAULT_AI_SETTINGS,
  DEFAULT_IMAGE_MODEL,
  leerRef,
  listaEditor,
  modeloDe,
  providerMeta,
  type AiProviderId,
  type AiSettings,
  type RolIA,
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

// Lee los ajustes de IA guardados (proveedor, modelo y claves cifradas), una consulta por petición.
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

/** Clave efectiva de un proveedor: entorno primero, panel después. */
async function claveDe(
  settings: AiSettings,
  provider: AiProviderId,
): Promise<{ key: string | null; source: "entorno" | "panel" | null }> {
  const fromEnv = process.env[providerMeta(provider).envVar];
  if (fromEnv) return { key: fromEnv, source: "entorno" };

  const stored = settings.keys[provider];
  const plain = stored ? decryptSecret(stored) : null;
  return plain ? { key: plain, source: "panel" } : { key: null, source: null };
}

/** Clave efectiva de un proveedor (entorno o panel), solo para acciones de administración en el servidor. */
export async function claveEfectiva(provider: AiProviderId): Promise<string | null> {
  return (await claveDe(await readSettings(), provider)).key;
}

/** Clave efectiva del proveedor principal. */
const resolveKey = (settings: AiSettings) => claveDe(settings, settings.provider);

/** Nombre corto del proveedor para etiquetas («modelo · Gemini»). */
const NOMBRE_CORTO: Record<AiProviderId, string> = { google: "Gemini", anthropic: "Claude", openai: "ChatGPT" };

/** Anota los tokens reales de cada llamada al modelo (para la barra «Uso de IA»); no cambia nada de lo que el modelo responde. */
const medirUso = (ref: string): LanguageModelMiddleware => ({
  wrapGenerate: async ({ doGenerate }) => {
    const r = await doGenerate();
    await registrarUsoModelo(ref, r.usage.inputTokens.total ?? 0, r.usage.outputTokens.total ?? 0);
    return r;
  },
});

/** Crea el modelo de texto de «proveedor:modelo», o `null` si ese proveedor no tiene clave. */
async function crearModelo(settings: AiSettings, ref: string | null) {
  const r = leerRef(ref);
  if (!r) return null;
  const { key } = await claveDe(settings, r.provider);
  if (!key) return null;
  const modelo =
    r.provider === "google" ? createGoogleGenerativeAI({ apiKey: key })(r.model) : r.provider === "openai" ? createOpenAI({ apiKey: key })(r.model) : createAnthropic({ apiKey: key })(r.model);
  return wrapLanguageModel({ model: modelo, middleware: medirUso(`${r.provider}:${r.model}`) });
}

/**
 * El modelo de texto de una función: `editor` (con el que eligió quien crea la nota, si está habilitado), `asistente` (el agente de la vaca) o
 * `videoEntender` (leer videos). `null` si no hay clave del proveedor de ese modelo: quien llama decide qué hacer sin él.
 */
export async function getModelo(rol: "editor" | "asistente" | "busqueda" | "videoEntender", elegido?: string | null) {
  const settings = await readSettings();
  const principal = await crearModelo(settings, modeloDe(settings, rol, elegido));
  // Si el modelo propio de la función no tiene clave, se cae al principal en vez de dejar la función sin IA.
  // La búsqueda es una tarea corta y barata: sin su modelo no se cae a uno caro, simplemente no se expande la pregunta.
  return principal ?? (rol === "editor" || rol === "busqueda" ? null : await crearModelo(settings, modeloDe(settings, "editor")));
}

/**
 * Los modelos que se pueden elegir al crear una nota (solo los que tienen clave), el predeterminado del administrador y el que arranca marcado: el
 * favorito de esa persona si sigue habilitado y, si no, el predeterminado.
 */
export async function getModelosEditor(userId?: string): Promise<{ modelos: { ref: string; etiqueta: string }[]; predeterminado: string | null; inicial: string | null; sinClave: string[] }> {
  const settings = await readSettings();
  const { habilitados, predeterminado } = listaEditor(settings);
  const conClave: string[] = [];
  for (const ref of habilitados) {
    const r = leerRef(ref);
    if (r && (await claveDe(settings, r.provider)).key) conClave.push(ref);
  }
  const etiqueta = (ref: string) => {
    const r = leerRef(ref)!;
    return `${r.model} · ${NOMBRE_CORTO[r.provider]}`;
  };
  const pred = conClave.includes(predeterminado) ? predeterminado : (conClave[0] ?? null);
  const favorito = userId ? await getModeloFavorito(userId) : null;
  // Proveedores todavía sin clave: la tarjeta de la nota los muestra apagados para que se vea qué IAs hay y qué falta para usarlas.
  const sinClave: string[] = [];
  for (const p of AI_PROVIDERS) if (!(await claveDe(settings, p.id)).key) sinClave.push(p.label);
  return {
    sinClave,
    modelos: conClave.map((ref) => ({ ref, etiqueta: etiqueta(ref) })),
    predeterminado: pred,
    inicial: favorito && conClave.includes(favorito) ? favorito : pred,
  };
}

/**
 * Modelo listo para usar, o `null` si no hay clave. Quien llama decide qué
 * hacer sin ella (el asistente degrada a búsqueda; el editor entrega un
 * esqueleto) en vez de reventar. Es el modelo de los editores (el predeterminado
 * de su lista); `getModelo("asistente")` para el agente de la vaca.
 */
export async function getAiModel(elegido?: string | null) {
  return getModelo("editor", elegido);
}

/**
 * Gemini con búsqueda en Google (datos con fuentes citables). Solo existe con
 * el proveedor Google: Anthropic no tiene esa herramienta. `null` = no hay
 * clave; `"otro-proveedor"` = hay clave pero de otro proveedor.
 */
export async function getGroundedAi() {
  const settings = await readSettings();
  const { key } = await claveDe(settings, "google");
  if (!key) return (await resolveKey(settings)).key ? ("otro-proveedor" as const) : null;
  // Sin modelo propio para gráficas, se usa el principal si es Gemini; con otro proveedor principal no hay un modelo de Gemini elegido.
  const modelo = settings.chartModel || (settings.provider === "google" ? settings.model : "");
  if (!modelo) return "otro-proveedor" as const;
  const google = createGoogleGenerativeAI({ apiKey: key });
  return { model: google(modelo), tools: { google_search: google.tools.googleSearch({}) } };
}

/**
 * Modelo de imagen (Gemini «nano banana»). Solo con el proveedor Google: Anthropic no genera imágenes.
 * Sin `modelo` explícito usa el elegido en Configuración y, si no hay, `DEFAULT_IMAGE_MODEL`; el respaldo que pide
 * `generateCoverImage` pasa su propio nombre y no se ve afectado por la elección.
 * `null` = no hay clave; `"otro-proveedor"` = hay clave pero de otro proveedor.
 */
export async function getImageAi(modelo?: string) {
  const settings = await readSettings();
  const { key } = await claveDe(settings, "google");
  if (!key) return (await resolveKey(settings)).key ? ("otro-proveedor" as const) : null;
  const elegido = leerRef(modeloDe(settings, "imagen"))?.model ?? DEFAULT_IMAGE_MODEL;
  return createGoogleGenerativeAI({ apiKey: key }).image(modelo || elegido);
}

/** Todos los ajustes de IA para la pantalla de Configuración (sin revelar ninguna clave). */
export async function getConfigIA() {
  const settings = await readSettings();
  const proveedores = await Promise.all(
    AI_PROVIDERS.map(async (p) => {
      const { key, source } = await claveDe(settings, p.id);
      return {
        id: p.id,
        label: p.label,
        docs: p.docs,
        keyHint: p.keyHint,
        present: Boolean(key),
        source,
        masked: key ? maskSecret(key) : null,
        catalogo: settings.models?.[p.id] ?? [],
      };
    }),
  );
  const lista = listaEditor(settings);
  return {
    principal: `${settings.provider}:${settings.model}`,
    proveedores,
    editor: lista,
    asistente: modeloDe(settings, "asistente"),
    busqueda: modeloDe(settings, "busqueda"),
    imagen: modeloDe(settings, "imagen"),
    videoEntender: modeloDe(settings, "videoEntender"),
    videoGenerar: modeloDe(settings, "videoGenerar"),
    chartModel: settings.chartModel ?? "",
  };
}

export type ConfigIA = Awaited<ReturnType<typeof getConfigIA>>;
export type { RolIA };
