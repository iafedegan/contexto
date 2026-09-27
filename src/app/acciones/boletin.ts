"use server";

/**
 * Alta en el boletín (FM-02) con doble confirmación.
 *
 * El alta queda `confirmed = false` y con un token: mientras nadie confirme,
 * esa dirección no recibe nada. Es lo que impide que un tercero suscriba a
 * alguien sin su permiso, y lo que exige cualquier proveedor de envío serio.
 *
 * El correo de confirmación lo enviará el proveedor que se conecte en
 * producción (Mailchimp, ConvertKit o SMTP propio); aquí queda registrado y
 * trazable el consentimiento.
 */

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { newsletterSubscribers } from "@/db/schema";
import { headers } from "next/headers";
import { clientIp, hit } from "@/lib/rate-limit";
import { verifyHuman } from "@/lib/turnstile";
import { sendConfirmationEmail } from "@/lib/newsletter/confirm";

export type BoletinState = { ok: boolean; message: string } | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function suscribirBoletin(
  _prev: BoletinState,
  formData: FormData,
): Promise<BoletinState> {
  const es = String(formData.get("locale") ?? "es") === "es";

  // Campo trampa, igual que en los formularios institucionales.
  if (String(formData.get("website") ?? "")) {
    return { ok: true, message: es ? "Revisa tu correo." : "Check your inbox." };
  }

  const ip = clientIp(await headers());
  if (!(await hit(`boletin:ip:${ip}`, 5, 60 * 60)).allowed) {
    return { ok: false, message: es ? "Demasiados intentos. Prueba más tarde." : "Too many attempts. Try later." };
  }
  if (!(await verifyHuman(String(formData.get("cf-turnstile-response") ?? ""), ip))) {
    return { ok: false, message: es ? "Confirma que eres una persona." : "Please confirm you are human." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 160);
  if (!EMAIL_RE.test(email)) {
    return { ok: false, message: es ? "Revisa la dirección de correo." : "Please check the email address." };
  }

  try {
    const [existente] = await db
      .select({ id: newsletterSubscribers.id, confirmed: newsletterSubscribers.confirmed })
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, email))
      .limit(1);

    if (existente?.confirmed) {
      // No se confirma ni se niega nada distinto: quien pregunta no debe poder
      // averiguar si una dirección ya está suscrita.
      return {
        ok: true,
        message: es ? "Listo. Revisa tu correo para confirmar." : "Done. Check your inbox to confirm.",
      };
    }

    const confirmToken = randomUUID();
    if (existente) {
      await db
        .update(newsletterSubscribers)
        .set({ confirmToken, unsubscribedAt: null })
        .where(eq(newsletterSubscribers.id, existente.id));
    } else {
      await db.insert(newsletterSubscribers).values({ email, confirmToken });
    }
    // El correo de confirmación sale en cuanto hay proveedor configurado. Un
    // fallo al enviarlo no debe romper el alta: queda pendiente y trazable.
    await sendConfirmationEmail(email, confirmToken).catch(() => false);
  } catch {
    return {
      ok: false,
      message: es ? "No se pudo registrar la suscripción." : "The subscription could not be saved.",
    };
  }

  return {
    ok: true,
    message: es ? "Listo. Revisa tu correo para confirmar." : "Done. Check your inbox to confirm.",
  };
}
