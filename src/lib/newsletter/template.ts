import { siteUrl } from "@/lib/utils";
import type { NewsletterSettings } from "@/lib/newsletter/types";
import { escapeHtml as esc } from "@/lib/escape";

/**
 * Correo del boletín. Maquetación con tablas y estilos en línea: es lo único
 * que se ve igual en Gmail, Outlook (motor de Word), Apple Mail y los clientes
 * móviles. Añade adaptación a móvil y modo oscuro donde el cliente lo permite.
 */

export type EmailArticle = {
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  categoryName: string | null;
  authorName: string | null;
  publishedAt: Date | null;
};

// Datos necesarios para dibujar un boletín.
export type NewsletterRender = {
  siteName: string;
  settings: NewsletterSettings;
  subject: string;
  preheader: string;
  intro: string;
  articles: EmailArticle[];
  /** Número de edición (null en una vista previa sin asignar). */
  issue: number | null;
  /** Enlace de baja de ESTE lector. */
  unsubscribeUrl: string;
  date?: Date;
  /** Marca «prueba» arriba, para no confundirla con un envío real. */
  isTest?: boolean;
};

// Convierte una dirección relativa en absoluta del sitio.
const absolute = (u: string) => (/^https?:\/\//i.test(u) ? u : siteUrl(u.startsWith("/") ? u : `/${u}`));

/** Enlace a una nota, con parámetros para medir en analítica cuánto trae el boletín. */
function articleLink(slug: string, issue: number | null): string {
  const url = new URL(siteUrl(`/articulo/${slug}`));
  url.searchParams.set("utm_source", "boletin");
  url.searchParams.set("utm_medium", "email");
  url.searchParams.set("utm_campaign", issue ? `edicion-${issue}` : "prueba");
  return url.toString();
}

// Convierte un texto en párrafos HTML con el estilo dado.
const paragraphs = (text: string, style: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="${style}">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

// Fecha larga en español de Colombia, en hora de Bogotá.
const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" }).format(d);

// Tipografía con serifa para los titulares del correo.
const SERIF = "Georgia, 'Times New Roman', Times, serif";
// Tipografía sin serifa para el texto del correo.
const SANS = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// Genera el HTML completo del boletín, compatible con clientes de correo (tablas y estilos en línea).
export function renderNewsletterHtml(r: NewsletterRender): string {
  const accent = r.settings.accentColor;
  const [lead, ...rest] = r.articles;
  const date = fmtDate(r.date ?? new Date());
  const homeUrl = siteUrl("/");

  const leadBlock = lead
    ? `
      <tr><td class="px" style="padding:8px 32px 0 32px">
        ${
          lead.coverImageUrl
            ? `<a href="${articleLink(lead.slug, r.issue)}" style="text-decoration:none"><img src="${esc(absolute(lead.coverImageUrl))}" width="536" alt="${esc(lead.title)}" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:6px"></a>`
            : ""
        }
        ${
          lead.categoryName
            ? `<p style="margin:22px 0 6px 0;font:700 11px/1 ${SANS};letter-spacing:.16em;text-transform:uppercase;color:${accent}">${esc(lead.categoryName)}</p>`
            : `<div style="height:22px"></div>`
        }
        <h2 class="t-main" style="margin:0 0 12px 0;font:700 28px/1.2 ${SERIF};color:#1c1712"><a href="${articleLink(lead.slug, r.issue)}" style="color:inherit;text-decoration:none">${esc(lead.title)}</a></h2>
        <p class="t-muted" style="margin:0 0 20px 0;font:400 16px/1.6 ${SANS};color:#57504a">${esc(lead.excerpt)}</p>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${accent};border-radius:999px">
          <a href="${articleLink(lead.slug, r.issue)}" style="display:inline-block;padding:12px 26px;font:700 14px/1 ${SANS};color:#ffffff;text-decoration:none">Leer la nota completa &rarr;</a>
        </td></tr></table>
      </td></tr>`
    : "";

  const restBlock = rest.length
    ? `
      <tr><td class="px" style="padding:36px 32px 0 32px">
        <p style="margin:0 0 4px 0;font:700 11px/1 ${SANS};letter-spacing:.16em;text-transform:uppercase;color:${accent}">También en esta edición</p>
        <div style="height:1px;background:${accent};opacity:.35;margin:10px 0 4px 0"></div>
      </td></tr>
      ${rest
        .map(
          (a) => `
      <tr><td class="px" style="padding:18px 32px 0 32px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          ${
            a.coverImageUrl
              ? `<td class="thumb" width="132" valign="top" style="padding:0 18px 0 0"><a href="${articleLink(a.slug, r.issue)}"><img src="${esc(absolute(a.coverImageUrl))}" width="132" height="96" alt="" style="display:block;width:132px;height:96px;object-fit:cover;border:0;border-radius:4px"></a></td>`
              : ""
          }
          <td class="thumb" valign="top">
            ${a.categoryName ? `<p style="margin:0 0 4px 0;font:700 10px/1 ${SANS};letter-spacing:.14em;text-transform:uppercase;color:${accent}">${esc(a.categoryName)}</p>` : ""}
            <h3 class="t-main" style="margin:0 0 6px 0;font:700 19px/1.25 ${SERIF};color:#1c1712"><a href="${articleLink(a.slug, r.issue)}" style="color:inherit;text-decoration:none">${esc(a.title)}</a></h3>
            <p class="t-muted" style="margin:0;font:400 14px/1.55 ${SANS};color:#57504a">${esc(a.excerpt.length > 150 ? `${a.excerpt.slice(0, 147).trimEnd()}…` : a.excerpt)}</p>
          </td>
        </tr></table>
      </td></tr>`,
        )
        .join("")}`
    : "";

  return `<!doctype html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(r.subject)}</title>
<style>
  body { margin:0; padding:0; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse; }
  img { -ms-interpolation-mode:bicubic; }
  a { color:${accent}; }
  @media only screen and (max-width:620px) {
    .container { width:100% !important; }
    .px { padding-left:20px !important; padding-right:20px !important; }
    .thumb { display:block !important; width:100% !important; padding:0 0 12px 0 !important; }
    .thumb img { width:100% !important; height:auto !important; }
    .brand { font-size:26px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .bg-page { background:#141210 !important; }
    .card { background:#1e1b18 !important; }
    .t-main, .t-main a { color:#f3ede2 !important; }
    .t-muted { color:#b3aa9d !important; }
    .legal { color:#8d857a !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f3efe7">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px">${esc(r.preheader)}${"&zwnj;&nbsp;".repeat(60)}</div>
<table role="presentation" class="bg-page" width="100%" cellpadding="0" cellspacing="0" style="background:#f3efe7"><tr><td align="center" style="padding:24px 12px">
  ${
    r.isTest
      ? `<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%"><tr><td style="padding:0 0 12px 0;text-align:center;font:700 12px/1.4 ${SANS};color:#b45309;letter-spacing:.06em">CORREO DE PRUEBA · no se ha enviado a los suscriptores</td></tr></table>`
      : ""
  }
  <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%">
    <tr><td align="center" style="padding:8px 0 22px 0">
      <p style="margin:0 0 10px 0;font:400 12px/1 ${SANS};letter-spacing:.08em;text-transform:uppercase;color:#7d746a">${esc(date)}${r.issue ? ` &nbsp;·&nbsp; Edición N.º ${r.issue}` : ""}</p>
      <a href="${homeUrl}" class="brand t-main" style="font:700 32px/1.1 ${SERIF};color:#1c1712;text-decoration:none;letter-spacing:.01em">${esc(r.siteName)}</a>
      ${r.settings.headerTagline ? `<p style="margin:8px 0 0 0;font:italic 400 14px/1.3 ${SERIF};color:#7d746a">${esc(r.settings.headerTagline)}</p>` : ""}
    </td></tr>
    <tr><td class="card" style="background:#ffffff;border-radius:10px;border-top:4px solid ${accent}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td class="px" style="padding:30px 32px 6px 32px">
          <h1 class="t-main" style="margin:0 0 14px 0;font:700 13px/1.4 ${SANS};letter-spacing:.14em;text-transform:uppercase;color:${accent}">${esc(r.subject)}</h1>
          ${r.intro.trim() ? paragraphs(r.intro, `margin:0 0 14px 0;font:400 16px/1.7 ${SANS};color:#3a342e`).replace(/color:#3a342e/g, "color:#3a342e") : ""}
        </td></tr>
        ${leadBlock}
        ${restBlock}
        <tr><td class="px" style="padding:36px 32px 34px 32px" align="center">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border:2px solid ${accent};border-radius:999px">
            <a href="${homeUrl}?utm_source=boletin&amp;utm_medium=email" style="display:inline-block;padding:11px 24px;font:700 13px/1 ${SANS};color:${accent};text-decoration:none">Ver todas las noticias en ${esc(r.siteName)}</a>
          </td></tr></table>
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" class="legal" style="padding:24px 16px 8px 16px;font:400 12px/1.65 ${SANS};color:#7d746a">
      <p style="margin:0 0 10px 0">${esc(r.settings.legalText)}</p>
      <p style="margin:0 0 10px 0"><strong>${esc(r.siteName)}</strong>${r.settings.address ? ` · ${esc(r.settings.address)}` : ""}</p>
      <p style="margin:0"><a href="${esc(r.unsubscribeUrl)}" style="color:#7d746a;text-decoration:underline">Darme de baja</a> &nbsp;·&nbsp; <a href="${homeUrl}" style="color:#7d746a;text-decoration:underline">Ir al sitio</a></p>
    </td></tr>
  </table>
</td></tr></table>
</body>
</html>`;
}

/** Versión en texto plano: mejora la entrega y la ven los clientes sin HTML. */
export function renderNewsletterText(r: NewsletterRender): string {
  const line = "—".repeat(28);
  const parts: string[] = [
    r.siteName.toUpperCase() + (r.issue ? ` · Edición N.º ${r.issue}` : ""),
    fmtDate(r.date ?? new Date()),
    line,
  ];
  if (r.intro.trim()) parts.push(r.intro.trim(), line);
  r.articles.forEach((a, i) => {
    parts.push(
      `${i === 0 ? "DESTACADA · " : ""}${a.categoryName ? a.categoryName.toUpperCase() + " · " : ""}${a.title}`,
      a.excerpt,
      articleLink(a.slug, r.issue),
      "",
    );
  });
  parts.push(line, r.settings.legalText, `${r.siteName}${r.settings.address ? " · " + r.settings.address : ""}`, `Darme de baja: ${r.unsubscribeUrl}`);
  return parts.join("\n");
}
