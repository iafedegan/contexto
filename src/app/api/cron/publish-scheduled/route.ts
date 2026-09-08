import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors, categories } from "@/db/schema";

/**
 * Materializa artículos "programado" cuya hora ya llegó -> "publicado", y
 * dispara la revalidación ISR de las rutas afectadas. Corre cada 5 min (vercel.json).
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

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

  return NextResponse.json({ published: due.map((d) => d.slug) });
}
