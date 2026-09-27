import "server-only";
import { resolveResendKey } from "@/lib/newsletter/settings";

export type Outgoing = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
};

export type SendResult = { delivered: number; failed: number; error?: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Envío por Resend (https://resend.com), en lotes de hasta 100 correos por
 * petición. Sin clave: en desarrollo se SIMULA (no sale ningún correo, solo se
 * registra en la consola del servidor); en producción falla con un mensaje
 * claro en vez de fingir que envió.
 */
export async function sendMany(
  messages: Outgoing[],
  opts: { fromName: string; fromEmail: string; replyTo?: string },
): Promise<SendResult> {
  if (messages.length === 0) return { delivered: 0, failed: 0 };
  const { key } = await resolveResendKey();

  if (!key) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[boletín · simulación] ${messages.length} correo(s) NO enviados (sin clave del proveedor): ${messages.slice(0, 3).map((m) => m.to).join(", ")}${messages.length > 3 ? "…" : ""}`);
      return { delivered: messages.length, failed: 0 };
    }
    return { delivered: 0, failed: messages.length, error: "El proveedor de correo no está configurado." };
  }
  if (!opts.fromEmail) return { delivered: 0, failed: messages.length, error: "Falta el correo remitente en Ajustes." };

  const from = `${opts.fromName.replace(/[<>"]/g, "")} <${opts.fromEmail}>`;
  let delivered = 0;
  let failed = 0;
  let error: string | undefined;

  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(
          batch.map((m) => ({
            from,
            to: [m.to],
            subject: m.subject,
            html: m.html,
            text: m.text,
            ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
            ...(m.headers ? { headers: m.headers } : {}),
          })),
        ),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) {
        delivered += batch.length;
      } else {
        failed += batch.length;
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        error ??= body?.message ?? `El proveedor respondió ${res.status}.`;
      }
    } catch {
      failed += batch.length;
      error ??= "No hubo respuesta del proveedor de correo.";
    }
    // Resend admite ~2 peticiones por segundo por cuenta.
    if (i + 100 < messages.length) await sleep(600);
  }
  return { delivered, failed, error };
}
