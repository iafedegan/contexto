import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { newsletterSubscribers } from "@/db/schema";
import { verifyUnsubscribeToken } from "@/lib/newsletter/token";

// Se calcula en cada petición, nunca durante la compilación.
export const dynamic = "force-dynamic";

/**
 * Baja de un clic (RFC 8058): Gmail, Apple Mail y otros muestran su propio
 * botón «Cancelar suscripción» y hacen POST a este enlace, que va en la
 * cabecera List-Unsubscribe de cada boletín. Un GET solo lleva a la página
 * de confirmación.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const s = url.searchParams.get("s") ?? "";
  const t = url.searchParams.get("t") ?? "";
  if (!s || !verifyUnsubscribeToken(s, t)) return NextResponse.json({ ok: false }, { status: 400 });
  await db.update(newsletterSubscribers).set({ unsubscribedAt: new Date() }).where(eq(newsletterSubscribers.id, s));
  return NextResponse.json({ ok: true });
}

// Lleva a la página de confirmación de baja conservando los parámetros del enlace.
export async function GET(req: Request) {
  const url = new URL(req.url);
  return NextResponse.redirect(new URL(`/boletin/baja?s=${encodeURIComponent(url.searchParams.get("s") ?? "")}&t=${encodeURIComponent(url.searchParams.get("t") ?? "")}`, req.url));
}
