import { NextResponse } from "next/server";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { EN_VIVO_KEY } from "@/lib/en-vivo";
import { sanitizeEnVivo } from "@/lib/en-vivo-types";

// Estado de la transmisión para la app abierta: se consulta sin caché para enterarse apenas empieza.
export const dynamic = "force-dynamic";

// GET /api/en-vivo → { activo, videoId, titulo }
export async function GET() {
  try {
    const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, EN_VIVO_KEY)).limit(1);
    const { activo, videoId, titulo } = sanitizeEnVivo(row?.value);
    return NextResponse.json({ activo, videoId, titulo }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ activo: false, videoId: "", titulo: "" }, { headers: { "Cache-Control": "no-store" } });
  }
}
