import { guardApi, json, CORS_HEADERS } from "@/lib/api/guard";
import { solicitarAlta } from "@/lib/newsletter/alta";
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

  // Mismas reglas que el formulario del sitio (ver src/lib/newsletter/alta.ts).
  const alta = await solicitarAlta(email);
  if (alta.estado === "ya_suscrito") return json({ ok: true, estado: "ya_confirmado" });
  if (alta.enviar) await sendConfirmationEmail(email, alta.token).catch(() => false);
  return json({ ok: true, estado: "pendiente_de_confirmar" }, { status: 201 });
}

// Respuesta a la comprobación previa de CORS de los navegadores.
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
