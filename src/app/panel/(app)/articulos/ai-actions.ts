"use server";

/**
 * Acciones del asistente de redacción llamadas desde el panel (con sesión). La lógica vive en `@/lib/ai-core`
 * para poder usarla también desde el bot de Telegram, que no tiene sesión de navegador.
 */
import { requirePermiso } from "@/lib/auth";
import {
  generateArticleDraftCore,
  regenerateDraftPartCore,
  suggestTitlesAndContextsCore,
  generateChartCore,
  suggestTopicIdeasCore,
  searchNewsAboutCore,
  generateCoverImageCore,
  transcribirEntrevistaCore,
  crearSubidaAudioCore,
  transcribirEntrevistaSubidaCore,
  leerEnlacesCore,
} from "@/lib/ai-core";
export type {
  GeneratedDraft,
  GenerateResult,
  DraftPart,
  RegenerateResult,
  TitleContextOptions,
  SuggestResult,
  ChartResult,
  TopicIdea,
  TopicIdeasResult,
  NewsItem,
  NewsSearchResult,
  CoverImageResult,
  MaterialResult,
  EnlacesResult,
} from "@/lib/ai-core";

export async function generateArticleDraft(...args: Parameters<typeof generateArticleDraftCore> extends [string, ...infer R] ? R : never) {
  const user = await requirePermiso("articulos");
  return generateArticleDraftCore(user.id, ...args);
}

export async function regenerateDraftPart(...args: Parameters<typeof regenerateDraftPartCore> extends [string, ...infer R] ? R : never) {
  const user = await requirePermiso("articulos");
  return regenerateDraftPartCore(user.id, ...args);
}

export async function suggestTitlesAndContexts(...args: Parameters<typeof suggestTitlesAndContextsCore> extends [string, ...infer R] ? R : never) {
  const user = await requirePermiso("articulos");
  return suggestTitlesAndContextsCore(user.id, ...args);
}

export async function generateChart(...args: Parameters<typeof generateChartCore> extends [string, ...infer R] ? R : never) {
  const user = await requirePermiso("articulos");
  return generateChartCore(user.id, ...args);
}

export async function suggestTopicIdeas(...args: Parameters<typeof suggestTopicIdeasCore> extends [string, ...infer R] ? R : never) {
  const user = await requirePermiso("articulos");
  return suggestTopicIdeasCore(user.id, ...args);
}

export async function searchNewsAbout(...args: Parameters<typeof searchNewsAboutCore> extends [string, ...infer R] ? R : never) {
  const user = await requirePermiso("articulos");
  return searchNewsAboutCore(user.id, ...args);
}

export async function generateCoverImage(...args: Parameters<typeof generateCoverImageCore> extends [string, ...infer R] ? R : never) {
  const user = await requirePermiso("articulos");
  return generateCoverImageCore(user.id, ...args);
}

export async function transcribirEntrevista(...args: Parameters<typeof transcribirEntrevistaCore> extends [string, ...infer R] ? R : never) {
  const user = await requirePermiso("articulos");
  return transcribirEntrevistaCore(user.id, ...args);
}

export async function crearSubidaAudio(...args: Parameters<typeof crearSubidaAudioCore> extends [string, ...infer R] ? R : never) {
  const user = await requirePermiso("articulos");
  return crearSubidaAudioCore(user.id, ...args);
}

export async function transcribirEntrevistaSubida(...args: Parameters<typeof transcribirEntrevistaSubidaCore> extends [string, ...infer R] ? R : never) {
  const user = await requirePermiso("articulos");
  return transcribirEntrevistaSubidaCore(user.id, ...args);
}

export async function leerEnlaces(...args: Parameters<typeof leerEnlacesCore> extends [string, ...infer R] ? R : never) {
  const user = await requirePermiso("articulos");
  return leerEnlacesCore(user.id, ...args);
}

