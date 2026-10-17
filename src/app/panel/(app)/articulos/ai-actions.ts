"use server";

/**
 * Acciones del asistente de redacción llamadas desde el panel (con sesión). La lógica vive en `@/lib/ai-core`
 * para poder usarla también desde el bot de Telegram, que no tiene sesión de navegador.
 */
import { requirePermiso } from "@/lib/auth";
import { autollenarPreguntasCore } from "@/lib/ai/consejo-ia";
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
  buscarRelacionadasCore,
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
  RelacionadasResult,
} from "@/lib/ai-core";
export type { NotaRelacionada } from "@/lib/ai/relacionadas-html";

// Redacta un borrador con IA. Exige el permiso «articulos» y delega en la función núcleo, que descuenta la cuota de IA.
export async function generateArticleDraft(...args: Parameters<typeof generateArticleDraftCore> extends [string, ...infer R] ? R : never) {
  const user = await requirePermiso("articulos");
  return generateArticleDraftCore(user.id, ...args);
}

// Regenera una parte del borrador. Exige el permiso «articulos» y delega en la función núcleo, que descuenta la cuota de IA.
export async function regenerateDraftPart(...args: Parameters<typeof regenerateDraftPartCore> extends [string, ...infer R] ? R : never) {
  const user = await requirePermiso("articulos");
  return regenerateDraftPartCore(user.id, ...args);
}

// Propone títulos y enfoques. Exige el permiso «articulos» y delega en la función núcleo, que descuenta la cuota de IA.
export async function suggestTitlesAndContexts(...args: Parameters<typeof suggestTitlesAndContextsCore> extends [string, ...infer R] ? R : never) {
  const user = await requirePermiso("articulos");
  return suggestTitlesAndContextsCore(user.id, ...args);
}

// Genera una gráfica con datos de la web. Exige el permiso «articulos» y delega en la función núcleo, que descuenta la cuota de IA.
export async function generateChart(...args: Parameters<typeof generateChartCore> extends [string, ...infer R] ? R : never) {
  const user = await requirePermiso("articulos");
  return generateChartCore(user.id, ...args);
}

// Aconseja temas de nota. Exige el permiso «articulos» y delega en la función núcleo, que descuenta la cuota de IA.
export async function suggestTopicIdeas(...args: Parameters<typeof suggestTopicIdeasCore> extends [string, ...infer R] ? R : never) {
  const user = await requirePermiso("articulos");
  return suggestTopicIdeasCore(user.id, ...args);
}

// La IA contesta las preguntas previas de un tema (para quién, palabras, géneros, alcance, tono, fuentes y qué evitar) a partir de su descripción.
export async function autollenarPreguntas(input: { tema: string; seccion?: string }) {
  const user = await requirePermiso("articulos");
  if (input.tema.trim().length < 4) return { ok: false as const, error: "Describe primero el tema." };
  return autollenarPreguntasCore(user.id, { tema: input.tema, seccion: input.seccion ?? "General" });
}

// Busca noticias sobre un tema. Exige el permiso «articulos» y delega en la función núcleo, que descuenta la cuota de IA.
export async function searchNewsAbout(...args: Parameters<typeof searchNewsAboutCore> extends [string, ...infer R] ? R : never) {
  const user = await requirePermiso("articulos");
  return searchNewsAboutCore(user.id, ...args);
}

// Genera la imagen de portada. Exige el permiso «articulos» y delega en la función núcleo, que descuenta la cuota de IA.
export async function generateCoverImage(...args: Parameters<typeof generateCoverImageCore> extends [string, ...infer R] ? R : never) {
  const user = await requirePermiso("articulos");
  return generateCoverImageCore(user.id, ...args);
}

// Transcribe una entrevista enviada como archivo. Exige el permiso «articulos» y delega en la función núcleo, que descuenta la cuota de IA.
export async function transcribirEntrevista(...args: Parameters<typeof transcribirEntrevistaCore> extends [string, ...infer R] ? R : never) {
  const user = await requirePermiso("articulos");
  return transcribirEntrevistaCore(user.id, ...args);
}

// Prepara una subida firmada de audio a Storage. Exige el permiso «articulos» y delega en la función núcleo, que descuenta la cuota de IA.
export async function crearSubidaAudio(...args: Parameters<typeof crearSubidaAudioCore> extends [string, ...infer R] ? R : never) {
  const user = await requirePermiso("articulos");
  return crearSubidaAudioCore(user.id, ...args);
}

// Transcribe una entrevista ya subida a Storage. Exige el permiso «articulos» y delega en la función núcleo, que descuenta la cuota de IA.
export async function transcribirEntrevistaSubida(...args: Parameters<typeof transcribirEntrevistaSubidaCore> extends [string, ...infer R] ? R : never) {
  const user = await requirePermiso("articulos");
  return transcribirEntrevistaSubidaCore(user.id, ...args);
}

// Lee enlaces para usarlos como material. Exige el permiso «articulos» y delega en la función núcleo, que descuenta la cuota de IA.
export async function leerEnlaces(...args: Parameters<typeof leerEnlacesCore> extends [string, ...infer R] ? R : never) {
  const user = await requirePermiso("articulos");
  return leerEnlacesCore(user.id, ...args);
}

// Busca, solo entre las notas de CONtexto Ganadero, las que tratan lo mismo que la nota que se escribe. Exige el permiso «articulos».
export async function buscarRelacionadas(...args: Parameters<typeof buscarRelacionadasCore> extends [string, ...infer R] ? R : never) {
  const user = await requirePermiso("articulos");
  return buscarRelacionadasCore(user.id, ...args);
}
