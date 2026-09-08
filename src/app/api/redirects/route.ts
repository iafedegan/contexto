import { NextResponse } from "next/server";
import { db } from "@/db";
import { redirects } from "@/db/schema";

/**
 * Mapa de redirecciones 301 uno-a-uno para que el middleware (borde) las
 * resuelva sin tocar la base de datos en el camino crítico. El middleware
 * cachea la respuesta en memoria y la refresca cada pocos minutos.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db
      .select({ from: redirects.fromPath, to: redirects.toPath, code: redirects.statusCode })
      .from(redirects);
    return NextResponse.json(
      { map: rows },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch {
    return NextResponse.json({ map: [] });
  }
}
