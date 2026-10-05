import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { newsletterSubscribers } from "@/db/schema";
import { guardApi, json, CORS_HEADERS } from "@/lib/api/guard";
import { hit } from "@/lib/rate-limit";
import { sendConfirmationEmail } from "@/lib/newsletter/confirm";
import { EMAIL_RE } from "@/lib/validate";

// Se calcula en cada petición, nunca durante la compilación.
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/boletin/suscripcion — alta al boletín para integraciones de
 * terceros (su propio formulario, su propia app). Mismo doble opt-in que el
 * formulario del sitio: nadie recibe nada hasta confirmar por correo.
 */
export async function POST(req: Request) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request", message: "Cuerpo inválido: se esperaba JSON." }, { status: 400 });
  }
  const email = String((body as { email?: unknown })?.email ?? "").trim().toLowerCase().slice(0, 160);
  if (!EMAIL_RE.test(email)) {
    return json({ error: "bad_request", message: "Correo inválido." }, { status: 400 });
  }

  const [existente] = await db
    .select({
      id: newsletterSubscribers.id,
      confirmed: newsletterSubscribers.confirmed,
      unsubscribedAt: newsletterSubscribers.unsubscribedAt,
    })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, email))
    .limit(1);

  // Confirmado y sin baja = ya suscrito. Quien se dio de baja puede volver, pero debe confirmar otra vez.
  if (existente?.confirmed && !existente.unsubscribedAt) return json({ ok: true, estado: "ya_confirmado" });

  // Como máximo 3 correos de confirmación por hora a una misma dirección (evita usar la API para saturar un buzón).
  if (!(await hit(`boletin:correo:${email}`, 3, 60 * 60)).allowed) {
    return json({ ok: true, estado: "pendiente_de_confirmar" }, { status: 201 });
  }

  const confirmToken = randomUUID();
  if (existente) {
    await db
      .update(newsletterSubscribers)
      .set({ confirmToken, confirmed: false, unsubscribedAt: null })
      .where(eq(newsletterSubscribers.id, existente.id));
  } else {
    await db.insert(newsletterSubscribers).values({ email, confirmToken });
  }
  await sendConfirmationEmail(email, confirmToken).catch(() => false);
  return json({ ok: true, estado: "pendiente_de_confirmar" }, { status: 201 });
}

// Respuesta a la comprobación previa de CORS de los navegadores.
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
