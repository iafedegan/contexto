import { NextResponse } from "next/server";
import { emitir } from "@/lib/eventos";
import { procesarProgramadas } from "@/lib/scheduled";

/**
 * Aviso del navegador para que salgan a su hora las notas programadas aunque el cron de Vercel sea diario (plan Hobby).
 * Lo envía `ProgramadasTick` desde cualquier página, como mucho cada cinco minutos por navegador; `procesarProgramadas`
 * lo limita a una pasada por minuto en todo el sitio, así que no sirve para saturar la base. No recibe ni devuelve datos
 * de nadie: solo promueve lo que ya había llegado a su hora y refresca el sitio.
 */
export const dynamic = "force-dynamic";
// El envío de un boletín programado puede tardar: se hace después de responder (ver más abajo).
// 300 s: redactar una pieza del consejo de redacción (investigación con fuentes + borrador verificado + portada) tarda más de un minuto y corre después de responder (`after`); con 60 s se cortaba y la pieza quedaba trabada.
export const maxDuration = 300;

// Promueve las notas programadas que ya llegaron a su hora (con límite de una pasada por minuto).
export async function POST() {
  const { ids } = await procesarProgramadas();
  // Si hay un boletín programado que ya debe salir, quien reacciona (ver oyentes.ts) lo envía DESPUÉS de responder, para no hacer esperar a quien lee.
  emitir("programadas.aviso", {});
  return NextResponse.json({ ok: true, publicadas: ids.length });
}
