import "server-only";
import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { emitir } from "@/lib/eventos";
import { hit } from "@/lib/rate-limit";
import { revalidarNotas } from "@/lib/article-ops";

/** Última vez que esta instancia ejecutó la pasada (ver el límite de una por minuto). */
let ultimaPasada = 0;

/** Qué quedó publicado en una pasada. */
export type PasadaProgramadas = { ids: string[]; slugs: string[] };

/**
 * ÚNICO sitio donde una nota programada pasa a «publicado» (hallazgo H-12). Hace las tres cosas juntas, así nadie
 * puede promover sin refrescar el sitio: (1) cambia el estado de lo que ya llegó a su hora con un solo UPDATE
 * condicionado (idempotente: dos ejecuciones a la vez no publican dos veces nada), (2) revalida portada, sitemap,
 * feed, la nota, su categoría y su autor, y (3) anuncia `nota.publicada` para que reaccionen los avisos push.
 *
 * Las lecturas públicas YA NO escriben: no la llaman. La ejecutan, en este orden de fiabilidad:
 *  - el cron de Vercel (`/api/cron/publish-scheduled`; diario en el plan Hobby, cada minuto o cinco con un
 *    programador externo o el plan Pro),
 *  - el aviso del navegador (`/api/programadas`, ver `ProgramadasTick`): como mucho una vez por minuto en todo el
 *    sitio, para que una nota programada salga a su hora aunque el cron sea diario.
 *
 * Debe llamarse desde un manejador de ruta o una acción del servidor, nunca durante un render: revalida.
 */
export async function procesarProgramadas(opciones: { forzar?: boolean } = {}): Promise<PasadaProgramadas> {
  const vacio: PasadaProgramadas = { ids: [], slugs: [] };
  if (!opciones.forzar) {
    // Dos topes: por instancia (sin tocar la base) y global (una pasada por minuto en todo el sitio).
    const ahora = Date.now();
    if (ahora - ultimaPasada < 60_000) return vacio;
    ultimaPasada = ahora;
    if (!(await hit("programadas:pasada", 1, 60)).allowed) return vacio;
  }
  let filas: { id: string; slug: string }[];
  try {
    filas = await db
      .update(articles)
      .set({ status: "publicado", publishedAt: sql`${articles.scheduledFor}`, updatedAt: sql`now()` })
      .where(and(eq(articles.status, "programado"), lte(articles.scheduledFor, sql`now()`)))
      .returning({ id: articles.id, slug: articles.slug });
  } catch (err) {
    console.error("procesarProgramadas: no se pudo promover", err);
    return vacio;
  }
  if (!filas.length) return vacio;
  const ids = filas.map((f) => f.id);
  // Las notas YA están publicadas: si refrescar el sitio falla, no se deshace nada ni se oculta lo ocurrido.
  await revalidarNotas(ids).catch((err) => console.error("procesarProgramadas: no se pudo revalidar", err));
  emitir("nota.publicada", { ids });
  return { ids, slugs: filas.map((f) => f.slug) };
}
