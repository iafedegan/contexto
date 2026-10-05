"use server";

/**
 * Recepción de los formularios públicos (contacto y pauta).
 *
 * Controles, en el orden en que se aplican (RT-10 / OWASP):
 *  1. Campo trampa invisible: descarta bots que rellenan todo el formulario.
 *  2. Tiempo mínimo desde que se pintó el formulario: un envío en menos de
 *     dos segundos no lo ha escrito una persona.
 *  3. Límite por IP y ventana (en Postgres, común a todas las instancias).
 *  4. Verificación humana con Cloudflare Turnstile, si hay claves.
 *  5. Validación y recorte de longitudes antes de tocar la base de datos.
 */

import { headers } from "next/headers";
import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import { clientIp, hit } from "@/lib/rate-limit";
import { verifyHuman } from "@/lib/turnstile";
import { EMAIL_RE } from "@/lib/validate";

// Estado que se devuelve al formulario: si salió bien y el mensaje.
export type ContactState = { ok: boolean; message: string } | null;

// Largo máximo de cada campo.
const MAX = { name: 120, email: 160, organization: 160, subject: 160, message: 4000 };

// Acción de los formularios de contacto y pauta: aplica las defensas, valida y guarda el mensaje.
export async function enviarMensaje(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const es = String(formData.get("locale") ?? "es") === "es";
  // Respuesta de error en el idioma de la persona.
  const error = (esMsg: string, enMsg: string) => ({ ok: false, message: es ? esMsg : enMsg });

  // 1. Campo trampa: invisible para una persona, irresistible para un bot.
  if (String(formData.get("website") ?? "")) {
    return { ok: true, message: es ? "Mensaje enviado." : "Message sent." };
  }

  // 2. Tiempo mínimo de cumplimentación.
  const t0 = Number(formData.get("t0") ?? 0);
  if (Number.isFinite(t0) && t0 > 0 && Date.now() - t0 < 2000) {
    return error("El formulario se envió demasiado rápido. Inténtalo de nuevo.", "The form was submitted too fast. Please try again.");
  }

  // 3. Límite por IP.
  const ip = clientIp(await headers());
  if (!(await hit(`contacto:ip:${ip}`, 5, 10 * 60)).allowed) {
    return error("Demasiados envíos seguidos. Prueba en unos minutos.", "Too many submissions. Try again in a few minutes.");
  }
  if (!(await verifyHuman(String(formData.get("cf-turnstile-response") ?? ""), ip))) {
    return error("Confirma que eres una persona e inténtalo de nuevo.", "Please confirm you are human and try again.");
  }

  // 4. Validación.
  const kind = String(formData.get("kind") ?? "contacto") === "comercial" ? "comercial" : "contacto";
  const name = String(formData.get("name") ?? "").trim().slice(0, MAX.name);
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, MAX.email);
  const organization = String(formData.get("organization") ?? "").trim().slice(0, MAX.organization) || null;
  const subject = String(formData.get("subject") ?? "").trim().slice(0, MAX.subject) || null;
  const message = String(formData.get("message") ?? "").trim().slice(0, MAX.message);

  if (name.length < 2) return error("Escribe tu nombre.", "Please enter your name.");
  if (!EMAIL_RE.test(email)) return error("Revisa el correo electrónico.", "Please check the email address.");
  if (message.length < 10) return error("Cuéntanos un poco más en el mensaje.", "Please tell us a bit more.");

  try {
    await db.insert(contactMessages).values({ kind, name, email, organization, subject, message });
  } catch {
    return error("No se pudo registrar el mensaje. Inténtalo más tarde.", "The message could not be saved. Please try later.");
  }

  return {
    ok: true,
    message: es
      ? "Mensaje recibido. La redacción responde en días hábiles."
      : "Message received. The newsroom replies on business days.",
  };
}
