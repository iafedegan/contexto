import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, articleViewsDaily } from "@/db/schema";

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
    const [row] = await db
      .update(articles)
      .set({ views: sql`${articles.views} + 1` })
      .where(eq(articles.slug, slug))
      .returning({ id: articles.id });
    if (row) {
      // Agregado diario para la analítica del panel, en hora de Colombia.
      await db
        .insert(articleViewsDaily)
        .values({ articleId: row.id, day: sql`(now() at time zone 'America/Bogota')::date`, views: 1 })
        .onConflictDoUpdate({
          target: [articleViewsDaily.articleId, articleViewsDaily.day],
          set: { views: sql`${articleViewsDaily.views} + 1` },
        });
    }
  } catch {
    // Un fallo del contador nunca debe romper la lectura del artículo.
  }
  return NextResponse.json({ ok: true });
}
