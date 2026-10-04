import "server-only";
import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import type { NewsItem } from "@/lib/ai-core";
import type { Material } from "@/lib/material-types";

/**
 * Vínculos Telegram ↔ cuenta del panel, códigos de vinculación y estado de cada conversación. Todo en
 * `site_settings` (sin migración): `tg_links`, `tg_codes` y `tg_state_<chat>`.
 */
const LINKS = "tg_links";
const CODES = "tg_codes";
const estadoKey = (chat: number | string) => `tg_state_${chat}`;

async function leer<T>(key: string, vacio: T): Promise<T> {
  try {
    const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
    return (row?.value as T) ?? vacio;
  } catch {
    return vacio;
  }
}
async function escribir(key: string, value: unknown) {
  await db.insert(siteSettings).values({ key, value: value as never }).onConflictDoUpdate({ target: siteSettings.key, set: { value: value as never, updatedAt: new Date() } });
}

export type Vinculo = { userId: string; nombre: string; desde: string };
export const getVinculos = () => leer<Record<string, Vinculo>>(LINKS, {});

export async function vinculoDe(chatId: number | string): Promise<Vinculo | null> {
  return (await getVinculos())[String(chatId)] ?? null;
}

/** Código de 6 caracteres, válido 10 minutos, para vincular el Telegram de ESTA persona del panel. */
export async function crearCodigo(userId: string): Promise<string> {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const codigo = Array.from({ length: 6 }, () => alfabeto[randomInt(alfabeto.length)]).join("");
  const codes = await leer<Record<string, { userId: string; exp: number }>>(CODES, {});
  const ahora = Date.now();
  for (const [k, v] of Object.entries(codes)) if (v.exp < ahora) delete codes[k];
  codes[codigo] = { userId, exp: ahora + 10 * 60_000 };
  await escribir(CODES, codes);
  return codigo;
}

/** Consume un código y guarda el vínculo. Devuelve el userId o null si no existe / venció. */
export async function vincularConCodigo(codigo: string, chatId: number | string, nombre: string): Promise<string | null> {
  const codes = await leer<Record<string, { userId: string; exp: number }>>(CODES, {});
  const c = codes[codigo.toUpperCase().trim()];
  if (!c || c.exp < Date.now()) return null;
  delete codes[codigo.toUpperCase().trim()];
  await escribir(CODES, codes);
  const links = await getVinculos();
  links[String(chatId)] = { userId: c.userId, nombre, desde: new Date().toISOString() };
  await escribir(LINKS, links);
  return c.userId;
}

export async function desvincular(chatId: number | string) {
  const links = await getVinculos();
  delete links[String(chatId)];
  await escribir(LINKS, links);
  await escribir(estadoKey(chatId), {});
}

/** Paso del recorrido (mismos nombres que el asistente web). «tema» es el primer paso del modo IA; «titulo», el del modo manual. */
export type Fase = "idle" | "tema" | "titulo" | "resumen" | "claves" | "portada" | "seccion" | "cuerpo" | "grafica" | "seo" | "final";

/** Dato que se espera como PRÓXIMO mensaje de texto (lo pide un botón); si no hay, el texto se interpreta según el paso. */
export type Espera =
  | "titulo" | "contexto" | "resumen" | "claves" | "cuerpo" | "metaTitle" | "metaDescription" | "alt" | "escena"
  | "graficaTema" | "correccion" | "fecha" | "enfoque" | "busqueda";

export type EstadoChat = {
  fase: Fase;
  /** Último update procesado: Telegram reintenta si tardamos y no hay que repetir nada. */
  ultimoUpdate?: number;
  /** «ia» (por defecto) o «manual», como en «Cambiar modo» del asistente web. */
  modo?: "ia" | "manual";
  espera?: Espera;
  /** Mensaje «panel» del chat: se reescribe en vez de enviar uno nuevo en cada paso, para que la conversación no se llene. */
  panel?: number;
  /** Contexto elegido en las opciones del primer paso (índice; -1 = sin enfoque especial). */
  ctxSel?: number;
  /** Pregunta en curso dentro del primer paso: primero el título, luego el enfoque. */
  etapa?: "titulo" | "enfoque";
  topic?: string;
  ideasFocus?: string;
  ideas?: { title: string; angle: string; why: string; scope: string }[];
  ideasFuentes?: { title: string; url: string }[];
  noticias?: NewsItem[];
  /** Mensajes de tarjetas de resultados (se borran al salir de los resultados). */
  tarjetas?: number[];
  noticiasFiltro?: "todo" | "noticia" | "video" | "oficial";
  /** Noticias elegidas para referenciar: van enlazadas al final de la nota (los videos, incrustados). */
  refs?: { title: string; outlet: string; url: string; videoId?: string }[];
  material?: Material[];
  /** Índice del material cuyo texto se está corrigiendo. */
  editIdx?: number;
  options?: { titles: string[]; contexts: { label: string; text: string }[] };
  enOpciones?: boolean;
  generated?: boolean;
  title?: string;
  context?: string;
  articleId?: string;
  excerpt?: string;
  tags?: string[];
  body?: string;
  metaTitle?: string;
  metaDescription?: string;
  categoryId?: string;
  coverUrl?: string;
  coverAlt?: string;
  sceneTxt?: string;
  chartTopic?: string;
  tipoGrafica?: string;
  chartInsertada?: boolean;
  chart?: { spec: unknown; sourceNote: string; sources: { title: string; url: string }[]; pngUrl?: string };
  /** Rama de secciones que se está mostrando (id de la sección principal). */
  ramaSeccion?: string;
};

export const getEstado = (chatId: number | string) => leer<EstadoChat>(estadoKey(chatId), { fase: "idle" });
export const setEstado = (chatId: number | string, e: EstadoChat) => escribir(estadoKey(chatId), e);
