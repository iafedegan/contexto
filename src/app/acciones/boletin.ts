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

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { newsletterSubscribers } from "@/db/schema";
import { clientIp, hit } from "@/lib/rate-limit";
import { verifyHuman } from "@/lib/turnstile";
import { sendConfirmationEmail } from "@/lib/newsletter/confirm";
import { solicitarAlta } from "@/lib/newsletter/alta";
import { reverseGeocode, sourceFromAccuracy, validAccuracy, validCoords } from "@/lib/geo-reverse";
import { EMAIL_RE, fechaNacimientoValida } from "@/lib/validate";

// Estado que se devuelve al formulario: si salió bien y el mensaje.
export type BoletinState = { ok: boolean; message: string } | null;

// Acción del formulario de suscripción: aplica las defensas (campo trampa, límites, verificación humana), guarda los datos y envía el correo de confirmación.
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

  // Los datos completos solo los pide el formulario largo (/boletin); el
  // widget compacto de la barra lateral sigue siendo solo-correo.
  const firstName = String(formData.get("firstName") ?? "").trim().slice(0, 120) || null;
  const lastName = String(formData.get("lastName") ?? "").trim().slice(0, 120) || null;
  const birthDate = fechaNacimientoValida(String(formData.get("birthDate") ?? "").trim());
  const mobile = String(formData.get("mobile") ?? "").trim().slice(0, 40) || null;

  // Trazabilidad interna (nunca se le muestra al suscriptor): Vercel ya
  // resuelve la ciudad a partir de la IP en el borde, sin llamar a un
  // servicio externo ni guardar más que lo que la cabecera trae.
  const h = await headers();
  const signupCity = h.get("x-vercel-ip-city") ? decodeURIComponent(h.get("x-vercel-ip-city")!) : null;
  const signupCountry = h.get("x-vercel-ip-country");
  const signupPostal = h.get("x-vercel-ip-postal-code") ? decodeURIComponent(h.get("x-vercel-ip-postal-code")!).slice(0, 20) : null;
  let signupLat: string | null = h.get("x-vercel-ip-latitude");
  let signupLon: string | null = h.get("x-vercel-ip-longitude");
  let signupGeoSource: "ip" | "gps" | "red" = "ip";
  let signupGeoAccuracy: string | null = null;
  let neighborhood: string | null = null;
  let postal = signupPostal;

  // Ubicación precisa: solo si la persona la autorizó en el aviso del sitio.
  // El navegador la saca del GPS o, en su defecto, de redes Wi-Fi y antenas;
  // la precisión que informa decide cuál fue ("gps" o "red"). Reemplaza a la IP.
  const g = validCoords(formData.get("geoLat"), formData.get("geoLon"));
  if (g) {
    const acc = validAccuracy(formData.get("geoAcc"));
    signupLat = g.lat.toFixed(6);
    signupLon = g.lon.toFixed(6);
    signupGeoSource = sourceFromAccuracy(acc);
    signupGeoAccuracy = acc === null ? null : String(acc);
    const rev = await reverseGeocode(g.lat, g.lon);
    neighborhood = rev.neighborhood;
    postal = rev.postal ?? postal;
  }

  try {
    // Un solo sitio decide qué pasa con la dirección (ver src/lib/newsletter/alta.ts): ya suscrita no cambia nada ni lo
    // revela; quien se dio de baja confirma de nuevo; una alta pendiente conserva su token y sus datos y solo completa
    // lo que estaba vacío; y cada dirección recibe como mucho 3 correos de confirmación por hora.
    const alta = await solicitarAlta(email, {
      firstName,
      lastName,
      birthDate,
      mobile,
      signupPostal: postal,
      neighborhood,
      signupGeoSource,
      signupGeoAccuracy,
      signupIp: ip,
      signupCity,
      signupCountry,
      signupLat,
      signupLon,
    });
    // El correo de confirmación sale en cuanto hay proveedor configurado. Un fallo al enviarlo no debe romper el alta:
    // queda pendiente y trazable. La respuesta es la misma de siempre, para no revelar nada.
    if (alta.estado === "pendiente" && alta.enviar) await sendConfirmationEmail(email, alta.token).catch(() => false);
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

/**
 * Confirma la suscripción (segundo paso del doble opt-in). Es una acción del servidor (POST): solo la dispara la persona
 * al pulsar el botón de /boletin/confirmar, nunca un servicio que abra el enlace del correo con un GET (H-10). Con la
 * confirmación, además, se borra la IP del alta: ya no hace falta (ver `src/lib/newsletter/retencion.ts`).
 */
export async function confirmarSuscripcion(formData: FormData): Promise<void> {
  const token = String(formData.get("t") ?? "");
  if (token.length < 16 || token.length > 80) redirect("/boletin/confirmar");
  const ip = clientIp(await headers());
  if ((await hit(`boletin:confirmar:${ip}`, 20, 60 * 60)).allowed) {
    await db
      .update(newsletterSubscribers)
      .set({ confirmed: true, unsubscribedAt: null, signupIp: null })
      .where(eq(newsletterSubscribers.confirmToken, token));
  }
  redirect(`/boletin/confirmar?t=${encodeURIComponent(token)}`);
}
