/**
 * Cómo se muestra el HTML de una creatividad publicitaria (hallazgo H-26).
 *
 * Las etiquetas de los anunciantes (Google Ad Manager, redes de afiliados…) son HTML con JavaScript, y por eso el panel
 * admite HTML sin filtrar: es una decisión, no un descuido. Solo la edita un administrador (todas las acciones de
 * `ads-actions.ts` exigen ese rol, y una prueba lo comprueba). Para que una cuenta de administrador comprometida, o un
 * anunciante que cambie su etiqueta, NO pueda ejecutar código con el origen del sitio, la creatividad no se inyecta en
 * la página: se muestra dentro de un `<iframe sandbox>` con un documento propio (`srcdoc`). El sandbox tiene origen
 * opaco —sin acceso al DOM, las cookies ni el almacenamiento del sitio— y NO permite navegar la página principal
 * (`allow-top-navigation` ausente: una etiqueta maliciosa no puede redirigir a los lectores), ni enviar formularios, ni
 * abrir diálogos. Sí permite ejecutar scripts y abrir el anuncio en una pestaña nueva con normalidad. Además la CSP del
 * sitio (src/lib/csp.ts) se hereda en el documento y solo deja cargar scripts de los orígenes autorizados.
 *
 * Es una función pura y sin servidor para poder probarla.
 */

/** Permisos del sandbox: lo mínimo que necesita un anuncio. Nunca `allow-same-origin` ni `allow-top-navigation`. */
export const SANDBOX_ANUNCIO = "allow-scripts allow-popups allow-popups-to-escape-sandbox";

/** Documento completo que va en `srcdoc`: sin márgenes, los enlaces se abren en pestaña nueva y las imágenes se ajustan al ancho. */
export function documentoPublicitario(html: string): string {
  return [
    "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"referrer\" content=\"no-referrer\">",
    "<base target=\"_blank\">",
    "<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}img,video,iframe{max-width:100%}img,video{height:auto}</style>",
    `</head><body>${html}</body></html>`,
  ].join("");
}
