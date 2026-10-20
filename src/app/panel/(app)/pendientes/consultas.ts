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

/** Cuántas piezas le tocan (la insignia del menú) y cuántas de ellas son nuevas: aún no las abrió (el aviso). Si la consulta falla, ceros: el menú nunca debe romper el panel. */
export async function contarMisPendientes(userId: string): Promise<{ total: number; nuevas: number }> {
  try {
    const [r] = await db
      .select({ total: sql<number>`count(*)::int`, nuevas: sql<number>`count(*) filter (where ${editorialSlots.responsableVistoAt} is null)::int` })
      .from(editorialSlots)
      .innerJoin(editorialPlans, eq(editorialPlans.id, editorialSlots.planId))
      .where(and(eq(editorialPlans.status, "activo"), inArray(editorialSlots.status, POR_HACER), asignadaA(userId)));
    return { total: r?.total ?? 0, nuevas: r?.nuevas ?? 0 };
  } catch {
    return { total: 0, nuevas: 0 };
  }
}

/** Marca como vistas las piezas nuevas de esta persona (al abrir «Mis pendientes» o cerrar el aviso). */
export async function marcarVistas(userId: string): Promise<void> {
  const ids = await db
    .select({ id: editorialSlots.id })
    .from(editorialSlots)
    .innerJoin(editorialPlans, eq(editorialPlans.id, editorialSlots.planId))
    .where(and(sql`${editorialSlots.responsableVistoAt} is null`, asignadaA(userId)));
  if (ids.length) await db.update(editorialSlots).set({ responsableVistoAt: sql`now()` }).where(inArray(editorialSlots.id, ids.map((x) => x.id)));
}

/** Una pieza que le toca a esta persona (o cualquiera si es administrador), con lo necesario para escribirla en el asistente de artículos. */
export async function piezaParaEscribir(user: { id: string; role: string }, slotId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(slotId)) return null;
  const [f] = await db
    .select({ id: editorialSlots.id, tema: editorialSlots.topic, enfoque: editorialSlots.angle, encargo: editorialSlots.brief, slug: editorialSlots.sectionSlug, categoryId: categories.id, articleId: editorialSlots.articleId })
    .from(editorialSlots)
    .innerJoin(editorialPlans, eq(editorialPlans.id, editorialSlots.planId))
    .leftJoin(categories, eq(categories.slug, editorialSlots.sectionSlug))
    .where(and(eq(editorialSlots.id, slotId), user.role === "administrador" ? undefined : asignadaA(user.id)))
    .limit(1);
  return f ?? null;
}

/** Enlaza la nota que se está escribiendo con su pieza del consejo: queda «redactando» (la IA no la escribe sola) hasta que se envíe a revisión. */
export async function vincularPieza(user: { id: string; role: string }, slotId: string, articleId: string): Promise<void> {
  const pieza = await piezaParaEscribir(user, slotId);
  if (!pieza || pieza.articleId) return;
  await db
    .update(editorialSlots)
    .set({ articleId, status: "redactando", error: null, updatedAt: sql`now()` })
    .where(and(eq(editorialSlots.id, slotId), inArray(editorialSlots.status, ["planificada", "fallida"])));
}
