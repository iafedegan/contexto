import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, editorialPlans, editorialSlots } from "@/db/schema";

/** Piezas del consejo que todavía esperan algo de quien las escribe (todo menos lo ya programado, publicado u omitido). */
const POR_HACER = ["planificada", "redactando", "revision", "fallida"];

// A quién le toca la pieza: el escritor de su ficha o, si no tiene, el del consejo (igual que en el editor del consejo).
const asignadaA = (userId: string) => sql`coalesce(${editorialSlots.ficha}->>'escritorId', ${editorialPlans.config}->>'escritorId') = ${userId}`;

export type Pendiente = {
  id: string;
  planId: string;
  plan: string;
  tema: string;
  seccion: string;
  publicaEn: Date;
  estado: string;
  articleId: string | null;
  error: string | null;
};

/** Las piezas de consejos ACTIVOS que le tocan a esta persona, las que salen antes primero. */
export async function misPendientes(userId: string): Promise<Pendiente[]> {
  const filas = await db
    .select({
      id: editorialSlots.id,
      planId: editorialSlots.planId,
      plan: editorialPlans.title,
      tema: editorialSlots.topic,
      slug: editorialSlots.sectionSlug,
      seccion: categories.name,
      publicaEn: editorialSlots.publishAt,
      estado: editorialSlots.status,
      articleId: editorialSlots.articleId,
      error: editorialSlots.error,
    })
    .from(editorialSlots)
    .innerJoin(editorialPlans, eq(editorialPlans.id, editorialSlots.planId))
    .leftJoin(categories, eq(categories.slug, editorialSlots.sectionSlug))
    .where(and(eq(editorialPlans.status, "activo"), inArray(editorialSlots.status, POR_HACER), asignadaA(userId)))
    .orderBy(asc(editorialSlots.publishAt))
    .limit(200);
  return filas.map((f) => ({ id: f.id, planId: f.planId, plan: f.plan, tema: f.tema, seccion: f.seccion ?? f.slug, publicaEn: f.publicaEn, estado: f.estado, articleId: f.articleId, error: f.error }));
}

/** Cuántas piezas le tocan (la insignia del menú). Si la consulta falla, 0: el menú nunca debe romper el panel. */
export async function contarMisPendientes(userId: string): Promise<number> {
  try {
    const [r] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(editorialSlots)
      .innerJoin(editorialPlans, eq(editorialPlans.id, editorialSlots.planId))
      .where(and(eq(editorialPlans.status, "activo"), inArray(editorialSlots.status, POR_HACER), asignadaA(userId)));
    return r?.n ?? 0;
  } catch {
    return 0;
  }
}
