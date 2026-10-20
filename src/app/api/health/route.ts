import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

// Estado de salud para el monitoreo de disponibilidad (UptimeRobot, Better Stack, el monitor de Vercel…).
// Sin datos sensibles: solo si la aplicación responde y si la base de datos contesta.
export const dynamic = "force-dynamic";

// GET /api/health → 200 {ok:true} o 503 {ok:false} con el tiempo de respuesta de la base en ms.
export async function GET() {
  const t0 = Date.now();
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true, db: "ok", dbMs: Date.now() - t0, at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    // El motivo va SOLO al registro del servidor (Vercel → Logs): sin contraseña ni cadena de conexión, y no se devuelve en la respuesta pública.
    const err = e as { code?: string; message?: string; cause?: { code?: string; message?: string } };
    console.error("[health] la base no responde:", err.cause?.code ?? err.code ?? "sin-código", (err.cause?.message ?? err.message ?? "").slice(0, 200));
    return NextResponse.json({ ok: false, db: "error", dbMs: Date.now() - t0, at: new Date().toISOString() }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
