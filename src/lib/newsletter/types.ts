import { EMAIL_RE } from "@/lib/validate";
import { HEX6 as HEX } from "@/lib/validate";
/** Opciones de diseño del correo. Todas con valores seguros: lo inválido se sustituye por el valor por defecto. */
export type NewsletterDesign = {
  /**
   * Maquetación de las notas: clásica (destacada + lista), editorial (foto a todo el ancho y rejilla de dos columnas), tarjetas
   * (todas en tarjetas de dos columnas), numerada (destacada + lista numerada), revista (todas con foto grande), mínima (solo titulares),
   * bloques (paneles de color alternos con foto), mosaico (destacada y baldosas de color) o dossier (columna principal y recuadro «en breve»).
   */
  plantilla: "clasica" | "editorial" | "tarjetas" | "numerada" | "revista" | "minima" | "bloques" | "mosaico" | "dossier";
  /** Tipografía de los titulares (siempre de las que traen todos los clientes de correo). */
  tipografia: "serif" | "sans" | "moderna" | "impacto";
  colorPagina: string;
  colorTarjeta: string;
  colorTitulos: string;
  colorTexto: string;
  /** Grosor en píxeles de la franja de color sobre el cuerpo (0 = sin franja). */
  franja: 0 | 4 | 8 | 12;
  esquinas: "rectas" | "suaves" | "redondas";
  boton: "pildora" | "redondo" | "recto";
  /** Texto del botón de cada nota destacada. */
  botonTexto: string;
  cabecera: "centrada" | "izquierda";
  /** Cabecera del correo: sencilla (el nombre sobre la página), banda (franja de color) o gigante (nombre enorme sobre color). */
  masthead: "sencillo" | "banda" | "gigante";
  /** Insignia redonda con el número de edición, en la banda o la cabecera gigante. */
  insignia: boolean;
  /** La nota destacada va sobre un panel del color de acento, con el texto en claro. */
  destacadaColor: boolean;
  mostrarLogo: boolean;
  mostrarFecha: boolean;
  mostrarAutor: boolean;
  mostrarSeccion: boolean;
  imagenDestacada: boolean;
  miniaturas: boolean;
  separador: "linea" | "punteada" | "ninguno";
  /** Mensaje de cierre, antes del pie (opcional). */
  cierre: string;
};

/** Diseño por defecto del boletín: editorial (foto a todo el ancho y rejilla), con los colores de siempre. */
export const DEFAULT_NEWSLETTER_DESIGN: NewsletterDesign = {
  plantilla: "editorial",
  tipografia: "serif",
  colorPagina: "#f3efe7",
  colorTarjeta: "#ffffff",
  colorTitulos: "#1c1712",
  colorTexto: "#3a342e",
  franja: 4,
  esquinas: "suaves",
  boton: "pildora",
  botonTexto: "Leer la nota completa",
  cabecera: "centrada",
  masthead: "banda",
  insignia: true,
  destacadaColor: false,
  mostrarLogo: false,
  mostrarFecha: false,
  mostrarAutor: false,
  mostrarSeccion: true,
  imagenDestacada: true,
  miniaturas: true,
  separador: "linea",
  cierre: "",
};

/**
 * Ajustes del boletín (sin "server-only": los usa también el formulario del
 * panel). Se guardan en `site_settings` con la clave `newsletter_settings`;
 * la clave del proveedor de correo va aparte y cifrada (ver settings.ts).
 */
export type NewsletterSettings = {
  /** Nombre que ve el lector como remitente. */
  fromName: string;
  /** Dirección remitente. Debe pertenecer a un dominio verificado en el proveedor. */
  fromEmail: string;
  /** A dónde llegan las respuestas de los lectores. */
  replyTo: string;
  /** Color de acento del correo (#rrggbb). */
  accentColor: string;
  /** Texto bajo el nombre del periódico en la cabecera del correo. */
  headerTagline: string;
  /** Aviso legal del pie (tratamiento de datos, identificación del remitente). */
  legalText: string;
  /** Dirección postal o ciudad, para el pie. */
  address: string;
  /** Prefijo del asunto, p. ej. «[CONtexto Ganadero]». Vacío = ninguno. */
  subjectPrefix: string;
  /** Diseño del correo. */
  design: NewsletterDesign;
};

// Ajustes por defecto del boletín.
export const DEFAULT_NEWSLETTER_SETTINGS: NewsletterSettings = {
  fromName: "CONtexto Ganadero",
  fromEmail: "",
  replyTo: "",
  accentColor: "#8a2b1f",
  headerTagline: "Periodismo del sector ganadero",
  legalText:
    "Recibes este correo porque te suscribiste al boletín y confirmaste tu dirección. Tratamos tus datos conforme a la Ley 1581 de 2012 (habeas data) y solo los usamos para enviarte este boletín. Puedes darte de baja cuando quieras con el enlace de abajo.",
  address: "Bogotá, Colombia",
  subjectPrefix: "",
  design: DEFAULT_NEWSLETTER_DESIGN,
};

// Texto limpio y recortado al máximo; vacío si el valor no es texto.
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Elige un valor de una lista permitida, o el de por defecto.
const opcion = <T extends string | number>(v: unknown, permitidos: readonly T[], def: T): T => (permitidos.includes(v as T) ? (v as T) : def);
// Color #rrggbb válido, o el de por defecto.
const color = (v: unknown, def: string) => (typeof v === "string" && HEX.test(v) ? v.toLowerCase() : def);
// Booleano, o el de por defecto.
const bool = (v: unknown, def: boolean) => (typeof v === "boolean" ? v : def);

/** Valida y limpia el diseño recibido: lo desconocido o inválido vuelve a su valor por defecto. */
export function sanitizeNewsletterDesign(input: unknown): NewsletterDesign {
  const r = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const d = DEFAULT_NEWSLETTER_DESIGN;
  return {
    plantilla: opcion(r.plantilla, ["clasica", "editorial", "tarjetas", "numerada", "revista", "minima", "bloques", "mosaico", "dossier"] as const, d.plantilla),
    tipografia: opcion(r.tipografia, ["serif", "sans", "moderna", "impacto"] as const, d.tipografia),
    colorPagina: color(r.colorPagina, d.colorPagina),
    colorTarjeta: color(r.colorTarjeta, d.colorTarjeta),
    colorTitulos: color(r.colorTitulos, d.colorTitulos),
    colorTexto: color(r.colorTexto, d.colorTexto),
    franja: opcion(r.franja, [0, 4, 8, 12] as const, d.franja),
    esquinas: opcion(r.esquinas, ["rectas", "suaves", "redondas"] as const, d.esquinas),
    boton: opcion(r.boton, ["pildora", "redondo", "recto"] as const, d.boton),
    botonTexto: str(r.botonTexto, 40) || d.botonTexto,
    cabecera: opcion(r.cabecera, ["centrada", "izquierda"] as const, d.cabecera),
    masthead: opcion(r.masthead, ["sencillo", "banda", "gigante"] as const, d.masthead),
    insignia: bool(r.insignia, d.insignia),
    destacadaColor: bool(r.destacadaColor, d.destacadaColor),
    mostrarLogo: bool(r.mostrarLogo, d.mostrarLogo),
    mostrarFecha: bool(r.mostrarFecha, d.mostrarFecha),
    mostrarAutor: bool(r.mostrarAutor, d.mostrarAutor),
    mostrarSeccion: bool(r.mostrarSeccion, d.mostrarSeccion),
    imagenDestacada: bool(r.imagenDestacada, d.imagenDestacada),
    miniaturas: bool(r.miniaturas, d.miniaturas),
    separador: opcion(r.separador, ["linea", "punteada", "ninguno"] as const, d.separador),
    cierre: str(r.cierre, 400),
  };
}

// Valida y limpia los ajustes recibidos: cada campo se recorta y lo inválido se sustituye por el valor por defecto.
export function sanitizeNewsletterSettings(input: unknown): NewsletterSettings {
  const r = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const d = DEFAULT_NEWSLETTER_SETTINGS;
  // Correo válido en minúsculas, o vacío.
  const email = (v: unknown) => (EMAIL_RE.test(str(v, 160)) ? str(v, 160).toLowerCase() : "");
  return {
    fromName: str(r.fromName, 80) || d.fromName,
    fromEmail: email(r.fromEmail),
    replyTo: email(r.replyTo),
    accentColor: typeof r.accentColor === "string" && HEX.test(r.accentColor) ? r.accentColor : d.accentColor,
    headerTagline: str(r.headerTagline, 100),
    legalText: str(r.legalText, 900) || d.legalText,
    address: str(r.address, 160),
    subjectPrefix: str(r.subjectPrefix, 40),
    design: sanitizeNewsletterDesign(r.design),
  };
}
