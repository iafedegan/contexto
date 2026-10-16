import { NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/cron-auth";
import { procesarProgramadas } from "@/lib/scheduled";
import { procesarBoletinesProgramados } from "@/lib/newsletter/envio";
import { syncMarketData } from "@/lib/sync-market-data";
import { purgarVencidos } from "@/lib/mantenimiento";
import { refrescarObservatorio } from "@/lib/observatorio-fedegan";
import { refrescarIndicadores } from "@/lib/indicadores-fedegan";
import { procesarConsejo } from "@/lib/ai/consejo-ejecucion";
import { invalidarCache } from "@/lib/data-cache";
import { revalidatePath } from "next/cache";

/**
 * Publica las notas «programado» cuya hora ya llegó y refresca el sitio. Toda la lógica vive en
 * `procesarProgramadas` (un solo sitio: cambia el estado, revalida portada, sitemap, feed, nota, categoría y autor, y
 * avisa a los lectores), y la ejecutan también el aviso del navegador (`/api/programadas`) y, con
 * `?solo=programados`, un programador externo cada minuto (p. ej. Supabase pg_cron).
 *
 * También envía los boletines «programados» cuya hora ya llegó (`procesarBoletinesProgramados`).
 *
 * Corre a diario desde vercel.json. Aprovecha para refrescar TRM/petróleo (franja económica, H-06) y para el
 * mantenimiento de datos (límites vencidos, retención de datos de suscriptores): el plan Hobby solo permite 2 cron jobs
 * y ya están ocupados, así que se suben aquí una vez al día. Cada tarea va aislada en su propio try/catch: ninguna debe
 * bloquear la publicación programada. También calienta la caché del Observatorio (15 lecturas al origen de FEDEGÁN), para que
 * la primera visita del día no espere esa descarga.
 */
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!cronAutorizado(req)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  // `?solo=programados`: lo llama un programador externo cada minuto; no debe tocar las APIs de indicadores ni el mantenimiento.
  const soloProgramados = new URL(req.url).searchParams.get("solo") === "programados";

  const pasada = await procesarProgramadas({ forzar: true });
  // Los boletines programados cuya hora llegó salen en esta misma pasada (y se retoman los que quedaron a medias).
  const boletines = await procesarBoletinesProgramados({ forzar: true, tiempoMs: 90_000 }).catch((e) => {
    console.error("publish-scheduled: falló el envío de boletines programados", e);
    return [];
  });
  // Consejo de redacción: redacta las piezas que ya tocan (una por pasada cada minuto; hasta dos en la pasada diaria).
  const consejo = await procesarConsejo({ max: soloProgramados ? 1 : 2 }).catch(() => ({ redactadas: 0 }));
  if (soloProgramados) return NextResponse.json({ published: pasada.slugs, boletines, consejo });

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
  // Observatorio: copia diaria en la base (precios y demás cifras). Si algo cambió, se vacía su caché y se regenera la página estática.
  const [obs, precios] = await Promise.all([
    refrescarObservatorio().catch((e) => (console.error("publish-scheduled: falló la copia del Observatorio", e), false)),
    refrescarIndicadores().catch((e) => (console.error("publish-scheduled: falló la copia de precios", e), false)),
  ]);
  if (obs || precios) {
    invalidarCache("indicadores");
    revalidatePath("/observatorio");
    revalidatePath("/en/observatorio");
  }
  return NextResponse.json({ published: pasada.slugs, boletines, consejo, marketData, mantenimiento });
}
