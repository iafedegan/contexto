import { NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/cron-auth";
import { procesarProgramadas } from "@/lib/scheduled";
import { syncMarketData } from "@/lib/sync-market-data";
import { purgarVencidos } from "@/lib/mantenimiento";

/**
 * Publica las notas «programado» cuya hora ya llegó y refresca el sitio. Toda la lógica vive en
 * `procesarProgramadas` (un solo sitio: cambia el estado, revalida portada, sitemap, feed, nota, categoría y autor, y
 * avisa a los lectores), y la ejecutan también el aviso del navegador (`/api/programadas`) y, con
 * `?solo=programados`, un programador externo cada minuto (p. ej. Supabase pg_cron).
 *
 * Corre a diario desde vercel.json. Aprovecha para refrescar TRM/petróleo (franja económica, H-06) y para el
 * mantenimiento de datos (límites vencidos, retención de datos de suscriptores): el plan Hobby solo permite 2 cron jobs
 * y ya están ocupados, así que se suben aquí una vez al día. Cada tarea va aislada en su propio try/catch: ninguna debe
 * bloquear la publicación programada.
 */
export async function GET(req: Request) {
  if (!cronAutorizado(req)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  // `?solo=programados`: lo llama un programador externo cada minuto; no debe tocar las APIs de indicadores ni el mantenimiento.
  const soloProgramados = new URL(req.url).searchParams.get("solo") === "programados";

  const pasada = await procesarProgramadas({ forzar: true });
  if (soloProgramados) return NextResponse.json({ published: pasada.slugs });

  const [marketData, mantenimiento] = await Promise.all([
    syncMarketData().catch((e) => {
      console.error("publish-scheduled: falló la sincronización de indicadores", e);
      return null;
    }),
    purgarVencidos().catch((e) => {
      console.error("publish-scheduled: falló el mantenimiento de datos", e);
      return null;
    }),
  ]);
  return NextResponse.json({ published: pasada.slugs, marketData, mantenimiento });
}
