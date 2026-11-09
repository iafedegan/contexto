import { escapeHtml as esc } from "@/lib/escape";
import { JADE, JADE_PROFUNDO, MARFIL, ORO, ORO_TEXTO, dobleFilete, ornamento, partirMarca, rotuloFlanqueado } from "@/lib/newsletter/deluxe";

const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * HTML del correo de confirmación de la suscripción, en el estilo «Deluxe» de CONtexto Ganadero Media (jade, marfil y oro). Es una pieza de
 * marca fija: no depende del diseño elegido para el boletín. Sin `server-only`: se prueba y se previsualiza sin base de datos.
 */
export function renderConfirmationHtml(p: { nombre: string; tagline?: string; email: string; url: string }): string {
  const marca = partirMarca(p.nombre);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@media only screen and (max-width:560px){.px{padding-left:22px !important;padding-right:22px !important}.brand{font-size:30px !important}}</style></head>
<body style="margin:0;background:${JADE_PROFUNDO}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${JADE_PROFUNDO}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:${MARFIL};border:1px solid ${ORO}">
<tr><td class="px" style="background:${JADE};padding:16px 28px">
  ${dobleFilete(ORO)}
  <div style="text-align:center;padding:28px 0 26px 0">
    <a href="#" class="brand" style="font:400 38px/1.05 ${SERIF};color:${MARFIL};text-decoration:none;pointer-events:none">${esc(marca.principal)}</a>
    ${marca.sub ? `<div style="margin:14px 0 0 0">${rotuloFlanqueado(esc(marca.sub), ORO, ORO, 12, 40)}</div>` : ""}
    ${p.tagline ? `<p style="margin:14px 0 0 0;font:italic 400 14px/1.4 ${SERIF};color:#d5d0c2">${esc(p.tagline)}</p>` : ""}
  </div>
  ${dobleFilete(ORO)}
</td></tr>
<tr><td class="px" align="center" style="padding:44px 44px 0 44px">
  <p style="margin:0 0 16px 0;font:700 11px/1.5 ${SANS};letter-spacing:.28em;text-transform:uppercase;color:${ORO_TEXTO}">Un último paso</p>
  <h1 style="margin:0 0 20px 0;font:400 32px/1.15 ${SERIF};color:${JADE}">Confirma tu suscripción</h1>
  ${ornamento(ORO)}
  <p style="margin:24px 0 12px 0;font:italic 400 17px/1.75 ${SERIF};color:#4a463e">Recibimos una solicitud para suscribir <strong style="font-style:normal;color:${JADE}">${esc(p.email)}</strong> al boletín de ${esc(p.nombre)}.</p>
  <p style="margin:0 0 30px 0;font:400 15px/1.7 ${SANS};color:#4a463e">Confirma tu dirección para empezar a recibirlo. Si no fuiste tú, ignora este mensaje: no se te enviará nada.</p>
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
