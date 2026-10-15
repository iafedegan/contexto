import { siteUrl } from "@/lib/utils";
import { DEFAULT_NEWSLETTER_DESIGN, type NewsletterSettings } from "@/lib/newsletter/types";
import { escapeHtml as esc } from "@/lib/escape";
import { luminosidad, mezclar, profundo, textoSobre } from "@/lib/newsletter/color";
import { rutaDeNota } from "@/lib/ruta-nota";

/**
 * Correo del boletín. Maquetación con tablas y estilos en línea: es lo único
 * que se ve igual en Gmail, Outlook (motor de Word), Apple Mail y los clientes
 * móviles. Añade adaptación a móvil y modo oscuro donde el cliente lo permite.
 */

export type EmailArticle = {
  slug: string;
  /** Dirección original del sitio anterior, si la nota viene de allí. */
  legacyPath?: string | null;
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
  /** Las mismas notas agrupadas por sección (con encabezados). Sin esto, el correo se dibuja como una sola lista. */
  secciones?: { titulo: string | null; articulos: EmailArticle[] }[];
  /** Número de edición (null en una vista previa sin asignar). */
  issue: number | null;
  /** Enlace de baja de ESTE lector. */
  unsubscribeUrl: string;
  /** Solo si ESTE lector autorizó que se relacione su lectura: sus enlaces a notas llevan su firma (`cgs`, `cgt`). */
  lector?: { id: string; token: string };
  date?: Date;
  /** Marca «prueba» arriba, para no confundirla con un envío real. */
  isTest?: boolean;
};

// Convierte una dirección relativa en absoluta del sitio.
const absolute = (u: string) => (/^https?:\/\//i.test(u) ? u : siteUrl(u.startsWith("/") ? u : `/${u}`));

/** Enlace a una nota, con parámetros para medir en analítica cuánto trae el boletín. */
function articleLink(a: { slug: string; legacyPath?: string | null }, issue: number | null, lector?: { id: string; token: string }): string {
  const url = new URL(siteUrl(rutaDeNota(a)));
  url.searchParams.set("utm_source", "boletin");
  url.searchParams.set("utm_medium", "email");
  url.searchParams.set("utm_campaign", issue ? `edicion-${issue}` : "prueba");
  if (lector) {
    url.searchParams.set("cgs", lector.id);
    url.searchParams.set("cgt", lector.token);
  }
  return url.toString();
}

// Convierte un texto en párrafos HTML con el estilo dado.
const paragraphs = (text: string, style: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p class="t-muted" style="${style}">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

// Fecha larga en español de Colombia, en hora de Bogotá.
const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" }).format(d);

// Tipografía con serifa para los titulares del correo.
const SERIF = "Georgia, 'Times New Roman', Times, serif";
// Tipografía sin serifa para el texto del correo.
const SANS = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
// Tipografía «moderna»: sin serifa y más ancha, disponible en todos los clientes.
const MODERNA = "'Trebuchet MS', 'Lucida Grande', Verdana, Geneva, sans-serif";
// Tipografía «impacto»: titulares condensados y muy gruesos, como las portadas de revista.
const IMPACTO = "Impact, Haettenschweiler, 'Arial Narrow Bold', 'Arial Black', sans-serif";

// Genera el HTML completo del boletín, compatible con clientes de correo (tablas y estilos en línea). El aspecto sale de `settings.design`.
export function renderNewsletterHtml(r: NewsletterRender): string {
  const accent = r.settings.accentColor;
  // Ajustes guardados antes de existir el diseño no lo traen: se usa el de siempre.
  const d = r.settings.design ?? DEFAULT_NEWSLETTER_DESIGN;
  const TIT = { serif: SERIF, sans: SANS, moderna: MODERNA, impacto: IMPACTO }[d.tipografia];
  // En «impacto» los titulares van en mayúsculas y más grandes, como en las portadas de revista.
  const mayus = d.tipografia === "impacto" ? "text-transform:uppercase;" : "";
  const escalaTit = d.tipografia === "impacto" ? 1.12 : 1;
  const radio = { rectas: 0, suaves: 10, redondas: 20 }[d.esquinas];
  const radioBoton = { pildora: "999px", redondo: "8px", recto: "0" }[d.boton];
  const date = fmtDate(r.date ?? new Date());
  const homeUrl = siteUrl("/");
  const link = (a: EmailArticle) => articleLink(a, r.issue, r.lector);
  const centrada = d.cabecera === "centrada";
  const alinear = centrada ? "center" : "left";
  const enAcento = textoSobre(accent);
  const profundoAcento = profundo(accent);
  // Fondo oscuro para paneles que contrastan (titulares oscuros) y tinte suave del acento para paneles claros.
  const oscuro = luminosidad(d.colorTitulos) < 0.3 ? d.colorTitulos : "#111827";
  const tinte = mezclar(accent, d.colorTarjeta, 12);
  const tx = (fondo: string) => textoSobre(fondo);
  const tamTit = (n: number) => Math.round(n * escalaTit);

  // Línea que separa bloques (o nada).
  const separador =
    d.separador === "linea"
      ? `<div style="height:1px;background:${accent};opacity:.35;margin:10px 0 4px 0"></div>`
      : d.separador === "punteada"
        ? `<div style="border-top:1px dashed ${accent};opacity:.55;margin:10px 0 4px 0;height:0"></div>`
        : `<div style="height:6px"></div>`;

  // Sección y datos de la nota (sección, autor, fecha), según lo que se haya elegido mostrar. `c` = color del texto (sobre paneles de color).
  const seccion = (a: EmailArticle, margen: string, tam = 11, c = accent) =>
    d.mostrarSeccion && a.categoryName
      ? `<p style="margin:${margen};font:700 ${tam}px/1 ${SANS};letter-spacing:.16em;text-transform:uppercase;color:${c}">${esc(a.categoryName)}</p>`
      : "";
  const firma = (a: EmailArticle, c = "#7d746a", clase = "t-muted") => {
    const partes = [
      d.mostrarAutor && a.authorName ? `Por ${esc(a.authorName)}` : "",
      d.mostrarFecha && a.publishedAt ? esc(new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" }).format(a.publishedAt)) : "",
    ].filter(Boolean);
    return partes.length ? `<p ${clase ? `class="${clase}" ` : ""}style="margin:0 0 8px 0;font:400 12px/1.4 ${SANS};color:${c}">${partes.join(" &nbsp;·&nbsp; ")}</p>` : "";
  };
  // Botón de la nota: relleno del acento, o invertido (relleno claro con texto del acento) sobre un panel de color.
  const boton = (a: EmailArticle, invertido = false) =>
    `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${invertido ? enAcento : accent};border-radius:${radioBoton}"><a href="${link(a)}" style="display:inline-block;padding:12px 26px;font:700 14px/1 ${SANS};color:${invertido ? accent : enAcento};text-decoration:none">${esc(d.botonTexto)} &rarr;</a></td></tr></table>`;
  const recortar = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 3).trimEnd()}…` : t);
  const foto = (a: EmailArticle, ancho: number, extra = "") =>
    a.coverImageUrl ? `<a href="${link(a)}" style="text-decoration:none"><img src="${esc(absolute(a.coverImageUrl))}" width="${ancho}" alt="${esc(a.title)}" style="display:block;width:100%;max-width:${ancho}px;height:auto;border:0;${extra}"></a>` : "";

  // Nota con foto grande (destacada o, en «revista», todas). Con `panel`, el texto va sobre el color de acento.
  const bloqueGrande = (a: EmailArticle, titulo: number, conFoto: boolean, relleno: string, panel = false) => {
    if (panel) {
      return `
      ${conFoto && a.coverImageUrl ? `<tr><td style="padding:8px 0 0 0">${foto(a, 600)}</td></tr>` : ""}
      <tr><td class="px" style="padding:28px 32px 30px 32px;background:${accent}">
        ${seccion(a, "0 0 10px 0", 11, enAcento)}
        <h2 style="margin:0 0 12px 0;font:800 ${tamTit(titulo + 4)}px/1.12 ${TIT};${mayus}color:${enAcento}"><a href="${link(a)}" style="color:inherit;text-decoration:none">${esc(a.title)}</a></h2>
        ${firma(a, enAcento, "")}
        <p style="margin:0 0 20px 0;font:400 16px/1.6 ${SANS};color:${enAcento};opacity:.92">${esc(a.excerpt)}</p>
        ${boton(a, true)}
      </td></tr>`;
    }
    return `
      <tr><td class="px" style="padding:${relleno}">
        ${conFoto ? foto(a, 536, `border-radius:${Math.min(radio, 12)}px`) : ""}
        ${seccion(a, "20px 0 6px 0") || `<div style="height:20px"></div>`}
        <h2 class="t-main" style="margin:0 0 10px 0;font:700 ${tamTit(titulo)}px/1.2 ${TIT};${mayus}color:${d.colorTitulos}"><a href="${link(a)}" style="color:inherit;text-decoration:none">${esc(a.title)}</a></h2>
        ${firma(a)}
        <p class="t-muted" style="margin:0 0 18px 0;font:400 16px/1.6 ${SANS};color:${d.colorTexto}">${esc(a.excerpt)}</p>
        ${boton(a)}
      </td></tr>`;
  };

  // Nota en fila con miniatura a la izquierda.
  const bloqueFila = (a: EmailArticle, ancho: number, largoResumen: number) => `
      <tr><td class="px" style="padding:18px 32px 0 32px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          ${
            d.miniaturas && a.coverImageUrl
              ? `<td class="thumb" width="${ancho}" valign="top" style="padding:0 18px 0 0"><a href="${link(a)}"><img src="${esc(absolute(a.coverImageUrl))}" width="${ancho}" height="${Math.round(ancho * 0.68)}" alt="${esc(a.title)}" style="display:block;width:${ancho}px;height:auto;border:0;border-radius:${Math.min(radio, 8)}px"></a></td>`
              : ""
          }
          <td class="thumb" valign="top">
            ${seccion(a, "0 0 4px 0", 10)}
            <h3 class="t-main" style="margin:0 0 6px 0;font:700 ${tamTit(19)}px/1.25 ${TIT};${mayus}color:${d.colorTitulos}"><a href="${link(a)}" style="color:inherit;text-decoration:none">${esc(a.title)}</a></h3>
            ${firma(a)}
            <p class="t-muted" style="margin:0;font:400 14px/1.55 ${SANS};color:${d.colorTexto}">${esc(recortar(a.excerpt, largoResumen))}</p>
          </td>
        </tr></table>
      </td></tr>`;

  // Solo el titular (plantilla mínima).
  const bloqueTitular = (a: EmailArticle) => `
      <tr><td class="px" style="padding:14px 32px 0 32px">
        ${seccion(a, "0 0 3px 0", 10)}
        <h3 class="t-main" style="margin:0;font:700 ${tamTit(18)}px/1.3 ${TIT};${mayus}color:${d.colorTitulos}"><a href="${link(a)}" style="color:inherit;text-decoration:none">${esc(a.title)}</a></h3>
        ${firma(a)}
      </td></tr>`;

  const rotulo = (texto: string) => `
      <tr><td class="px" style="padding:36px 32px 0 32px">
        <p style="margin:0 0 4px 0;font:700 11px/1 ${SANS};letter-spacing:.16em;text-transform:uppercase;color:${accent}">${texto}</p>
        ${separador}
      </td></tr>`;

  // Tarjeta de una rejilla de dos columnas: foto arriba, sección, titular y resumen corto.
  const tarjeta = (a: EmailArticle, conBorde: boolean) => `
          <td class="col" width="50%" valign="top" style="padding:0 8px 16px 8px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${conBorde ? `border:1px solid ${accent}33;` : ""}border-radius:${Math.min(radio, 14)}px;overflow:hidden"><tr><td style="padding:0">
              ${d.miniaturas ? foto(a, 260, `border-radius:${Math.min(radio, 14)}px ${Math.min(radio, 14)}px 0 0`) : ""}
              <div style="padding:${conBorde ? "14px 14px 16px 14px" : "12px 0 0 0"}">
                ${seccion(a, "0 0 6px 0", 10)}
                <h3 class="t-main" style="margin:0 0 6px 0;font:700 ${tamTit(17)}px/1.25 ${TIT};${mayus}color:${d.colorTitulos}"><a href="${link(a)}" style="color:inherit;text-decoration:none">${esc(a.title)}</a></h3>
                ${firma(a)}
                <p class="t-muted" style="margin:0;font:400 13px/1.55 ${SANS};color:${d.colorTexto}">${esc(recortar(a.excerpt, 110))}</p>
              </div>
            </td></tr></table>
          </td>`;
  const rejilla = (lista: EmailArticle[], conBorde: boolean) => {
    const filas: string[] = [];
    for (let i = 0; i < lista.length; i += 2) {
      const par = lista.slice(i, i + 2);
      filas.push(`<tr>${par.map((a) => tarjeta(a, conBorde)).join("")}${par.length === 1 ? `<td class="col" width="50%" style="padding:0 8px"></td>` : ""}</tr>`);
    }
    return `
      <tr><td class="px" style="padding:20px 24px 0 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas.join("")}</table></td></tr>`;
  };

  // Destacada «editorial»: foto a todo el ancho del correo y un titular grande debajo (o sobre un panel de color).
  const heroEditorial = (a: EmailArticle) =>
    d.destacadaColor
      ? bloqueGrande(a, 30, d.imagenDestacada, "", true)
      : `
      ${a.coverImageUrl && d.imagenDestacada ? `<tr><td style="padding:8px 0 0 0">${foto(a, 600)}</td></tr>` : ""}
      <tr><td class="px" style="padding:26px 32px 0 32px">
        ${seccion(a, "0 0 10px 0", 11)}
        <h2 class="t-main" style="margin:0 0 12px 0;font:800 ${tamTit(34)}px/1.1 ${TIT};${mayus}letter-spacing:-.01em;color:${d.colorTitulos}"><a href="${link(a)}" style="color:inherit;text-decoration:none">${esc(a.title)}</a></h2>
        ${firma(a)}
        <p class="t-muted" style="margin:0 0 20px 0;font:400 17px/1.6 ${SANS};color:${d.colorTexto}">${esc(a.excerpt)}</p>
        ${boton(a)}
      </td></tr>`;

  // Lista numerada: número grande, sección, titular y, si se quiere, miniatura.
  const filaNumerada = (a: EmailArticle, n: number) => `
      <tr><td class="px" style="padding:18px 32px 0 32px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="58" valign="top" style="padding:0 12px 0 0;font:800 ${tamTit(36)}px/1 ${TIT};color:${accent}">${String(n).padStart(2, "0")}</td>
          <td valign="top">
            ${seccion(a, "0 0 4px 0", 10)}
            <h3 class="t-main" style="margin:0 0 4px 0;font:700 ${tamTit(18)}px/1.28 ${TIT};${mayus}color:${d.colorTitulos}"><a href="${link(a)}" style="color:inherit;text-decoration:none">${esc(a.title)}</a></h3>
            ${firma(a)}
            <p class="t-muted" style="margin:0;font:400 13px/1.5 ${SANS};color:${d.colorTexto}">${esc(recortar(a.excerpt, 100))}</p>
          </td>
          ${d.miniaturas && a.coverImageUrl ? `<td class="thumb" width="96" valign="top" style="padding:0 0 0 14px"><a href="${link(a)}"><img src="${esc(absolute(a.coverImageUrl))}" width="96" height="96" alt="${esc(a.title)}" style="display:block;width:96px;height:96px;object-fit:cover;border:0;border-radius:${Math.min(radio, 10)}px"></a></td>` : ""}
        </tr></table>
      </td></tr>`;

  // «Bloques»: la destacada sobre el acento y las demás en paneles de color alternos, con la foto a un lado (cambia de lado en cada una).
  const panelBloque = (a: EmailArticle, i: number) => {
    const fondo = i % 2 === 0 ? oscuro : tinte;
    const t = tx(fondo);
    const fotoTd = d.miniaturas && a.coverImageUrl ? `<td class="col" width="250" valign="middle" style="padding:0">${foto(a, 250)}</td>` : "";
    const textoTd = `<td class="col" valign="middle" style="padding:24px 26px">
        ${seccion(a, "0 0 8px 0", 10, i % 2 === 0 ? mezclar(accent, "#ffffff", 70) : accent)}
        <h3 style="margin:0 0 8px 0;font:800 ${tamTit(22)}px/1.15 ${TIT};${mayus}color:${t}"><a href="${link(a)}" style="color:inherit;text-decoration:none">${esc(a.title)}</a></h3>
        ${firma(a, t, "")}
        <p style="margin:0 0 14px 0;font:400 14px/1.55 ${SANS};color:${t};opacity:.88">${esc(recortar(a.excerpt, 120))}</p>
        <a href="${link(a)}" style="font:700 13px/1 ${SANS};color:${i % 2 === 0 ? mezclar(accent, "#ffffff", 70) : accent};text-decoration:underline">${esc(d.botonTexto)} &rarr;</a>
      </td>`;
    return `
      <tr><td style="padding:0;background:${fondo}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${i % 2 === 0 ? fotoTd + textoTd : textoTd + fotoTd}</tr></table></td></tr>`;
  };

  // «Mosaico»: baldosas de color con el titular (y la foto, si se quiere), en cuadrícula de dos columnas.
  const baldosas = (lista: EmailArticle[]) => {
    const colores = [accent, oscuro, tinte, profundoAcento];
    const filas: string[] = [];
    for (let i = 0; i < lista.length; i += 2) {
      const par = lista.slice(i, i + 2);
      filas.push(
        `<tr>${par
          .map((a, k) => {
            const fondo = colores[(i + k) % colores.length];
            const t = tx(fondo);
            return `<td class="col" width="50%" valign="top" style="padding:3px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${fondo};border-radius:${Math.min(radio, 14)}px;overflow:hidden"><tr><td style="padding:0">
              ${d.miniaturas ? foto(a, 270) : ""}
              <div style="padding:16px 18px 20px 18px">
                ${seccion(a, "0 0 6px 0", 10, t)}
                <h3 style="margin:0 0 6px 0;font:800 ${tamTit(18)}px/1.2 ${TIT};${mayus}color:${t}"><a href="${link(a)}" style="color:inherit;text-decoration:none">${esc(a.title)}</a></h3>
                ${firma(a, t, "")}
                <p style="margin:0;font:400 13px/1.5 ${SANS};color:${t};opacity:.88">${esc(recortar(a.excerpt, 90))}</p>
              </div></td></tr></table></td>`;
          })
          .join("")}${par.length === 1 ? `<td class="col" width="50%" style="padding:3px"></td>` : ""}</tr>`,
      );
    }
    return `
      <tr><td style="padding:14px 21px 0 21px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas.join("")}</table></td></tr>`;
  };

  // «Dossier»: columna principal con la destacada y, al lado, un recuadro «En breve» con las siguientes.
  const dossier = (lead: EmailArticle, resto: EmailArticle[]) => {
    const breve = resto.slice(0, 4);
    const abajo = resto.slice(4);
    const lateral = breve.length
      ? `<td class="col" width="196" valign="top" style="background:${tinte};border-top:4px solid ${accent};padding:16px 16px 6px 16px">
          <p style="margin:0 0 10px 0;font:800 13px/1 ${SANS};letter-spacing:.14em;text-transform:uppercase;color:${accent}">En breve</p>
          ${breve
            .map(
              (a, i) => `<div style="margin:0 0 14px 0;padding:0 0 12px 0;${i < breve.length - 1 ? `border-bottom:1px solid ${accent}40` : ""}">
              <span style="font:800 ${tamTit(20)}px/1 ${TIT};color:${accent}">${String(i + 2).padStart(2, "0")}</span>
              ${a.categoryName && d.mostrarSeccion ? `<span style="font:700 9px/1 ${SANS};letter-spacing:.14em;text-transform:uppercase;color:${accent};margin-left:6px">${esc(a.categoryName)}</span>` : ""}
              <h3 class="t-main" style="margin:4px 0 0 0;font:700 ${tamTit(15)}px/1.28 ${TIT};${mayus}color:${d.colorTitulos}"><a href="${link(a)}" style="color:inherit;text-decoration:none">${esc(a.title)}</a></h3></div>`,
            )
            .join("")}
        </td>`
      : "";
    return `
      <tr><td class="px" style="padding:8px 32px 0 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td class="col" valign="top" style="padding:0 ${lateral ? "20px" : "0"} 0 0">
          ${d.imagenDestacada ? foto(lead, 340, `border-radius:${Math.min(radio, 12)}px`) : ""}
          ${seccion(lead, "16px 0 6px 0") || `<div style="height:16px"></div>`}
          <h2 class="t-main" style="margin:0 0 10px 0;font:800 ${tamTit(26)}px/1.15 ${TIT};${mayus}color:${d.colorTitulos}"><a href="${link(lead)}" style="color:inherit;text-decoration:none">${esc(lead.title)}</a></h2>
          ${firma(lead)}
          <p class="t-muted" style="margin:0 0 16px 0;font:400 15px/1.6 ${SANS};color:${d.colorTexto}">${esc(lead.excerpt)}</p>
          ${boton(lead)}
        </td>${lateral}
      </tr></table></td></tr>${abajo.length ? rotulo("Más notas") + abajo.map((a) => bloqueFila(a, 110, 120)).join("") : ""}`;
  };

  // Encabezado de una sección del armado («Última hora», «Colombia»…): más marcado que el rótulo «También en esta edición».
  const rotuloSeccion = (titulo: string) => `
      <tr><td class="px" style="padding:38px 32px 0 32px">
        <div style="width:34px;height:4px;background:${accent};margin:0 0 10px 0;border-radius:2px"></div>
        <h2 class="t-main" style="margin:0;font:800 ${tamTit(22)}px/1.15 ${TIT};${mayus}color:${d.colorTitulos}">${esc(titulo)}</h2>
      </td></tr>`;

  /**
   * Las notas de UNA lista dibujadas con la maquetación elegida. `conDestacada`: la primera nota es la destacada (la de arriba del
   * correo); si no, todas se dibujan como las «demás» (las secciones que siguen a la primera).
   */
  const cuerpoDe = (arts: EmailArticle[], conDestacada: boolean, conRotulos = true): string => {
    const lead = conDestacada ? arts[0] : undefined;
    const rest = conDestacada ? arts.slice(1) : arts;
    // Los rótulos «También en esta edición» y «Lo que más debes leer» solo tienen sentido en una lista sin secciones: con secciones, el encabezado ya titula cada grupo.
    const mas = conRotulos && conDestacada && rest.length ? rotulo("También en esta edición") : "";
    switch (d.plantilla) {
      case "revista":
        return arts
          .map((a, i) => {
            const primera = conDestacada && i === 0;
            return bloqueGrande(a, primera ? 30 : 24, primera ? d.imagenDestacada : d.miniaturas, primera ? "8px 32px 0 32px" : "34px 32px 0 32px", primera && d.destacadaColor);
          })
          .join("");
      case "editorial":
        return (lead ? heroEditorial(lead) : "") + (rest.length ? mas + rejilla(rest, false) : "");
      case "tarjetas":
        return arts.length ? rejilla(arts, true) : "";
      case "numerada":
        return (lead ? bloqueGrande(lead, 28, d.imagenDestacada, "8px 32px 0 32px", d.destacadaColor) : "") + (rest.length ? (conRotulos && conDestacada ? rotulo("Lo que más debes leer") : "") + rest.map((a, i) => filaNumerada(a, i + (conDestacada ? 2 : 1))).join("") : "");
      case "minima":
        return (lead ? bloqueGrande(lead, 26, d.imagenDestacada, "8px 32px 0 32px", d.destacadaColor) : "") + (rest.length ? mas + rest.map(bloqueTitular).join("") : "");
      case "bloques":
        return (lead ? bloqueGrande(lead, 30, d.imagenDestacada, "", true) + `<tr><td style="padding:0;height:8px;line-height:8px;font-size:0">&nbsp;</td></tr>` : "") + rest.map(panelBloque).join("");
      case "mosaico":
        return (lead ? bloqueGrande(lead, 30, d.imagenDestacada, "", true) : "") + (rest.length ? baldosas(rest) : "");
      case "dossier":
        return lead ? dossier(lead, rest) : rest.map((a) => bloqueFila(a, 110, 120)).join("");
      default:
        return (lead ? bloqueGrande(lead, 28, d.imagenDestacada, "8px 32px 0 32px", d.destacadaColor) : "") + (rest.length ? mas + rest.map((a) => bloqueFila(a, 132, 150)).join("") : "");
    }
  };

  // Con encabezados de sección, cada sección lleva el suyo; la primera abre con la nota destacada y las demás solo listan sus notas.
  const secs = (r.secciones ?? []).filter((x) => x.articulos.length > 0);
  const cuerpoNotas = secs.some((x) => x.titulo) ? secs.map((x, i) => (x.titulo ? rotuloSeccion(x.titulo) : "") + cuerpoDe(x.articulos, i === 0, false)).join("") : cuerpoDe(r.articles, true);

  // Mensaje de cierre, antes del botón final.
  const cierre = d.cierre.trim()
    ? `<tr><td class="px" style="padding:30px 32px 0 32px">${paragraphs(d.cierre, `margin:0 0 12px 0;font:italic 400 15px/1.7 ${TIT};color:${d.colorTexto}`)}</td></tr>`
    : "";

  // Cabecera del correo: la «sencilla» va sobre la página; la «banda» y la «gigante» son un bloque de color dentro del correo.
  const conMasthead = d.masthead !== "sencillo";
  const etiquetaEdicion = [esc(date), r.issue ? `Edición N.º ${r.issue}` : ""].filter(Boolean).join(" &nbsp;·&nbsp; ");
  const insignia = (tam: number) =>
    d.insignia && r.issue
      ? `<table role="presentation" cellpadding="0" cellspacing="0" align="right"><tr><td align="center" valign="middle" width="${tam}" height="${tam}" style="width:${tam}px;height:${tam}px;border-radius:50%;background:${enAcento};color:${accent};font:800 ${Math.round(tam * 0.17)}px/1 ${SANS};letter-spacing:.06em;text-transform:uppercase">N.º<br><span style="font:800 ${Math.round(tam * 0.42)}px/1.05 ${TIT}">${r.issue}</span></td></tr></table>`
      : "";
  const logoImg = d.mostrarLogo
    ? `<a href="${homeUrl}"><img src="${esc(siteUrl("/logo/contexto-ganadero-logo-v3-512.png"))}" width="${conMasthead ? 44 : 56}" height="${conMasthead ? 44 : 56}" alt="${esc(r.siteName)}" style="display:${centrada && !conMasthead ? "inline-block" : "block"};border:0;border-radius:10px;margin:0 0 12px 0"></a>${centrada && !conMasthead ? "<br>" : ""}`
    : "";
  const arriba = `border-radius:${radio}px ${radio}px 0 0`;
  const encabezado =
    d.masthead === "gigante"
      ? `<tr><td class="px" style="background:${accent};padding:34px 32px 30px 32px;${arriba}">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td valign="middle" align="left">
              ${logoImg}
              <p style="margin:0 0 12px 0;font:700 11px/1.3 ${SANS};letter-spacing:.18em;text-transform:uppercase;color:${enAcento};opacity:.88">${etiquetaEdicion}</p>
              <a href="${homeUrl}" class="brand" style="font:${d.tipografia === "impacto" ? "400" : "800"} 60px/.96 ${IMPACTO};letter-spacing:.01em;text-transform:uppercase;color:${enAcento};text-decoration:none">${esc(r.siteName).replace(/\s+/g, "<br>")}</a>
              ${r.settings.headerTagline ? `<p style="margin:12px 0 0 0;font:italic 400 14px/1.3 ${SERIF};color:${enAcento};opacity:.9">${esc(r.settings.headerTagline)}</p>` : ""}
            </td>
            <td class="ins" width="104" valign="middle" align="right">${insignia(92)}</td>
          </tr></table></td></tr>`
      : d.masthead === "banda"
        ? `<tr><td class="px" style="background:${accent};padding:20px 32px;${arriba}">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td valign="middle" align="left">
              ${logoImg}
              <p style="margin:0 0 6px 0;font:700 10px/1.3 ${SANS};letter-spacing:.18em;text-transform:uppercase;color:${enAcento};opacity:.88">${etiquetaEdicion}</p>
              <a href="${homeUrl}" class="brand" style="font:800 28px/1.1 ${TIT};letter-spacing:.02em;${d.tipografia === "impacto" ? "" : "text-transform:uppercase;"}color:${enAcento};text-decoration:none">${esc(r.siteName)}</a>
              ${r.settings.headerTagline ? `<p style="margin:5px 0 0 0;font:italic 400 13px/1.3 ${SERIF};color:${enAcento};opacity:.9">${esc(r.settings.headerTagline)}</p>` : ""}
            </td>
            <td class="ins" width="64" valign="middle" align="right">${insignia(56)}</td>
          </tr></table></td></tr>`
        : "";
  const encabezadoSencillo = conMasthead
    ? ""
    : `<tr><td align="${alinear}" style="padding:8px ${centrada ? "0" : "6px"} 22px ${centrada ? "0" : "6px"}">
      ${logoImg}
      <p style="margin:0 0 10px 0;font:400 12px/1 ${SANS};letter-spacing:.08em;text-transform:uppercase;color:#7d746a">${etiquetaEdicion}</p>
      <a href="${homeUrl}" class="brand t-main" style="font:700 32px/1.1 ${TIT};${mayus}color:${d.colorTitulos};text-decoration:none;letter-spacing:.01em">${esc(r.siteName)}</a>
      ${r.settings.headerTagline ? `<p style="margin:8px 0 0 0;font:italic 400 14px/1.3 ${SERIF};color:#7d746a">${esc(r.settings.headerTagline)}</p>` : ""}
    </td></tr>`;

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
    .col { display:block !important; width:100% !important; padding:0 0 16px 0 !important; }
    .brand { font-size:${d.masthead === "gigante" ? "46px" : "24px"} !important; }
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
<body style="margin:0;padding:0;background:${d.colorPagina}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px">${esc(r.preheader)}${"&zwnj;&nbsp;".repeat(60)}</div>
<table role="presentation" class="bg-page" width="100%" cellpadding="0" cellspacing="0" style="background:${d.colorPagina}"><tr><td align="center" style="padding:24px 12px">
  ${
    r.isTest
      ? `<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%"><tr><td style="padding:0 0 12px 0;text-align:center;font:700 12px/1.4 ${SANS};letter-spacing:.12em;text-transform:uppercase;color:#b45309">Correo de prueba · no es un envío real</td></tr></table>`
      : ""
  }
  <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%">
    ${encabezadoSencillo}
    <tr><td class="card" style="background:${d.colorTarjeta};border-radius:${radio}px;${d.franja && !conMasthead ? `border-top:${d.franja}px solid ${accent}` : ""}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${encabezado}
        <tr><td class="px" style="padding:30px 32px 6px 32px">
          <h1 class="t-main" style="margin:0 0 14px 0;font:700 13px/1.4 ${SANS};letter-spacing:.14em;text-transform:uppercase;color:${accent}">${esc(r.subject)}</h1>
          ${r.intro.trim() ? paragraphs(r.intro, `margin:0 0 14px 0;font:400 16px/1.7 ${SANS};color:${d.colorTexto}`) : ""}
        </td></tr>
        ${cuerpoNotas}
        ${cierre}
        <tr><td class="px" style="padding:36px 32px 34px 32px" align="center">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border:2px solid ${accent};border-radius:${radioBoton}">
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
  const secs = (r.secciones ?? []).filter((x) => x.articulos.length > 0);
  const grupos = secs.some((x) => x.titulo) ? secs : [{ titulo: null, articulos: r.articles }];
  let n = 0;
  for (const g of grupos) {
    if (g.titulo) parts.push(g.titulo.toUpperCase(), "");
    for (const a of g.articulos) {
      parts.push(
        `${n === 0 ? "DESTACADA · " : ""}${a.categoryName ? a.categoryName.toUpperCase() + " · " : ""}${a.title}`,
        a.excerpt,
        articleLink(a, r.issue, r.lector),
        "",
      );
      n++;
    }
  }
  parts.push(line, r.settings.legalText, `${r.siteName}${r.settings.address ? " · " + r.settings.address : ""}`, `Darme de baja: ${r.unsubscribeUrl}`);
  return parts.join("\n");
}
