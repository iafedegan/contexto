import "server-only";
import sanitizeHtml from "sanitize-html";

/**
 * Limpieza del HTML de las notas (cuerpo). Se aplica al GUARDAR y al PINTAR:
 * lo que no esté en esta lista blanca —scripts, manejadores `on*`, estilos en
 * línea, `javascript:`, iframes de dominios ajenos— desaparece. Así ni una
 * cuenta de redactor comprometida ni un texto pegado con código oculto pueden
 * ejecutar nada en el navegador de los lectores (XSS almacenado).
 */

/** Únicos orígenes de vídeo incrustable (ver src/lib/embeds.ts). */
const IFRAME_HOSTS = ["www.youtube-nocookie.com", "player.vimeo.com"];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr", "h2", "h3", "h4",
    "strong", "b", "em", "i", "u", "s", "sub", "sup", "mark", "small",
    "a", "ul", "ol", "li", "blockquote", "q", "cite", "code", "pre",
    "figure", "figcaption", "img", "video", "source", "iframe",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
    "span", "div", "details", "summary",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    video: ["src", "controls", "playsinline", "preload", "poster", "width", "height"],
    source: ["src", "type"],
    iframe: ["src", "title", "loading", "allow", "allowfullscreen", "referrerpolicy", "width", "height"],
    th: ["colspan", "rowspan", "scope"],
    td: ["colspan", "rowspan"],
    figure: ["class", "data-chart"],
    span: ["class"],
    div: ["class"],
  },
  allowedClasses: { figure: ["lx-embed", "lx-chart"], span: ["*"], div: ["*"] },
  allowedSchemes: ["https", "http", "mailto", "tel"],
  allowedSchemesByTag: { img: ["https", "http", "data"], video: ["https", "http"], source: ["https", "http"] },
  allowProtocolRelative: false,
  allowedIframeHostnames: IFRAME_HOSTS,
  allowIframeRelativeUrls: false,
  transformTags: {
    // Enlaces externos: que la página destino no pueda manipular la nuestra.
    a: (tagName, attribs) => {
      const external = /^https?:\/\//i.test(attribs.href ?? "");
      return {
        tagName,
        attribs: external
          ? { ...attribs, rel: "noopener noreferrer", ...(attribs.target ? { target: "_blank" } : {}) }
          : attribs,
      };
    },
  },
};

export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html ?? "", OPTIONS);
}

/** Texto plano sin etiquetas (títulos, resúmenes). */
export function stripHtml(text: string): string {
  return sanitizeHtml(text ?? "", { allowedTags: [], allowedAttributes: {} });
}
