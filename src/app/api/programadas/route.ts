import { NextResponse } from "next/server";
import { procesarProgramadas } from "@/lib/scheduled";

/**
 * Aviso del navegador para que salgan a su hora las notas programadas aunque el cron de Vercel sea diario (plan Hobby).
 * Lo envía `ProgramadasTick` desde cualquier página, como mucho cada cinco minutos por navegador; `procesarProgramadas`
 * lo limita a una pasada por minuto en todo el sitio, así que no sirve para saturar la base. No recibe ni devuelve datos
 * de nadie: solo promueve lo que ya había llegado a su hora y refresca el sitio.
 */
export const dynamic = "force-dynamic";

// Promueve las notas programadas que ya llegaron a su hora (con límite de una pasada por minuto).
export async function POST() {
  const { ids } = await procesarProgramadas();
  return NextResponse.json({ ok: true, publicadas: ids.length });
}
