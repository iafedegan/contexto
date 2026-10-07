import "server-only";
import { sql } from "drizzle-orm";
import { db, rowsOf } from "@/db";
import type { Filtros } from "@/lib/lectores-filtros";
import { donde, DESDE } from "@/lib/lectores-consulta";

/**
 * Detalle de la lectura, lector por lector y lectura por lectura, con los mismos filtros que el resto del centro de análisis
 * (ciudad, dispositivo, origen, sección, periodo…). El lector es el código aleatorio del navegador, no una persona: solo se
 * muestra el nombre y el correo de quien autorizó expresamente que su lectura se relacione con su suscripción (y solo si
 * quien mira tiene el permiso del boletín: `conNombres`).
 */
const filas = <T,>(r: unknown) => rowsOf<Record<string, unknown>>(r) as unknown as T[];
const TZ = "America/Bogota";

export type Lector = {
  id: string;
  codigo: string;
  nombre: string | null;
  correo: string | null;
  ciudad: string | null;
  dispositivo: string | null;
  navegador: string | null;
  notas: number;
  dias: number;
  segundos: number;
  scroll: number;
  completas: number;
  primera: string;
  ultima: string;
  horaHabitual: number | null;
  seccion: string | null;
  fuente: string | null;
};

export type Registro = {
  cuando: string;
  lector: string;
  codigo: string;
  nombre: string | null;
  ciudad: string | null;
  slug: string;
  titulo: string;
  seccion: string | null;
  segundos: number;
  scroll: number;
  dispositivo: string;
  navegador: string | null;
  sistema: string | null;
  fuente: string | null;
  recurrente: boolean;
};

// Quién es cada navegador, si autorizó: solo personas suscritas, con autorización y sin baja.
const IDENTIDAD = sql`select distinct on (sv.visitor_id) sv.visitor_id, trim(coalesce(n.first_name, '') || ' ' || coalesce(n.last_name, '')) nombre, n.email correo, sv.linked_at
  from subscriber_visitors sv join newsletter_subscribers n on n.id = sv.subscriber_id
  where n.reading_authorized_at is not null and n.unsubscribed_at is null order by sv.visitor_id, sv.verified desc`;

/** Un renglón por lector (navegador) con lo que leyó: cuántas notas, cuánto tiempo, a qué hora, desde dónde y con qué. */
export async function lectoresDetalle(f: Filtros, conNombres: boolean): Promise<{ filas: Lector[]; total: number }> {
  const r = filas<Lector & { total: number }>(
    await db.execute(sql`with ident as (${IDENTIDAD}),
      lect as (select s.visitor_id, s.created_at, s.seconds, s.max_scroll, s.city, s.device, s.browser, s.source, c.name categoria ${DESDE} where ${donde(f)}),
      agg as (select visitor_id, count(*)::int notas, count(distinct (created_at at time zone ${TZ})::date)::int dias, coalesce(sum(seconds), 0)::int segundos,
        coalesce(avg(max_scroll), 0)::float scroll, (count(*) filter (where max_scroll >= 85))::int completas, min(created_at)::text primera, max(created_at)::text ultima,
        mode() within group (order by extract(hour from created_at at time zone ${TZ})::int) "horaHabitual", mode() within group (order by city) ciudad,
        mode() within group (order by device) dispositivo, mode() within group (order by browser) navegador, mode() within group (order by categoria) seccion,
        mode() within group (order by source) fuente from lect group by visitor_id)
      select a.visitor_id::text id, upper(right(replace(a.visitor_id::text, '-', ''), 6)) codigo,
        ${conNombres ? sql`nullif(i.nombre, '')` : sql`null`} nombre, ${conNombres ? sql`i.correo` : sql`null`} correo,
        a.notas, a.dias, a.segundos, a.scroll, a.completas, a.primera, a.ultima, a."horaHabitual", a.ciudad, a.dispositivo, a.navegador, a.seccion, a.fuente,
        (count(*) over ())::int total
      from agg a left join ident i on i.visitor_id = a.visitor_id order by a.notas desc, a.ultima desc limit 150`),
  );
  return { filas: r, total: r[0]?.total ?? 0 };
}

/** Las lecturas una por una, de la más reciente a la más antigua; con `lector` solo las de ese navegador. */
export async function registroLecturas(f: Filtros, conNombres: boolean, lector?: string): Promise<Registro[]> {
  return filas<Registro>(
    await db.execute(sql`with ident as (${IDENTIDAD})
      select s.created_at::text cuando, s.visitor_id::text lector, upper(right(replace(s.visitor_id::text, '-', ''), 6)) codigo,
        ${conNombres ? sql`nullif(i.nombre, '')` : sql`null`} nombre, s.city ciudad, a.slug, a.title titulo, c.name seccion, s.seconds segundos,
        s.max_scroll scroll, s.device dispositivo, s.browser navegador, s.os sistema, s.source fuente, s.returning recurrente
      ${DESDE} left join ident i on i.visitor_id = s.visitor_id
      where ${donde(f)} ${lector ? sql`and s.visitor_id = ${lector}::uuid` : sql``}
      order by s.created_at desc limit 200`),
  );
}
