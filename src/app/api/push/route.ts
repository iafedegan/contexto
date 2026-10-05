import { NextResponse } from "next/server";
import { clientIp, hit } from "@/lib/rate-limit";
import { borrarSuscripcion, clavesPushValidas, endpointPushValido, guardarSuscripcion } from "@/lib/push";

/**
 * Alta y baja de suscripciones push. No requiere sesión: quien se suscribe es
 * un lector anónimo, y lo único que se guarda es el punto de entrega que emite
 * su propio navegador. No hay identificador de persona en esta tabla.
 */
export const dynamic = "force-dynamic";

/** Altas y bajas por IP y hora: un navegador real se suscribe una vez; esto frena el relleno masivo de la tabla. */
const LIMITE_POR_HORA = 60;

// Alta de una suscripción push, con validación del endpoint y límite por IP.
export async function POST(req: Request) {
  try {
    const ip = clientIp(req.headers);
    if (!(await hit(`push:ip:${ip}`, LIMITE_POR_HORA, 60 * 60)).allowed) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }
    const sub = (await req.json()) as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys.auth) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    // Solo endpoints https de los servicios push de los navegadores: el servidor hará peticiones a ellos.
    const keys = { p256dh: sub.keys.p256dh, auth: sub.keys.auth };
    if (!endpointPushValido(sub.endpoint) || !clavesPushValidas(keys)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    await guardarSuscripcion({ endpoint: sub.endpoint, keys });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

// Baja de una suscripción push.
export async function DELETE(req: Request) {
  try {
    if (!(await hit(`push:ip:${clientIp(req.headers)}`, LIMITE_POR_HORA, 60 * 60)).allowed) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }
    const { endpoint } = (await req.json()) as { endpoint?: string };
    if (endpoint) await borrarSuscripcion(endpoint);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
