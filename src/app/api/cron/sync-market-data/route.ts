import { NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/cron-auth";
import { syncMarketData } from "@/lib/sync-market-data";

/**
 * Disparo manual de la sincronización de TRM/petróleo (ver
 * `src/lib/sync-market-data.ts` para el porqué no tiene su propio cron en
 * `vercel.json`: el plan Hobby solo permite 2, y ya están ocupados). Útil
 * para forzar una actualización o si el proyecto sube a un plan con más
 * cron jobs disponibles.
 */
export const maxDuration = 30;

// Actualiza las series de dólar y petróleo. Exige el secreto del cron.
export async function GET(req: Request) {
  if (!cronAutorizado(req)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const result = await syncMarketData();
  return NextResponse.json(result);
}
