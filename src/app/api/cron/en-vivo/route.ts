import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { cronAutorizado } from "@/lib/cron-auth";
import { aplicarEnVivoAutomatico } from "@/lib/en-vivo-auto";

/**
 * Modo automático de «En vivo» (/panel/en-vivo): mira si el canal de YouTube está transmitiendo y enciende o apaga la transmisión de la
 * portada. Lo llama Vercel Cron cada 2 minutos (vercel.json); exige el secreto del cron.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const r = await aplicarEnVivoAutomatico().catch((e) => ({ cambio: "ninguno" as const, estado: "error", error: String(e).slice(0, 200) }));
  // Solo la portada muestra la transmisión (es dinámica y lee de la caché de datos, que ya limpió aplicarEnVivoAutomatico); el aviso del
  // resto del sitio lo consulta el navegador en /api/en-vivo. Antes aquí se revalidaba TODO el sitio («/», "layout»): cada vez que el canal
  // empezaba o terminaba un directo se vaciaba la caché de las ~100.000 notas y los rastreadores la volvían a llenar (costo en Vercel).
  if (r.cambio !== "ninguno") {
    revalidatePath("/");
    revalidatePath("/en");
  }
  return NextResponse.json(r);
}
