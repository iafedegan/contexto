import "server-only";
import { randomInt } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, rowsOf } from "@/db";
import { siteSettings } from "@/db/schema";
import type { NewsItem } from "@/lib/ai-core";
import type { Material } from "@/lib/material-types";

/**
 * Vínculos Telegram ↔ cuenta del panel, códigos de vinculación y estado de cada conversación. Todo en
 * `site_settings` (sin migración): `tg_links`, `tg_codes` y `tg_state_<chat>`.
 */
const LINKS = "tg_links";
// Clave de los códigos de vinculación pendientes.
const CODES = "tg_codes";
// Clave del estado de conversación de un chat.
const estadoKey = (chat: number | string) => `tg_state_${chat}`;

// Lee un valor de site_settings; devuelve el valor vacío si no existe o si falla.
async function leer<T>(key: string, vacio: T): Promise<T> {
  try {
    const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
    return (row?.value as T) ?? vacio;
  } catch {
    return vacio;
  }
}
// Guarda (o reemplaza) un valor en site_settings.
async function escribir(key: string, value: unknown) {
  await db.insert(siteSettings).values({ key, value: value as never }).onConflictDoUpdate({ target: siteSettings.key, set: { value: value as never, updatedAt: new Date() } });
}

// Vínculo entre un chat de Telegram y una cuenta del panel.
export type Vinculo = { userId: string; nombre: string; desde: string };
// Todos los vínculos, indexados por id de chat.
export const getVinculos = () => leer<Record<string, Vinculo>>(LINKS, {});

// Vínculo de un chat, o null si no está vinculado.
export async function vinculoDe(chatId: number | string): Promise<Vinculo | null> {
  return (await getVinculos())[String(chatId)] ?? null;
}

/**
 * Los vínculos y los códigos viven cada uno en UNA fila de `site_settings` (un objeto JSON por clave). Antes se leía el
 * objeto entero, se modificaba en memoria y se reescribía: dos personas vinculando o desvinculando a la vez se pisaban y
 * una perdía su cambio (H-23). Ahora cada cambio es una sola sentencia atómica (`||` y `-` sobre el JSON dentro de
 * Postgres) o ocurre en una transacción que bloquea la fila (`FOR UPDATE`).
 */
type Codigos = Record<string, { userId: string; exp: number }>;

/** Código de 6 caracteres, válido 10 minutos, para vincular el Telegram de ESTA persona del panel. */
export async function crearCodigo(userId: string): Promise<string> {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const codigo = Array.from({ length: 6 }, () => alfabeto[randomInt(alfabeto.length)]).join("");
  const ahora = Date.now();
  const entrada = JSON.stringify({ userId, exp: ahora + 10 * 60_000 });
  // Una sola sentencia: descarta los vencidos y añade el nuevo, sin leer antes.
  await db.execute(sql`
    insert into site_settings (key, value, updated_at)
    values (${CODES}, jsonb_build_object(${codigo}::text, ${entrada}::jsonb), now())
    on conflict (key) do update set
      value = coalesce(
        (select jsonb_object_agg(k, v) from jsonb_each(site_settings.value) as t(k, v) where (v ->> 'exp')::bigint >= ${ahora}),
        '{}'::jsonb
      ) || jsonb_build_object(${codigo}::text, ${entrada}::jsonb),
      updated_at = now()
  `);
  return codigo;
}

/** Consume un código y guarda el vínculo. Devuelve el userId o null si no existe / venció. Un código solo sirve una vez, aunque lleguen dos mensajes a la vez. */
export async function vincularConCodigo(codigo: string, chatId: number | string, nombre: string): Promise<string | null> {
  const clave = codigo.toUpperCase().trim();
  return db.transaction(async (tx) => {
    // Se bloquea la fila de códigos: quien llegue segundo espera y ya no encuentra el código.
    const filas = rowsOf<{ value: Codigos }>(await tx.execute(sql`select value from site_settings where key = ${CODES} for update`));
    const c = filas[0]?.value?.[clave];
    if (!c || c.exp < Date.now()) return null;
    await tx.execute(sql`update site_settings set value = value - ${clave}::text, updated_at = now() where key = ${CODES}`);
    const vinculo = JSON.stringify({ userId: c.userId, nombre, desde: new Date().toISOString() });
    await tx.execute(sql`
      insert into site_settings (key, value, updated_at)
      values (${LINKS}, jsonb_build_object(${String(chatId)}::text, ${vinculo}::jsonb), now())
      on conflict (key) do update set value = site_settings.value || jsonb_build_object(${String(chatId)}::text, ${vinculo}::jsonb), updated_at = now()
    `);
    return c.userId;
  });
}

// Borra el vínculo de un chat y limpia su estado.
export async function desvincular(chatId: number | string) {
  await db.execute(sql`update site_settings set value = value - ${String(chatId)}::text, updated_at = now() where key = ${LINKS}`);
  await escribir(estadoKey(chatId), {});
}

/** Paso del recorrido (mismos nombres que el asistente web). «tema» es el primer paso del modo IA; «titulo», el del modo manual. */
export type Fase = "idle" | "tema" | "titulo" | "resumen" | "claves" | "portada" | "seccion" | "cuerpo" | "grafica" | "seo" | "final";

/** Dato que se espera como PRÓXIMO mensaje de texto (lo pide un botón); si no hay, el texto se interpreta según el paso. */
export type Espera =
  | "titulo" | "contexto" | "resumen" | "claves" | "cuerpo" | "metaTitle" | "metaDescription" | "alt" | "escena"
  | "graficaTema" | "correccion" | "fecha" | "enfoque" | "busqueda";

// Estado de la conversación de un chat: paso actual, datos de la nota en curso y opciones elegidas.
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

// Estado de un chat; por defecto, sin nota en curso.
export const getEstado = (chatId: number | string) => leer<EstadoChat>(estadoKey(chatId), { fase: "idle" });
// Guarda el estado de un chat.
export const setEstado = (chatId: number | string, e: EstadoChat) => escribir(estadoKey(chatId), e);
