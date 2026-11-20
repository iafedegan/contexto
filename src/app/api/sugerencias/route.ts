import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, rowsOf } from "@/db";
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
    // Con el índice de texto completo (GIN sobre `search_vec`) en vez de recorrer los 51 mil títulos con `ilike '%…%'`: cada palabra tecleada es
    // un prefijo («vacun» encuentra «vacunación»), sin tildes ni mayúsculas. De los candidatos más recientes, primero van los que llevan lo tecleado en el titular.
    const palabras = q.slice(0, 80).match(/[\p{L}\p{N}]+/gu)?.slice(0, 5) ?? [];
    if (!palabras.length) return NextResponse.json({ items: [] });
    const consulta = palabras.map((w, i) => (i === palabras.length - 1 ? `${w}:*` : w)).join(" & ");
    const frase = palabras.join(" ");
    const rows = rowsOf<{ title: string; slug: string }>(
      await db.execute(sql`
        select title, slug from (
          select title, slug, published_at from articles
          where status = 'publicado' and published_at <= now() and search_vec @@ to_tsquery('spanish', ${consulta})
          order by published_at desc limit 300
        ) c
        order by (translate(lower(title), 'áéíóúü', 'aeiouu') like '%' || translate(lower(${frase}), 'áéíóúü', 'aeiouu') || '%') desc, published_at desc
        limit 6`),
    );
    return NextResponse.json({ items: rows }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
