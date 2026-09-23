import { NextResponse } from "next/server";
import { and, ilike, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";

/**
 * Sugerencias del buscador (B-04): máximo seis titulares que empiecen o
 * contengan lo tecleado. Es una consulta por prefijo, no la búsqueda híbrida
 * completa: tiene que responder mientras el lector escribe.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json({ items: [] });

  try {
    const rows = await db
      .select({ title: articles.title, slug: articles.slug })
      .from(articles)
      .where(
        and(
          sql`${articles.status} = 'publicado'`,
          sql`${articles.publishedAt} <= now()`,
          ilike(articles.title, `%${q.slice(0, 80)}%`),
        ),
      )
      .orderBy(sql`${articles.publishedAt} desc`)
      .limit(6);
    return NextResponse.json({ items: rows });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
