import { NextResponse } from "next/server";
import { PREGUNTAS_POR_DEFECTO, preguntasSugeridas } from "@/lib/ai/preguntas-sugeridas";

/**
 * Las preguntas de ejemplo del asistente, según los temas del momento (lo más leído y lo más reciente). El resultado se guarda una hora en el
 * servidor y también en la red de entrega, así que muchas visitas no llaman al modelo.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const preguntas = await preguntasSugeridas().catch(() => PREGUNTAS_POR_DEFECTO);
  return NextResponse.json({ preguntas }, { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } });
}
