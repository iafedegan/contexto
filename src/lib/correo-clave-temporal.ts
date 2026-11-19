import "server-only";
import { getSiteIdentity } from "@/lib/site-identity";
import { getNewsletterSettings, getProviderStatus } from "@/lib/newsletter/settings";
import { sendMany } from "@/lib/newsletter/send";
import { siteUrl } from "@/lib/utils";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Envía a la persona su contraseña temporal desde el correo del sitio (el remitente configurado en Boletín › Ajustes, el mismo de los
 * boletines). Devuelve el motivo si no se pudo: sin proveedor de correo o el envío falló.
 */
export async function enviarClaveTemporal(input: { nombre: string; email: string; clave: string; /** «olvido»: la pidió la persona desde el login (vence en 1 hora y su contraseña sigue sirviendo). */ motivo?: "admin" | "olvido" }): Promise<{ ok: true } | { ok: false; error: string }> {
  const proveedor = await getProviderStatus();
  if (!proveedor.configured) return { ok: false, error: "no hay un proveedor de correo configurado (Boletín › Ajustes)" };
  const [ajustes, identidad] = await Promise.all([getNewsletterSettings(), getSiteIdentity()]);
  if (!ajustes.fromEmail) return { ok: false, error: "falta el correo remitente (Boletín › Ajustes)" };
  const url = siteUrl("/panel/login");
  const sitio = identidad.name;
  const olvido = input.motivo === "olvido";
  const intro = olvido
    ? `Pediste recuperar tu contraseña del panel de ${sitio}. Esta contraseña temporal sirve una sola vez y vence en 1 hora:`
    : `Se restableció tu contraseña del panel de ${sitio}. Tu contraseña temporal es:`;
  const cierre = olvido
    ? "Si no lo pediste tú, ignora este correo: tu contraseña de siempre sigue funcionando."
    : "Si no pediste este cambio, avisa a quien administra el panel.";
  const text = [
    `Hola, ${input.nombre}:`,
    "",
    intro,
    "",
    `    ${input.clave}`,
    "",
    `Entra en ${url} con tu correo (${input.email}) y esa contraseña. Al entrar, el panel te pedirá que la cambies por una tuya de al menos 10 caracteres.`,
    "",
    cierre,
  ].join("\n");
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f3f5f2;font-family:Arial,Helvetica,sans-serif;color:#10231a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:32px">
<tr><td>
<p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#4b6355">${esc(sitio)}</p>
<h1 style="margin:0 0 20px;font-size:22px">Tu contraseña temporal</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.5">Hola, ${esc(input.nombre)}. ${esc(intro)}</p>
<p style="margin:0 0 20px;padding:16px;border-radius:8px;background:#eef3ef;font-family:'Courier New',monospace;font-size:22px;font-weight:bold;letter-spacing:2px;text-align:center">${esc(input.clave)}</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.5">Entra con tu correo <strong>${esc(input.email)}</strong>. Al entrar, el panel te pedirá que la cambies por una tuya de al menos 10 caracteres.</p>
<p style="margin:0 0 24px"><a href="${esc(url)}" style="display:inline-block;background:#0d2318;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px">Entrar al panel</a></p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#4b6355">${esc(cierre)}</p>
</td></tr></table></td></tr></table></body></html>`;
  const r = await sendMany([{ to: input.email, subject: `Tu contraseña temporal · ${sitio}`, html, text }], {
    fromName: ajustes.fromName || sitio,
    fromEmail: ajustes.fromEmail,
    replyTo: ajustes.replyTo || undefined,
  });
  return r.failed === 0 ? { ok: true } : { ok: false, error: r.error || "el proveedor rechazó el envío" };
}
