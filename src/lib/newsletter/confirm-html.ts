import { escapeHtml as esc } from "@/lib/escape";
import { siteUrl } from "@/lib/utils";
import { JADE, JADE_PROFUNDO, MARFIL, ORO, ORO_CLARO, ORO_TEXTO, RUTA_EMBLEMA_ORO, dobleFilete, marcaConEmblema, ornamento } from "@/lib/newsletter/deluxe";

const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * HTML del correo de bienvenida y confirmación de la suscripción, en el estilo «Deluxe» de CONtexto Ganadero Media (jade, marfil y oro) y con
 * el emblema de la marca como inicial. Es una pieza de marca fija: no depende del diseño elegido para el boletín. Sin `server-only`: se
 * prueba y se previsualiza sin base de datos.
 */
export function renderConfirmationHtml(p: { nombre: string; tagline?: string; email: string; url: string }): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@media only screen and (max-width:560px){.px{padding-left:22px !important;padding-right:22px !important}.brand{font-size:23px !important}.brand img{width:auto !important;height:26px !important}}</style></head>
<body style="margin:0;background:${JADE_PROFUNDO}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${JADE_PROFUNDO}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:${MARFIL};border:1px solid ${ORO}">
<tr><td class="px" style="background:${JADE};padding:16px 28px">
  ${dobleFilete(ORO)}
  <div style="text-align:center;padding:30px 0 28px 0">
    <span class="brand" style="font:400 34px/1.2 ${SERIF};color:${ORO_CLARO};white-space:nowrap">${marcaConEmblema(p.nombre, siteUrl(RUTA_EMBLEMA_ORO), 34)}</span>
    ${p.tagline ? `<p style="margin:14px 0 0 0;font:italic 400 14px/1.4 ${SERIF};color:#d5d0c2">${esc(p.tagline)}</p>` : ""}
  </div>
  ${dobleFilete(ORO)}
</td></tr>
<tr><td class="px" align="center" style="padding:44px 44px 0 44px">
  <p style="margin:0 0 16px 0;font:700 11px/1.5 ${SANS};letter-spacing:.28em;text-transform:uppercase;color:${ORO_TEXTO}">Bienvenido</p>
  <h1 style="margin:0 0 20px 0;font:400 32px/1.15 ${SERIF};color:${JADE}">Te damos la bienvenida</h1>
  ${ornamento(ORO)}
  <p style="margin:24px 0 14px 0;font:italic 400 18px/1.75 ${SERIF};color:#4a463e">Estás a un paso de recibir lo más importante del sector ganadero colombiano: noticias, precios y análisis, directo en tu correo.</p>
  <p style="margin:0 0 30px 0;font:400 15px/1.7 ${SANS};color:#4a463e">Confirma que <strong style="color:${JADE}">${esc(p.email)}</strong> es tu dirección para activar tu suscripción. Si no fuiste tú, ignora este mensaje: no te enviaremos nada.</p>
  <table role="presentation" align="center" cellpadding="0" cellspacing="0"><tr><td style="background:${JADE};border:1px solid ${ORO}">
    <a href="${esc(p.url)}" style="display:inline-block;padding:16px 36px;font:700 11px/1 ${SANS};letter-spacing:.24em;text-transform:uppercase;color:${ORO};text-decoration:none">Confirmar mi suscripción</a>
  </td></tr></table>
</td></tr>
<tr><td class="px" align="center" style="padding:34px 44px 40px 44px">
  <p style="margin:0;font:400 12px/1.7 ${SANS};color:#7d746a">Si el botón no funciona, copia este enlace en tu navegador:<br><a href="${esc(p.url)}" style="color:${ORO_TEXTO};word-break:break-all">${esc(p.url)}</a></p>
</td></tr>
</table>
<p style="margin:18px 0 0 0;font:400 11px/1.6 ${SANS};color:#9aa8a1">${esc(p.nombre)}</p>
</td></tr></table></body></html>`;
}
