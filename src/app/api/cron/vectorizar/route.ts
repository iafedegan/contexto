import { NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/cron-auth";
import { vectorizarPendientes } from "@/lib/vectorizar";

/**
 * Vectoriza las notas publicadas que todavía no tienen embedding, para que el asistente las encuentre por significado y no solo por palabras.
 * Programado en vercel.json cada 5 minutos: cada llamada avanza lo que cabe en ~4 minutos y responde cuántas faltan (`pendientes`); cuando
 * llegan a 0 las siguientes responden al instante. Protegido con CRON_SECRET.
 */
export const maxDuration = 300;

// Procesa lotes de notas sin vector hasta agotar el tiempo. Exige el secreto del cron.
export async function GET(req: Request) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  try {
    return NextResponse.json(await vectorizarPendientes(240_000));
  } catch (e) {
    console.error("vectorizar falló", e);
    return NextResponse.json({ ok: false, error: (e as Error)?.message?.slice(0, 200) ?? "error" }, { status: 500 });
  }
}
