/**
 * Escape de texto para insertarlo en HTML, XML o en los mensajes de Telegram. Un solo sitio: antes había nueve
 * copias casi iguales repartidas por el proyecto. Sin `server-only`: lo usan tanto el servidor como el navegador.
 */

// Reemplazo de cada carácter especial por su entidad (apóstrofo como referencia numérica, válida en HTML y XML).
const ENTIDADES_HTML: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
// Igual, pero con la entidad con nombre del apóstrofo que se usa en los feeds XML.
const ENTIDADES_XML: Record<string, string> = { ...ENTIDADES_HTML, "'": "&apos;" };

/** Escapa & < > " ' : seguro para texto y para atributos entre comillas simples o dobles. */
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ENTIDADES_HTML[c]!);

/** Igual que `escapeHtml`, con `&apos;` para el apóstrofo (feeds RSS y mapas del sitio). */
export const escapeXml = (s: string) => s.replace(/[&<>"']/g, (c) => ENTIDADES_XML[c]!);

/** Escapa solo & < > : para texto que luego se procesa (enlaces) o para el modo HTML de Telegram. */
export const escapeMinimo = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
