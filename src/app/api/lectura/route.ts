import { NextResponse } from "next/server";
import { clientIp, hit } from "@/lib/rate-limit";
import { validarInicio, validarProgreso } from "@/lib/lectores-entrada";
import { iniciarLectura, registrarProgreso } from "@/lib/lectores-registro";

/**
 * Medición de lectura de quien aceptó (cookie `cg_med`): cómo lee una nota, no quién es. El navegador avisa al empezar
 * (`a: "i"`, devuelve el código de la lectura) y mientras avanza (`a: "p"`, hasta dónde bajó y cuántos segundos).
 *
 * Qué NO hace: no lee ni guarda la IP (solo la usa como clave del límite de uso, que se purga cada día) ni el
 * `User-Agent` (solo lo clasifica). La ciudad y el departamento vienen de las cabeceras de geolocalización de Vercel.
 * Los límites frenan la inflación: una lectura de la misma nota por visitante cada media hora y un tope por IP.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const accion = (cuerpo as { a?: unknown })?.a;
  const ip = clientIp(req.headers);
  if (!(await hit(`lectura:ip:${ip}`, 900, 3600)).allowed) return NextResponse.json({ ok: true });

  try {
    if (accion === "i") {
      const e = validarInicio(cuerpo);
      if (!e) return NextResponse.json({ ok: false }, { status: 400 });
      if (!(await hit(`lectura:v:${e.visitante}:${e.slug}`, 1, 1800)).allowed) return NextResponse.json({ ok: true });
      const h = req.headers;
      const id = await iniciarLectura(e, {
        userAgent: h.get("user-agent"),
        pais: h.get("x-vercel-ip-country"),
        region: h.get("x-vercel-ip-country-region"),
        ciudad: h.get("x-vercel-ip-city"),
        host: new URL(req.url).hostname,
      });
      return NextResponse.json({ ok: true, id });
    }
    if (accion === "p") {
      const e = validarProgreso(cuerpo);
      if (!e) return NextResponse.json({ ok: false }, { status: 400 });
      return NextResponse.json({ ok: await registrarProgreso(e) });
    }
  } catch {
    // Un fallo de la medición nunca debe afectar la lectura.
    return NextResponse.json({ ok: false });
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}
