"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requirePermiso } from "@/lib/auth";
import { guardarAjustesTelegram, leerAjustesTelegram, secretoWebhook, tg, tokenTelegram } from "@/lib/telegram";
import { crearCodigo, desvincular, getVinculos } from "@/lib/telegram-store";
import { siteUrl } from "@/lib/utils";

// Estado de la conexión con Telegram para la pantalla de configuración.
export type EstadoTelegram = {
  token: boolean;
  origen: "entorno" | "panel" | null;
  bot: string | null;
  webhook: string | null;
  vinculos: { chatId: string; nombre: string; desde: string; mio: boolean }[];
};

/** Estado de la conexión (el administrador ve todos los vínculos; los demás, solo el suyo). */
export async function estadoTelegram(): Promise<EstadoTelegram> {
  const user = await requirePermiso("articulos");
  const [aj, tk, vin] = await Promise.all([leerAjustesTelegram(), tokenTelegram(), getVinculos()]);
  const admin = user.role === "administrador";
  const info = tk ? await tg<{ url?: string }>("getWebhookInfo", {}, tk) : null;
  return {
    token: Boolean(tk),
    origen: process.env.TELEGRAM_BOT_TOKEN ? "entorno" : tk ? "panel" : null,
    bot: aj.username ?? null,
    webhook: info?.ok ? info.result.url ?? null : null,
    vinculos: Object.entries(vin)
      .filter(([, v]) => admin || v.userId === user.id)
      .map(([chatId, v]) => ({ chatId, nombre: v.nombre, desde: v.desde, mio: v.userId === user.id })),
  };
}

/** Valida el token con Telegram, lo guarda cifrado y registra el webhook de este sitio. Solo administradores. */
export async function conectarTelegram(token: string): Promise<{ ok: true; bot: string } | { ok: false; error: string }> {
  await requireRole("administrador");
  const t = token.trim();
  if (!/^\d{6,12}:[\w-]{30,}$/.test(t)) return { ok: false, error: "El token no tiene el formato de BotFather (123456789:AA…)." };
  const me = await tg<{ username?: string }>("getMe", {}, t);
  if (!me.ok) return { ok: false, error: `Telegram rechazó el token: ${me.description ?? "sin respuesta"}` };
  const url = siteUrl("/api/telegram/webhook");
  if (!url.startsWith("https://")) return { ok: false, error: "El webhook necesita una dirección https pública (en local no funciona; hazlo desde el sitio en producción)." };
  const wh = await tg("setWebhook", { url, secret_token: secretoWebhook(), allowed_updates: ["message", "callback_query"], drop_pending_updates: true }, t);
  if (!wh.ok) return { ok: false, error: `No se pudo registrar el webhook: ${wh.description ?? ""}` };
  await guardarAjustesTelegram({ tokenPlano: t, username: me.result.username, webhookUrl: url });
  revalidatePath("/panel/configuracion");
  return { ok: true, bot: me.result.username ?? "" };
}

// Genera un código de vinculación (vale 10 minutos) para la cuenta de la persona.
export async function codigoTelegram(): Promise<string> {
  const user = await requirePermiso("articulos");
  return crearCodigo(user.id);
}

// Desvincula un chat de Telegram.
export async function desvincularTelegram(chatId: string) {
  const user = await requirePermiso("articulos");
  const vin = await getVinculos();
  if (vin[chatId] && (vin[chatId].userId === user.id || user.role === "administrador")) await desvincular(chatId);
  revalidatePath("/panel/configuracion");
}
