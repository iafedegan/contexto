import { after, NextResponse } from "next/server";
import { enviar, secretoWebhook } from "@/lib/telegram";
import { procesar, type Update } from "@/lib/telegram-bot";

/**
 * Webhook del bot de Telegram. Telegram reenvía el secreto en la cabecera `X-Telegram-Bot-Api-Secret-Token`; sin él
 * (o con otro) se rechaza. Se responde 200 de inmediato y el trabajo (que puede llamar al modelo de IA durante varios
 * minutos) sigue en segundo plano con `after`, para que Telegram no reintente el mismo mensaje.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  if (req.headers.get("x-telegram-bot-api-secret-token") !== secretoWebhook()) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
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
