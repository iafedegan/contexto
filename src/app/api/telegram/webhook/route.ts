import { after, NextResponse } from "next/server";
import { enviar, webhookAutorizado } from "@/lib/telegram";
import { procesar, type Update } from "@/lib/telegram-bot";

/**
 * Webhook del bot de Telegram. Telegram reenvía el secreto en la cabecera `X-Telegram-Bot-Api-Secret-Token`; sin él
 * (o con otro) se rechaza. Se responde 200 de inmediato y el trabajo (que puede llamar al modelo de IA durante varios
 * minutos) sigue en segundo plano con `after`, para que Telegram no reintente el mismo mensaje.
 */
export const dynamic = "force-dynamic";
// Tiempo máximo: el trabajo puede llamar al modelo durante varios minutos.
export const maxDuration = 300;

// Recibe la actualización de Telegram: valida el secreto, responde 200 de inmediato y procesa en segundo plano.
export async function POST(req: Request) {
  // Comparación en tiempo constante. Si el servidor no tiene secreto configurado (producción sin AUTH_SECRET ni
  // TELEGRAM_WEBHOOK_SECRET) se responde 503, no 401: es un fallo de configuración, no un intento no autorizado.
  let autorizado: boolean;
  try {
    autorizado = webhookAutorizado(req.headers.get("x-telegram-bot-api-secret-token"));
  } catch {
    return NextResponse.json({ error: "webhook sin configurar" }, { status: 503 });
  }
  if (!autorizado) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  let update: Update;
  try {
    update = (await req.json()) as Update;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  after(async () => {
    try {
      await procesar(update);
    } catch (err) {
      console.error("telegram webhook:", err);
      const chat = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
      if (chat) await enviar(chat, "⚠️ Ocurrió un error procesando tu mensaje. Inténtalo de nuevo o escribe /nueva.");
    }
  });
  return NextResponse.json({ ok: true });
}
