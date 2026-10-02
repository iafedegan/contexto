import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors, categories } from "@/db/schema";
import { syncMarketData } from "@/lib/sync-market-data";

/**
 * Materializa artículos "programado" cuya hora ya llegó -> "publicado", y
 * dispara la revalidación ISR de las rutas afectadas. Corre a diario
 * (vercel.json).
 *
 * También aprovecha para refrescar TRM/petróleo (franja económica, H-06):
 * el plan Hobby solo permite 2 cron jobs y ya están ocupados, así que en
 * vez de un tercero cada 6 h se sube de paso aquí una vez al día. Nunca
 * debe bloquear la publicación programada, así que va aislado en su propio
 * try/catch.
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  // `?solo=programados`: lo llama un programador externo cada minuto (Supabase pg_cron); no debe tocar las APIs de indicadores.
  const soloProgramados = new URL(req.url).searchParams.get("solo") === "programados";
  const marketData = soloProgramados
    ? null
    : await syncMarketData().catch((e) => {
        console.error("publish-scheduled: falló la sincronización de indicadores", e);
        return null;
      });

  const due = await db
    .select({
      id: articles.id,
      slug: articles.slug,
      categorySlug: categories.slug,
      authorSlug: authors.slug,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .where(and(eq(articles.status, "programado"), lte(articles.scheduledFor, sql`now()`)));

  for (const a of due) {
    await db
      .update(articles)
      .set({ status: "publicado", publishedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(articles.id, a.id));

    revalidatePath(`/articulo/${a.slug}`);
    if (a.categorySlug) revalidatePath(`/categoria/${a.categorySlug}`);
    if (a.authorSlug) revalidatePath(`/autor/${a.authorSlug}`);
  }
  if (due.length) {
    revalidatePath("/");
    revalidatePath("/sitemap.xml");
    revalidatePath("/feed.xml");
  }

  return NextResponse.json({ published: due.map((d) => d.slug), marketData });
}
