import { NextResponse } from "next/server";
import { clientIp, hit } from "@/lib/rate-limit";
import { aPuntos, clasificar, sanearIntereses } from "@/lib/interes";
import { armarBloques, perfilDelVisitante } from "@/lib/para-ti";
import { textosParaTi, type Respuesta } from "@/lib/para-ti-tipos";

/**
 * El espacio «para ti» de la barra lateral. Solo responde con contenido a un navegador que aceptó la medición (cookies `cg_med=si` y su
 * código anónimo `cg_vid`) y, además, o bien pidió personalizar (`cg_per=si`) o bien está vinculado a un suscriptor que autorizó
 * relacionar lo que lee con su suscripción y no dijo que no (`cg_per=no`). Sin eso, devuelve `activo: false` (y a veces `ofrecer`, para
 * que el espacio le proponga activarlo). Nunca devuelve más que el nombre de pila de la persona vinculada, y nada se guarda.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 15;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIN_CACHE = { "Cache-Control": "private, no-store", Vary: "Cookie" };
/** Consultas por IP y hora: la página la pide una vez por visita. */
const MAX_POR_IP_HORA = 240;

// Una cookie de la petición por su nombre.
const galleta = (cabecera: string | null, nombre: string) => cabecera?.match(new RegExp(`(?:^|;\\s*)${nombre}=([^;]*)`))?.[1];
const responder = (r: Respuesta) => NextResponse.json(r, { headers: SIN_CACHE });

// Arma lo que le interesa a este navegador: su perfil (servidor) y sus visitas al Observatorio y a las secciones (que manda el navegador).
export async function POST(req: Request) {
  const cookies = req.headers.get("cookie");
  const visitante = decodeURIComponent(galleta(cookies, "cg_vid") ?? "");
  if (galleta(cookies, "cg_med") !== "si" || !UUID.test(visitante)) return responder({ activo: false });

  const limite = await hit(`para-ti:ip:${clientIp(req.headers)}`, MAX_POR_IP_HORA, 3600);
  if (!limite.allowed) return responder({ activo: false });

  let cuerpo: { locale?: unknown; intereses?: unknown } = {};
  try {
    cuerpo = (await req.json()) as typeof cuerpo;
  } catch {
    /* sin cuerpo: se personaliza solo con lo que el servidor sabe */
  }
  const locale = cuerpo.locale === "en" ? "en" : "es";
  const ahora = Date.now();

  const perfil = await perfilDelVisitante(visitante);
  const decision = galleta(cookies, "cg_per");
  // Sí: lo pidió, o está vinculado a un suscriptor que autorizó (y no dijo que no). No: lo rechazó. Sin decidir: se le puede ofrecer.
  if (decision === "no") return responder({ activo: false });
  if (decision !== "si" && !perfil.vinculado) return responder({ activo: false, ofrecer: true });

  const ranking = clasificar(aPuntos(sanearIntereses(cuerpo.intereses, ahora), ahora), perfil.categorias);
  const bloques = await armarBloques(ranking, { locale, leidas: perfil.leidas });
  return responder({ activo: true, nombre: perfil.nombre, vinculado: perfil.vinculado, bloques, textos: textosParaTi(locale, perfil.nombre) });
}
