import "server-only";
import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { avisarSiUltimaHora } from "@/lib/push";

/** Última vez que esta instancia ejecutó la pasada (ver el límite de una por minuto). */
let ultimaPasada = 0;

/**
 * Pasa a «publicado» las notas programadas cuya hora ya llegó. Es la red de seguridad del publicador: el cron
 * de Vercel (plan Hobby) solo corre una vez al día, así que además se llama al armar la portada, al abrir una
 * nota y al abrir el panel. Idempotente y barata (un UPDATE con índice por estado). No revalida cachés: se
 * puede llamar durante un render; la revalidación completa la hace el cron, que revisa las notas salidas
 * por programación desde su última pasada (ver `publish-scheduled`).
 */
export async function promoverProgramados(opciones: { forzar?: boolean } = {}): Promise<number> {
  // Se ejecuta en cada render de portada y de nota: como mucho una vez por minuto y por instancia, en vez
  // de un UPDATE por visita. El cron (`forzar`) la salta.
  const ahora = Date.now();
  if (!opciones.forzar && ahora - ultimaPasada < 60_000) return 0;
  ultimaPasada = ahora;
  try {
    const r = await db
      .update(articles)
      .set({ status: "publicado", publishedAt: sql`${articles.scheduledFor}`, updatedAt: sql`now()` })
      .where(and(eq(articles.status, "programado"), lte(articles.scheduledFor, sql`now()`)))
      .returning({ id: articles.id });
    if (r.length) avisarSiUltimaHora(r.map((x) => x.id));
    return r.length;
  } catch {
    return 0;
  }
}
