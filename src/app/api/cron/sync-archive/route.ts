import { NextResponse } from "next/server";
import { syncArchiveIndex } from "@/lib/archive-client";
import { cronAutorizado } from "@/lib/cron-auth";

/**
 * Job periódico de sincronización del archivo histórico (SOLO LECTURA). Programado en vercel.json (a diario).
 * Protegido con CRON_SECRET.
 *
 * La sincronización es REANUDABLE: el cursor se guarda tras cada página (ver `src/lib/archive-client.ts`), así que
 * la carga completa de ~41.000 notas, que no cabe en una ejecución, se completa en varias. Cada llamada avanza todo lo
 * que cabe en 240 s y responde `completa: false` mientras falte; basta con volver a llamarla (el cron del día
 * siguiente, o a mano). Parámetros: `?full=1` fuerza (o sigue) una pasada completa de todo el archivo y `?reiniciar=1`
 * descarta la que esté a medias.
 */
export const maxDuration = 300;

// Sincroniza el índice del archivo: lo actualizado desde la última vez, o todo con full=1. Exige el secreto del cron.
export async function GET(req: Request) {
  if (!cronAutorizado(req)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  try {
    const result = await syncArchiveIndex({
      full: url.searchParams.get("full") === "1",
      reiniciar: url.searchParams.get("reiniciar") === "1",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("sync-archive falló", e);
    // Solo el mensaje propio (el código de estado de la API origen): nunca el cuerpo de una respuesta ajena.
    return NextResponse.json({ ok: false, error: (e as Error)?.message?.slice(0, 200) ?? "error" }, { status: 500 });
  }
}
