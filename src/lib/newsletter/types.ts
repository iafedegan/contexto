import { EMAIL_RE } from "@/lib/validate";
import { HEX6 as HEX } from "@/lib/validate";
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
};

// Texto limpio y recortado al máximo; vacío si el valor no es texto.
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

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
  };
}
