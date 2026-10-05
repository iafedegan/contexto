import "server-only";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db, rowsOf } from "@/db";
import { articleViewsDaily } from "@/db/schema";

/**
 * Analítica de lecturas para el panel. Las cifras salen del beacon de
 * `/api/vista`: `articles.views` (total histórico) y `article_views_daily`
 * (un entero por artículo y día, en hora de Colombia).
 */

/** "Hoy" en Colombia, calculado por la base para no depender del reloj del servidor. */
export const TODAY_CO = sql`(now() at time zone 'America/Bogota')::date`;

/**
 * La tabla diaria llega con la migración 0006. Mientras no esté aplicada en un
 * entorno, el panel sigue funcionando con el total histórico en vez de romperse.
 */
export async function hasDailyViews(): Promise<boolean> {
  try {
    const res = await db.execute(sql`select to_regclass('public.article_views_daily') is not null as ok`);
    return Boolean(rowsOf<{ ok: boolean }>(res)[0]?.ok);
  } catch {
    return false;
  }
}

/** Lista de fechas ISO (YYYY-MM-DD) de los últimos `days` días, terminando hoy. */
function lastDays(todayIso: string, days: number): string[] {
  const end = new Date(`${todayIso}T00:00:00Z`).getTime();
  return Array.from({ length: days }, (_, i) =>
    new Date(end - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10),
  );
}

// Fecha de hoy en hora de Colombia (AAAA-MM-DD), calculada en la base para que coincida con la de las lecturas.
async function todayIso(): Promise<string> {
  const res = await db.execute(sql`select to_char(${TODAY_CO}, 'YYYY-MM-DD') as d`);
  return rowsOf<{ d: string }>(res)[0]?.d ?? new Date().toISOString().slice(0, 10);
}

/** Serie diaria (rellena con ceros) de varios artículos a la vez. */
export async function dailySeries(
  articleIds: string[],
  days: number,
): Promise<{ days: string[]; byArticle: Map<string, number[]> }> {
  const today = await todayIso();
  const range = lastDays(today, days);
  const byArticle = new Map<string, number[]>();
  if (articleIds.length === 0 || !(await hasDailyViews())) return { days: range, byArticle };

  const rows = await db
    .select({
      articleId: articleViewsDaily.articleId,
      day: articleViewsDaily.day,
      views: articleViewsDaily.views,
    })
    .from(articleViewsDaily)
    .where(
      and(
        inArray(articleViewsDaily.articleId, articleIds),
        gte(articleViewsDaily.day, range[0]),
      ),
    );

  const index = new Map(range.map((d, i) => [d, i]));
  for (const r of rows) {
    const i = index.get(String(r.day).slice(0, 10));
    if (i === undefined) continue;
    let serie = byArticle.get(r.articleId);
    if (!serie) {
      serie = new Array(days).fill(0);
      byArticle.set(r.articleId, serie);
    }
    serie[i] += r.views;
  }
  return { days: range, byArticle };
}

/** Serie diaria del SITIO completo (suma de todos los artículos), para el
 * resumen editorial — a diferencia de `dailySeries`, que es por artículo. */
export async function siteDailySeries(days: number): Promise<{ days: string[]; views: number[] }> {
  const today = await todayIso();
  const range = lastDays(today, days);
  if (!(await hasDailyViews())) return { days: range, views: new Array(days).fill(0) };

  const rows = await db
    .select({ day: articleViewsDaily.day, views: sql<number>`sum(${articleViewsDaily.views})::int` })
    .from(articleViewsDaily)
    .where(gte(articleViewsDaily.day, range[0]))
    .groupBy(articleViewsDaily.day);

  const index = new Map(range.map((d, i) => [d, i]));
  const views = new Array(days).fill(0);
  for (const r of rows) {
    const i = index.get(String(r.day).slice(0, 10));
    if (i !== undefined) views[i] = r.views;
  }
  return { days: range, views };
}

/** Totales del sitio: lecturas de los últimos 7 días y de los 7 anteriores. */
export async function siteWeekTotals(): Promise<{ last7: number; prev7: number } | null> {
  if (!(await hasDailyViews())) return null;
  const [row] = await db
    .select({
      last7: sql<number>`coalesce(sum(${articleViewsDaily.views}) filter (where ${articleViewsDaily.day} > ${TODAY_CO} - 7), 0)::int`,
      prev7: sql<number>`coalesce(sum(${articleViewsDaily.views}) filter (where ${articleViewsDaily.day} <= ${TODAY_CO} - 7), 0)::int`,
    })
    .from(articleViewsDaily)
    .where(gte(articleViewsDaily.day, sql`${TODAY_CO} - 13`));
  return { last7: Number(row?.last7 ?? 0), prev7: Number(row?.prev7 ?? 0) };
}

/** Serie diaria de un artículo, con los últimos `days` días. */
export async function articleSeries(articleId: string, days: number) {
  const { days: range, byArticle } = await dailySeries([articleId], days);
  return { days: range, views: byArticle.get(articleId) ?? new Array(days).fill(0) };
}

/** Día con más lecturas de un artículo (histórico completo). */
export async function bestDay(articleId: string): Promise<{ day: string; views: number } | null> {
  if (!(await hasDailyViews())) return null;
  const [row] = await db
    .select({ day: articleViewsDaily.day, views: articleViewsDaily.views })
    .from(articleViewsDaily)
    .where(eq(articleViewsDaily.articleId, articleId))
    .orderBy(sql`${articleViewsDaily.views} desc`)
    .limit(1);
  return row ? { day: String(row.day).slice(0, 10), views: row.views } : null;
}

/** Variación porcentual redondeada; null si no hay base con la que comparar. */
export function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// Formateador de números con separadores de miles de Colombia.
export const nf = new Intl.NumberFormat("es-CO");
