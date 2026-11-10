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
  if (r.cambio !== "ninguno") revalidatePath("/", "layout");
  return NextResponse.json(r);
}
