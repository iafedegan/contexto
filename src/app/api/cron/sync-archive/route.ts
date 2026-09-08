import { NextResponse } from "next/server";
import { syncArchiveIndex } from "@/lib/archive-client";

/**
 * Job periódico de sincronización del archivo histórico (SOLO LECTURA).
 * Programado en vercel.json (cada 6 h). Protegido con CRON_SECRET.
 *
 * Para catálogos grandes conviene mover esto a Inngest (ver src/inngest) y que
 * este endpoint solo encole el evento. Aquí se deja la versión directa.
 */
export const maxDuration = 300;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const full = url.searchParams.get("full") === "1";
  const since = full
    ? null
    : new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(); // últimos 3 días

  try {
    const result = await syncArchiveIndex(since);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("sync-archive falló", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
