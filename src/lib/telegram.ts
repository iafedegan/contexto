import "server-only";
import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { escapeMinimo } from "@/lib/escape";

/**
 * Cliente mínimo de la API de bots de Telegram. El token del bot vive en `TELEGRAM_BOT_TOKEN` (entorno) o, si no
 * está, cifrado en `site_settings` (clave `telegram`), que es lo que guarda la pantalla Configuración → Telegram.
 * `TELEGRAM_API_BASE` permite apuntar a un servidor de prueba local.
 */
export const TELEGRAM_KEY = "telegram";
// Ajustes guardados del bot: token cifrado, nombre de usuario y dirección del webhook.
type Guardado = { token?: string; username?: string; webhookUrl?: string };

// Dirección base de la API de Telegram (configurable para servidores de prueba).
const base = () => (process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org").replace(/\/$/, "");

// Lee los ajustes del bot de la base; vacío si no hay o si falla.
export async function leerAjustesTelegram(): Promise<Guardado> {
  try {
    const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, TELEGRAM_KEY)).limit(1);
    return (row?.value as Guardado) ?? {};
  } catch {
    return {};
  }
}

// Guarda los ajustes del bot, cifrando el token si llega en claro.
export async function guardarAjustesTelegram(parcial: Partial<Guardado> & { tokenPlano?: string }) {
  const actual = await leerAjustesTelegram();
  const nuevo: Guardado = { ...actual, ...parcial };
  if (parcial.tokenPlano) nuevo.token = encryptSecret(parcial.tokenPlano);
  delete (nuevo as { tokenPlano?: string }).tokenPlano;
  await db
    .insert(siteSettings)
    .values({ key: TELEGRAM_KEY, value: nuevo })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: nuevo, updatedAt: new Date() } });
}

// Token del bot: el de la variable de entorno o, si no hay, el guardado cifrado.
export async function tokenTelegram(): Promise<string | null> {
  if (process.env.TELEGRAM_BOT_TOKEN) return process.env.TELEGRAM_BOT_TOKEN;
  const g = await leerAjustesTelegram();
  return g.token ? decryptSecret(g.token) : null;
}

/** Secreto del webhook derivado de AUTH_SECRET (no hay que configurar nada más): Telegram lo reenvía en cada petición. */
export function secretoWebhook(): string {
  const s = process.env.TELEGRAM_WEBHOOK_SECRET ?? process.env.AUTH_SECRET ?? "contexto-ganadero-dev-secret";
  return createHmac("sha256", s).update("telegram-webhook").digest("hex").slice(0, 48);
}

// Respuesta de la API de Telegram: resultado o descripción del error.
type Resp<T> = { ok: true; result: T } | { ok: false; description?: string };

// Llama a un método de la API de Telegram y devuelve su respuesta; ante un fallo de red devuelve un error.
export async function tg<T = unknown>(metodo: string, cuerpo: Record<string, unknown> = {}, token?: string | null): Promise<Resp<T>> {
  const t = token ?? (await tokenTelegram());
  if (!t) return { ok: false, description: "Falta el token del bot de Telegram." };
  try {
    const r = await fetch(`${base()}/bot${t}/${metodo}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(20_000),
    });
    return (await r.json()) as Resp<T>;
  } catch (e) {
    return { ok: false, description: e instanceof Error ? e.message : "sin conexión" };
  }
}

// Escapa los caracteres especiales para el formato HTML de Telegram.
export const esc = escapeMinimo;

// Un botón: texto y un dato de retorno o una dirección.
export type Boton = { texto: string; dato?: string; url?: string };

// Convierte filas de botones en el teclado en línea de Telegram.
const teclado = (filas?: Boton[][]) =>
  filas?.length
    ? { inline_keyboard: filas.map((f) => f.map((b) => (b.url ? { text: b.texto, url: b.url } : { text: b.texto, callback_data: (b.dato ?? "").slice(0, 60) }))) }
    : undefined;

/** Parte un texto largo en mensajes de ≤ 3.800 caracteres, cortando en saltos de línea. */
export function partir(texto: string, max = 3800): string[] {
  if (texto.length <= max) return [texto];
  const out: string[] = [];
  let resto = texto;
  while (resto.length > max) {
    let i = resto.lastIndexOf("\n", max);
    if (i < max * 0.5) i = resto.lastIndexOf(" ", max);
    if (i < 1) i = max;
    out.push(resto.slice(0, i));
    resto = resto.slice(i).trimStart();
  }
  if (resto) out.push(resto);
  return out;
}

/** HTML de Telegram → texto plano (respaldo cuando Telegram rechaza el formato). */
const textoPlano = (html: string) =>
  html.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

/**
 * Envía HTML (usa `esc` para el texto del usuario). Los botones van en el último mensaje. Si Telegram rechaza el
 * formato (p. ej. una etiqueta que quedó cortada al partir un texto largo), se reenvía como texto plano: así un
 * mensaje nunca se pierde en silencio.
 */
export async function enviar(chatId: number | string, html: string, botones?: Boton[][]) {
  const partes = partir(html);
  let ultimo: Resp<{ message_id: number }> = { ok: false };
  for (let i = 0; i < partes.length; i++) {
    const ultima = i === partes.length - 1;
    const markup = ultima && botones ? { reply_markup: teclado(botones) } : {};
    ultimo = await tg<{ message_id: number }>("sendMessage", { chat_id: chatId, text: partes[i], parse_mode: "HTML", disable_web_page_preview: true, ...markup });
    if (!ultimo.ok) {
      console.error("telegram sendMessage:", ultimo.description);
      ultimo = await tg<{ message_id: number }>("sendMessage", { chat_id: chatId, text: textoPlano(partes[i]).slice(0, 4000), disable_web_page_preview: true, ...markup });
    }
  }
  return ultimo;
}

/** Cambia solo los botones de un mensaje ya enviado (p. ej. «Referenciar» → «✓ Referenciada»). */
export async function editarTeclado(chatId: number | string, mensajeId: number, botones?: Boton[][]) {
  return tg("editMessageReplyMarkup", { chat_id: chatId, message_id: mensajeId, reply_markup: teclado(botones) ?? { inline_keyboard: [] } });
}

/** Reescribe un mensaje ya enviado (texto y botones). «No se modificó» cuenta como éxito; un formato inválido cae a texto plano. */
export async function editar(chatId: number | string, mensajeId: number, html: string, botones?: Boton[][]) {
  const base = { chat_id: chatId, message_id: mensajeId, disable_web_page_preview: true, reply_markup: teclado(botones) ?? { inline_keyboard: [] } };
  let r = await tg("editMessageText", { ...base, text: html.slice(0, 4000), parse_mode: "HTML" });
  if (!r.ok && /parse entities|can't find end/i.test(r.description ?? "")) r = await tg("editMessageText", { ...base, text: textoPlano(html).slice(0, 4000) });
  if (!r.ok && /not modified/i.test(r.description ?? "")) return { ok: true as const, result: true };
  return r;
}

/** Borra un mensaje (en chats privados el bot puede borrar también los del usuario). Sin error si ya no existe. */
export async function borrar(chatId: number | string, mensajeId: number) {
  return tg("deleteMessage", { chat_id: chatId, message_id: mensajeId });
}

// Confirma la pulsación de un botón (quita el reloj de carga y puede mostrar un aviso).
export async function responderCallback(id: string, texto?: string) {
  return tg("answerCallbackQuery", { callback_query_id: id, ...(texto ? { text: texto.slice(0, 190) } : {}) });
}

// Muestra «escribiendo…» o «enviando foto…» en el chat.
export async function escribiendo(chatId: number | string, accion: "typing" | "upload_photo" = "typing") {
  void tg("sendChatAction", { chat_id: chatId, action: accion });
}

/** Envía una imagen (bytes PNG/JPEG) con pie opcional. */
export async function enviarFoto(chatId: number | string, bytes: Uint8Array, pie?: string, nombre = "imagen.png") {
  const t = await tokenTelegram();
  if (!t) return { ok: false as const };
  const fd = new FormData();
  fd.append("chat_id", String(chatId));
  if (pie) {
    fd.append("caption", pie.slice(0, 1000));
    fd.append("parse_mode", "HTML");
  }
  fd.append("photo", new Blob([new Uint8Array(bytes)], { type: nombre.endsWith(".jpg") ? "image/jpeg" : "image/png" }), nombre);
  try {
    const r = await fetch(`${base()}/bot${t}/sendPhoto`, { method: "POST", body: fd, signal: AbortSignal.timeout(30_000) });
    return (await r.json()) as Resp<unknown>;
  } catch {
    return { ok: false as const };
  }
}

/** Descarga un archivo enviado al bot (nota de voz, audio, video, foto). */
export async function descargarArchivo(fileId: string): Promise<{ bytes: Uint8Array; ruta: string } | null> {
  const t = await tokenTelegram();
  if (!t) return null;
  const f = await tg<{ file_path?: string; file_size?: number }>("getFile", { file_id: fileId });
  if (!f.ok || !f.result.file_path) return null;
  try {
    const r = await fetch(`${base()}/file/bot${t}/${f.result.file_path}`, { signal: AbortSignal.timeout(60_000) });
    if (!r.ok) return null;
    return { bytes: new Uint8Array(await r.arrayBuffer()), ruta: f.result.file_path };
  } catch {
    return null;
  }
}
