import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, articleViewsDaily } from "@/db/schema";
import { clasificarFuente, registrarFuente } from "@/lib/view-sources";

/**
 * Contador de lecturas para «Más leídas» (H-04).
 *
 * Lo llama un beacon del cliente y no el render del servidor: con ISR una
 * página se renderiza una vez y se sirve cacheada miles de veces, así que
 * contar renders no mide lectores. El endpoint solo incrementa un entero; no
 * guarda IP, cookie ni identificador alguno del visitante.
 */
export const dynamic = "force-dynamic";

// Cuenta una lectura de la nota (señal del navegador) y su origen, sin guardar datos del visitante.
export async function POST(req: Request) {
  let slug = "";
  let origen = { utmSource: "", utmMedium: "", utmCampaign: "", referrer: "" };
  try {
    const body = (await req.json()) as { slug?: unknown; us?: unknown; um?: unknown; uc?: unknown; ref?: unknown };
    slug = typeof body.slug === "string" ? body.slug.slice(0, 200) : "";
    const t = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
    origen = { utmSource: t(body.us, 60), utmMedium: t(body.um, 60), utmCampaign: t(body.uc, 80), referrer: t(body.ref, 300) };
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
      // Origen de la lectura (UTM o sitio de procedencia): solo un contador, sin datos personales.
      void registrarFuente(row.id, clasificarFuente({ ...origen, host: new URL(req.url).hostname }));
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
