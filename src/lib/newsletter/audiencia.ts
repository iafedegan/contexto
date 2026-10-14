import "server-only";

import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db, rowsOf } from "@/db";
import { newsletterSubscribers as t } from "@/db/schema";
import type { Audiencia } from "@/lib/newsletter/audiencia-tipos";
import { centroDeCiudad } from "@/lib/newsletter/ciudades-colombia";

/**
 * Ciudad de cada suscriptor como clave de agrupación: la que escribió o, si no, la que salió de su IP; en minúsculas, sin tildes y
 * sin espacios de más. Va como texto fijo (no como parámetros) para que el mismo `SELECT … GROUP BY` la reconozca como la misma expresión.
 */
const CIUDAD = sql.raw(`regexp_replace(translate(lower(trim(coalesce(nullif(city, ''), signup_city, ''))), 'áéíóúüñ', 'aeiouun'), '\\s+', ' ', 'g')`);

/** Quién puede recibir: confirmado y sin baja. */
const activos = () => and(eq(t.confirmed, true), isNull(t.unsubscribedAt));

// Lista de valores para un `IN (…)` / `ARRAY[…]`, siempre como parámetros.
const valores = (xs: string[]) => sql.join(xs.map((x) => sql`${x}`), sql`, `);

/** Condiciones SQL de los filtros (todas deben cumplirse). Vacío = todos. Los valores van siempre como parámetros. */
export function condicionAudiencia(a: Audiencia): SQL[] {
  const c: SQL[] = [];
  if (a.ciudades.length) c.push(sql`${CIUDAD} in (${valores(a.ciudades)})`);
  if (a.paises.length) c.push(sql`upper(${t.signupCountry}) in (${valores(a.paises)})`);
  if (a.temas.length) c.push(sql`${t.interests} ?| array[${valores(a.temas)}]::text[]`);
  if (a.nuevosDias !== null) c.push(sql`${t.createdAt} > now() - make_interval(days => ${a.nuevosDias})`);
  return c;
}

/** Destinatarios de una edición: confirmados y sin baja que cumplen los filtros (y, si se indica, suscritos antes del inicio del envío). */
export const destinatariosWhere = (a: Audiencia, inicio: Date | null = null) =>
  and(activos(), ...condicionAudiencia(a), ...(inicio ? [sql`${t.createdAt} <= ${inicio}`] : []));

/** Cuántas personas recibirían una edición con estos filtros. */
export async function contarAudiencia(a: Audiencia): Promise<number> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(t).where(destinatariosWhere(a));
  return n;
}

/** Lo que se puede elegir al armar un segmento, con cuántas personas hay en cada opción. */
export type OpcionesAudiencia = {
  total: number;
  /** Suscritos que aún no confirmaron su correo: todavía no reciben nada. */
  pendientes: number;
  /** Cuántas indicaron al menos un tema al suscribirse. */
  conTemas: number;
  /** `lat` y `lon`: el promedio de donde se registraron (para ubicarla en el mapa); `null` si ninguna trae ubicación. */
  ciudades: { clave: string; nombre: string; n: number; lat: number | null; lon: number | null }[];
  paises: { codigo: string; n: number }[];
  temas: { id: string; n: number }[];
};

export async function opcionesAudiencia(): Promise<OpcionesAudiencia> {
  const base = sql`confirmed and unsubscribed_at is null`;
  const [ciudades, paises, temas, totales, pend] = await Promise.all([
    db.execute(sql`
      select ${CIUDAD} as clave, min(coalesce(nullif(city, ''), signup_city)) as nombre, count(*)::int as n,
             avg(signup_lat::float8) as lat, avg(signup_lon::float8) as lon
      from newsletter_subscribers where ${base} and ${CIUDAD} <> ''
      group by ${CIUDAD} order by n desc, clave limit 60`),
    db.execute(sql`
      select upper(signup_country) as codigo, count(*)::int as n
      from newsletter_subscribers where ${base} and coalesce(signup_country, '') <> ''
      group by upper(signup_country) order by n desc limit 20`),
    db.execute(sql`
      select e as id, count(*)::int as n
      from newsletter_subscribers, jsonb_array_elements_text(interests) e
      where ${base} group by e order by n desc`),
    db.execute(sql`
      select count(*)::int as total, count(*) filter (where interests <> '[]'::jsonb)::int as con_temas
      from newsletter_subscribers where ${base}`),
    db.execute(sql`select count(*)::int as n from newsletter_subscribers where not confirmed and unsubscribed_at is null`),
  ]);
  const fila = (rowsOf(totales)[0] ?? {}) as { total?: number; con_temas?: number };
  return {
    total: Number(fila.total ?? 0),
    pendientes: Number((rowsOf(pend)[0] as { n?: number } | undefined)?.n ?? 0),
    conTemas: Number(fila.con_temas ?? 0),
    ciudades: (rowsOf(ciudades) as { clave: string; nombre: string; n: number; lat: number | string | null; lon: number | string | null }[]).map((r) => ({
      clave: String(r.clave),
      nombre: String(r.nombre),
      n: Number(r.n),
      // Sin coordenadas guardadas, el centro aproximado de la ciudad (para que aparezca en el mapa).
      ...((r.lat === null || r.lat === undefined ? centroDeCiudad(String(r.clave)) : null) ?? { lat: r.lat === null || r.lat === undefined ? null : Number(r.lat), lon: r.lon === null || r.lon === undefined ? null : Number(r.lon) }),
    })),
    paises: (rowsOf(paises) as { codigo: string; n: number }[]).map((r) => ({ codigo: String(r.codigo), n: Number(r.n) })),
    temas: (rowsOf(temas) as { id: string; n: number }[]).map((r) => ({ id: String(r.id), n: Number(r.n) })),
  };
}
