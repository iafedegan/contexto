import { NextResponse } from "next/server";
import { borrarSuscripcion, guardarSuscripcion } from "@/lib/push";

/**
 * Alta y baja de suscripciones push. No requiere sesión: quien se suscribe es
 * un lector anónimo, y lo único que se guarda es el punto de entrega que emite
 * su propio navegador. No hay identificador de persona en esta tabla.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const sub = (await req.json()) as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys.auth) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    await guardarSuscripcion({
      endpoint: sub.endpoint.slice(0, 1000),
      keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { endpoint } = (await req.json()) as { endpoint?: string };
    if (endpoint) await borrarSuscripcion(endpoint);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
