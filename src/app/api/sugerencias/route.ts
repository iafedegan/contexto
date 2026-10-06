import { NextResponse } from "next/server";
import { and, ilike, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { clientIp, hit } from "@/lib/rate-limit";

/**
 * Sugerencias del buscador (B-04): máximo seis titulares que empiecen o
 * contengan lo tecleado. Es una consulta por prefijo, no la búsqueda híbrida
 * completa: tiene que responder mientras el lector escribe.
 */
export const dynamic = "force-dynamic";

// Hasta seis titulares publicados que contienen lo que la persona va tecleando.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json({ items: [] });
  // Responde mientras se teclea, así que el tope es holgado (60 por minuto y por IP); sirve para que nadie use la
  // consulta como un raspador del catálogo.
  if (!(await hit(`sugerencias:${clientIp(req.headers)}`, 60, 60)).allowed) {
    return NextResponse.json({ items: [] }, { status: 429, headers: { "Retry-After": "60" } });
  }

  try {
    const rows = await db
      .select({ title: articles.title, slug: articles.slug })
      .from(articles)
      .where(
        and(
          sql`${articles.status} = 'publicado'`,
          sql`${articles.publishedAt} <= now()`,
          // `%` y `_` son comodines de LIKE: sin escaparlos, «%%%» o «___» coincidían con todo y «a_c» con «abc».
          ilike(articles.title, `%${q.slice(0, 80).replace(/[\\%_]/g, "\\$&")}%`),
        ),
      )
      .orderBy(sql`${articles.publishedAt} desc`)
      .limit(6);
    return NextResponse.json({ items: rows });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
