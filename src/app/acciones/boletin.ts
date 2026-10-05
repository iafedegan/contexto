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
import { reverseGeocode, sourceFromAccuracy, validAccuracy, validCoords } from "@/lib/geo-reverse";

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

  // Los datos completos solo los pide el formulario largo (/boletin); el
  // widget compacto de la barra lateral sigue siendo solo-correo.
  const firstName = String(formData.get("firstName") ?? "").trim().slice(0, 120) || null;
  const lastName = String(formData.get("lastName") ?? "").trim().slice(0, 120) || null;
  const birthDate = String(formData.get("birthDate") ?? "").trim() || null;
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
    const [existente] = await db
      .select({
        id: newsletterSubscribers.id,
        confirmed: newsletterSubscribers.confirmed,
        unsubscribedAt: newsletterSubscribers.unsubscribedAt,
      })
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, email))
      .limit(1);

    // «Ya suscrito» es confirmado Y sin baja. Quien se dio de baja conserva `confirmed = true`, y antes
    // eso lo dejaba sin poder volver: el formulario decía «revisa tu correo» y no enviaba nada.
    if (existente?.confirmed && !existente.unsubscribedAt) {
      // No se confirma ni se niega nada distinto: quien pregunta no debe poder
      // averiguar si una dirección ya está suscrita.
      return {
        ok: true,
        message: es ? "Listo. Revisa tu correo para confirmar." : "Done. Check your inbox to confirm.",
      };
    }

    const confirmToken = randomUUID();
    const datos = {
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
    };
    // Un mismo destinatario no recibe más de 3 correos de confirmación por hora, venga de la IP que venga:
    // sin esto, cualquiera podía llenar de correos la bandeja de una persona ajena. La respuesta es la
    // misma de siempre, para no revelar nada.
    const puedeEnviar = (await hit(`boletin:correo:${email}`, 3, 60 * 60)).allowed;
    if (existente) {
      // Quien vuelve tras una baja debe confirmar de nuevo (doble opt-in): hasta entonces no recibe nada.
      // Solo se actualizan los datos que esta vez sí llegaron: el widget compacto trae solo el correo y no
      // debe borrar el nombre o el celular de una alta anterior.
      const nuevos = Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== null && v !== undefined));
      if (puedeEnviar) {
        await db
          .update(newsletterSubscribers)
          .set({ confirmToken, confirmed: false, unsubscribedAt: null, ...nuevos })
          .where(eq(newsletterSubscribers.id, existente.id));
      }
    } else {
      await db.insert(newsletterSubscribers).values({ email, confirmToken, ...datos });
    }
    // El correo de confirmación sale en cuanto hay proveedor configurado. Un
    // fallo al enviarlo no debe romper el alta: queda pendiente y trazable.
    if (puedeEnviar) await sendConfirmationEmail(email, confirmToken).catch(() => false);
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
