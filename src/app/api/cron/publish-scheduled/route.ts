import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { and, eq, gt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors, categories, siteSettings } from "@/db/schema";
import { cronAutorizado } from "@/lib/cron-auth";
import { promoverProgramados } from "@/lib/scheduled";
import { syncMarketData } from "@/lib/sync-market-data";
import { invalidarCache } from "@/lib/data-cache";

/** Hasta cuándo se han revalidado las notas salidas por programación. */
const MARCA_KEY = "programadas_revalidadas_hasta";

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
  if (!cronAutorizado(req)) {
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

  // 1. Pasa a «publicado» lo que ya llegó a su hora (si nadie lo hizo antes: ver `promoverProgramados`).
  await promoverProgramados({ forzar: true });

  // 2. Revalida TODA nota que salió por programación desde la última vez que este cron revisó, la haya
  //    publicado él o el publicador perezoso de `scheduled.ts` (que corre durante un render y no puede
  //    revalidar). Sin esta marca, el cron solo veía notas aún en «programado»: las que el publicador
  //    perezoso ya había movido nunca refrescaban ni la portada, ni el sitemap, ni el feed.
  const [marca] = await db.select({ v: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, MARCA_KEY)).limit(1);
  const desdeIso = (marca?.v as { hasta?: string } | undefined)?.hasta;
  const desde = desdeIso && !Number.isNaN(Date.parse(desdeIso)) ? new Date(desdeIso) : new Date(Date.now() - 36 * 3600_000);
  const hasta = new Date();

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
    .where(and(eq(articles.status, "publicado"), gt(articles.scheduledFor, desde), lte(articles.scheduledFor, hasta)));

  for (const a of due) {
    revalidatePath(`/articulo/${a.slug}`);
    if (a.categorySlug) revalidatePath(`/categoria/${a.categorySlug}`);
    if (a.authorSlug) revalidatePath(`/autor/${a.authorSlug}`);
  }
  if (due.length) {
    invalidarCache();
    revalidatePath("/");
    revalidatePath("/sitemap.xml");
    revalidatePath("/feed.xml");
  }
  await db
    .insert(siteSettings)
    .values({ key: MARCA_KEY, value: { hasta: hasta.toISOString() } })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: { hasta: hasta.toISOString() }, updatedAt: sql`now()` } });

  return NextResponse.json({ published: due.map((d) => d.slug), marketData });
}
