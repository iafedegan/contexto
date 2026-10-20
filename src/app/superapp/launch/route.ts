import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clientIp, hit } from "@/lib/rate-limit";
import { configSuperApp } from "@/lib/superapp/config";
import { intercambiarCupon, type Motivo } from "@/lib/superapp/cliente";
import { COOKIE_SUPERAPP, crearSesionLocal, revocarSesion } from "@/lib/superapp/sesion";

/**
 * Entrada de la MiniApp desde la SuperApp de FEDEGÁN: `GET /superapp/launch?code=<cupón>`.
 *
 * El cupón (`slc_…`, de un solo uso) se canjea AQUÍ, en el servidor, y la persona recibe una redirección 303 a la portada: el cupón no llega a ninguna
 * página, no queda en el historial (la redirección reemplaza la entrada), no viaja en `Referer` (`Referrer-Policy: no-referrer`) y no se imprime en los
 * registros de la aplicación (solo etapa, resultado, duración y `correlationId`). La ruta es la propuesta en la guía y está apagada mientras falte
 * configuración (ver `src/lib/superapp/config.ts`).
 */
export const dynamic = "force-dynamic";

const CABECERAS = { "cache-control": "no-store", "referrer-policy": "no-referrer", "x-robots-tag": "noindex, nofollow", "content-type": "text/html; charset=utf-8" } as const;

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
function pagina(status: number, titulo: string, mensaje: string): Response {
  const html = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="referrer" content="no-referrer"><title>${esc(titulo)}</title>
<body style="font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.25rem;color:#142019"><h1 style="font-size:1.4rem">${esc(titulo)}</h1><p>${esc(mensaje)}</p><p><a href="/">Ir a CONtexto Ganadero</a></p></body></html>`;
  return new Response(html, { status, headers: CABECERAS });
}

// Mensaje para la persona según lo que pasó (la acción de cada caso sale de la guía: «Errores y recuperación»).
const MENSAJES: Record<Motivo, [number, string]> = {
  cupon: [410, "El acceso venció o ya se usó. Ábrelo de nuevo desde FEDEGÁN."],
  rechazado: [403, "FEDEGÁN no autorizó este acceso. Ábrelo de nuevo desde FEDEGÁN."],
  credencial: [502, "No pudimos verificar tu acceso por un problema de configuración. Inténtalo más tarde."],
  peticion: [502, "No pudimos verificar tu acceso. Inténtalo más tarde."],
  respuesta: [502, "No pudimos verificar tu acceso. Ábrelo de nuevo desde FEDEGÁN."],
  servicio: [503, "No pudimos verificar tu acceso en este momento. Inténtalo de nuevo en unos minutos."],
};

export async function GET(req: Request) {
  const cfg = configSuperApp();
  if (!cfg) return pagina(503, "Acceso no disponible", "La entrada desde FEDEGÁN todavía no está habilitada.");

  const limite = await hit(`superapp:launch:${clientIp(req.headers)}`, 20, 600);
  if (!limite.allowed) return pagina(429, "Demasiados intentos", "Espera unos minutos y ábrelo de nuevo desde FEDEGÁN.");

  const code = new URL(req.url).searchParams.get("code") ?? "";
  const r = await intercambiarCupon(code, cfg);
  // Nada del cupón, de la credencial, de la referencia ni de datos personales: etapa, resultado, duración y correlación.
  console.info(`[superapp] intercambio ${r.ok ? `ok correlationId=${r.identidad.correlationId}` : `falla motivo=${r.motivo}${r.http ? ` http=${r.http}` : ""}`} ${r.ms}ms`);
  if (!r.ok) {
    const [status, mensaje] = MENSAJES[r.motivo];
    return pagina(status, "No pudimos abrir tu acceso", mensaje);
  }

  // Cambio de cuenta o nueva apertura: la sesión local anterior se invalida y se crea una con identificador nuevo.
  const jar = await cookies();
  await revocarSesion(jar.get(COOKIE_SUPERAPP)?.value);
  const { token, expiresAt } = await crearSesionLocal(r.identidad);

  const res = new NextResponse(null, { status: 303, headers: { location: "/", "cache-control": "no-store", "referrer-policy": "no-referrer", "x-robots-tag": "noindex, nofollow" } });
  res.cookies.set(COOKIE_SUPERAPP, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
  return res;
}
