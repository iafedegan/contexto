import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";

/**
 * Contador de lecturas para «Más leídas» (H-04).
 *
 * Lo llama un beacon del cliente y no el render del servidor: con ISR una
 * página se renderiza una vez y se sirve cacheada miles de veces, así que
 * contar renders no mide lectores. El endpoint solo incrementa un entero; no
 * guarda IP, cookie ni identificador alguno del visitante.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let slug = "";
  try {
    const body = (await req.json()) as { slug?: unknown };
    slug = typeof body.slug === "string" ? body.slug.slice(0, 200) : "";
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!slug) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    await db
      .update(articles)
      .set({ views: sql`${articles.views} + 1` })
      .where(eq(articles.slug, slug));
  } catch {
    // Un fallo del contador nunca debe romper la lectura del artículo.
  }
  return NextResponse.json({ ok: true });
}
