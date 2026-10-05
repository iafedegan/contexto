import "server-only";
import { getSiteIdentity } from "@/lib/site-identity";
import { getNewsletterSettings, getProviderStatus } from "@/lib/newsletter/settings";
import { sendMany } from "@/lib/newsletter/send";
import { siteUrl } from "@/lib/utils";
import { escapeHtml as esc } from "@/lib/escape";

/**
 * Correo de confirmación de la suscripción (doble opt-in): hasta que el lector
 * pulsa el enlace no recibe nada. Si el proveedor no está configurado, no se
 * envía (la alta queda pendiente y trazable, como antes).
 */
export async function sendConfirmationEmail(email: string, token: string): Promise<boolean> {
  const provider = await getProviderStatus();
  if (!provider.configured) return false;
  const [settings, identity] = await Promise.all([getNewsletterSettings(), getSiteIdentity()]);
  const url = siteUrl(`/boletin/confirmar?t=${encodeURIComponent(token)}`);
  const accent = settings.accentColor;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f3efe7"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:520px;max-width:100%;background:#ffffff;border-radius:10px;border-top:4px solid ${accent}">
<tr><td style="padding:32px 32px 8px 32px;font:700 26px/1.2 Georgia,serif;color:#1c1712">${esc(identity.name)}</td></tr>
<tr><td style="padding:8px 32px 0 32px;font:400 16px/1.7 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#3a342e">
<p style="margin:0 0 14px 0">Hola, recibimos una solicitud para suscribir <strong>${esc(email)}</strong> a nuestro boletín.</p>
<p style="margin:0 0 22px 0">Confirma tu dirección para empezar a recibirlo. Si no fuiste tú, ignora este mensaje: no se te enviará nada.</p></td></tr>
<tr><td style="padding:0 32px 30px 32px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${accent};border-radius:999px">
<a href="${url}" style="display:inline-block;padding:13px 28px;font:700 15px/1 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#ffffff;text-decoration:none">Confirmar mi suscripción</a></td></tr></table>
<p style="margin:18px 0 0 0;font:400 12px/1.6 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#7d746a">Si el botón no funciona, copia este enlace: ${esc(url)}</p></td></tr>
</table></td></tr></table></body></html>`;
  const text = `Confirma tu suscripción al boletín de ${identity.name}:\n${url}\n\nSi no fuiste tú, ignora este mensaje.`;
  const res = await sendMany([{ to: email, subject: `Confirma tu suscripción · ${identity.name}`, html, text }], {
    fromName: settings.fromName,
    fromEmail: settings.fromEmail,
    replyTo: settings.replyTo || undefined,
  });
  return res.failed === 0;
}
