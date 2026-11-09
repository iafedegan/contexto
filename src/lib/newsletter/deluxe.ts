/**
 * Piezas de marca del estilo «Deluxe» de CONtexto Ganadero Media (jade, marfil y oro), compartidas por el boletín (maquetación y cabecera
 * «gala») y por el correo de confirmación de la suscripción. Sin `server-only`. Todo es HTML de correo: tablas y estilos en línea, sin
 * glifos raros (los ornamentos son celdas de color, que se ven igual en todos los clientes).
 */
import { escapeHtml } from "@/lib/escape";

/** Oro claro del nombre de la marca sobre jade (el degradado de la cabecera del sitio no existe en correo: aquí, un tono sólido). */
export const ORO_CLARO = "#dcc07a";
/** Dirección (relativa al sitio) del emblema dorado de la marca: la «C» con el botón de reproducir, en PNG para correo. */
export const RUTA_EMBLEMA_ORO = "/logo/contexto-media-emblema-oro.png";

/**
 * El nombre de la marca con el emblema haciendo de inicial: «[C]ONtexto Ganadero Media». La imagen lleva la letra como texto alternativo,
 * así que si el cliente de correo bloquea imágenes se sigue leyendo «CONtexto Ganadero Media». Con un nombre que no empieza por «C», solo texto.
 * `tam` = tamaño de letra en píxeles; en móvil la imagen sigue al texto con la clase `brand` (ver el CSS de cada correo).
 */
export function marcaConEmblema(nombre: string, urlEmblema: string, tam: number): string {
  const limpio = nombre.trim().replace(/\s+/g, " ");
  if (!/^c/i.test(limpio)) return escapeHtml(limpio);
  const alto = Math.round(tam * 1.12);
  const ancho = Math.round(alto * 0.86);
  return `<img src="${escapeHtml(urlEmblema)}" width="${ancho}" height="${alto}" alt="${escapeHtml(limpio[0])}" style="display:inline-block;width:${ancho}px;height:${alto}px;border:0;vertical-align:-${Math.round(tam * 0.2)}px;margin:0 -2px 0 0">${escapeHtml(limpio.slice(1))}`;
}

/** Oro de los filetes y ornamentos sobre fondo oscuro. */
export const ORO = "#b8975a";
/** Marfil del cuerpo del correo y del texto claro sobre jade. */
export const MARFIL = "#fbf8f1";
/** Jade profundo de las cabeceras y botones. */
export const JADE = "#10261e";
/** Jade más oscuro todavía: el fondo de la página alrededor del correo. */
export const JADE_PROFUNDO = "#0a1f19";
/** Oro oscuro para texto pequeño sobre marfil (contraste suficiente). */
export const ORO_TEXTO = "#8c6a2f";

/**
 * Parte el nombre de la marca para la cabecera: «CONtexto Ganadero Media» → «CONtexto Ganadero» y «Media» (esa palabra va aparte, en
 * versalitas doradas). Con cualquier otro nombre, todo es la marca y no hay línea aparte.
 */
export function partirMarca(nombre: string): { principal: string; sub: string } {
  const limpio = nombre.trim().replace(/\s+/g, " ");
  const m = /^(.+?)\s+(media)$/i.exec(limpio);
  return m ? { principal: m[1], sub: m[2] } : { principal: limpio, sub: "" };
}

/** Línea fina de color de ancho fijo, centrada en la altura de su celda (para flanquear un texto). */
const linea = (ancho: number, color: string) =>
  `<td width="${ancho}" valign="middle" style="width:${ancho}px;padding:0"><div style="height:1px;line-height:1px;font-size:0;background:${color}">&nbsp;</div></td>`;

/**
 * Texto en versalitas con una línea fina a cada lado: «——  MEDIA  ——». El espaciado de letras deja un hueco tras la última letra; se
 * compensa con más relleno a la izquierda (en píxeles: `calc()` no lo admiten todos los clientes de correo) para que quede centrado.
 */
export function rotuloFlanqueado(texto: string, color: string, colorLinea: string, tam = 11, ancho = 34): string {
  const hueco = Math.round(tam * 0.3);
  return `<table role="presentation" align="center" cellpadding="0" cellspacing="0"><tr>${linea(ancho, colorLinea)}<td align="center" style="padding:0 14px 0 ${14 + hueco}px;font:700 ${tam}px/1.3 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;letter-spacing:.3em;text-transform:uppercase;color:${color};white-space:nowrap">${texto}</td>${linea(ancho, colorLinea)}</tr></table>`;
}

/** Ornamento: una línea fina a cada lado de un pequeño cuadrado de color. */
export function ornamento(color: string, ancho = 56): string {
  return `<table role="presentation" align="center" cellpadding="0" cellspacing="0"><tr>${linea(ancho, color)}<td width="9" style="width:9px;padding:0 6px"><div style="width:5px;height:5px;line-height:5px;font-size:0;background:${color}">&nbsp;</div></td>${linea(ancho, color)}</tr></table>`;
}

/** Doble filete (uno grueso y otro fino) de ancho completo, como en las cabeceras de periódico de gala. */
export function dobleFilete(color: string): string {
  return `<div style="height:1px;line-height:1px;font-size:0;background:${color}">&nbsp;</div><div style="height:3px;line-height:3px;font-size:0">&nbsp;</div><div style="height:1px;line-height:1px;font-size:0;background:${color}">&nbsp;</div>`;
}
