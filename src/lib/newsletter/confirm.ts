import "server-only";
import { getSiteIdentity } from "@/lib/site-identity";
import { getNewsletterSettings, getProviderStatus } from "@/lib/newsletter/settings";
import { sendMany } from "@/lib/newsletter/send";
import { siteUrl } from "@/lib/utils";
import { renderConfirmationHtml } from "@/lib/newsletter/confirm-html";

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
  const html = renderConfirmationHtml({ nombre: identity.name, tagline: settings.headerTagline, email, url });
  const text = `Confirma tu suscripción al boletín de ${identity.name}:\n${url}\n\nSi no fuiste tú, ignora este mensaje.`;
  const res = await sendMany([{ to: email, subject: `Confirma tu suscripción · ${identity.name}`, html, text }], {
    fromName: settings.fromName,
    fromEmail: settings.fromEmail,
    replyTo: settings.replyTo || undefined,
  });
  return res.failed === 0;
}
