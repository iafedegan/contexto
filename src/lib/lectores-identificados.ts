import "server-only";
import { sql } from "drizzle-orm";
import { db, rowsOf } from "@/db";
import type { Filtros } from "@/lib/lectores-filtros";
import { donde } from "@/lib/lectores-consulta";

/**
 * Lectura de las personas suscritas que AUTORIZARON expresamente que se relacione con su suscripción. Es la única parte del
 * centro de análisis que muestra personas, y por eso: solo entran quienes tienen `reading_authorized_at`, sigan suscritas
 * y tengan un navegador vinculado; solo cuentan las lecturas posteriores al vínculo; y se muestra si el vínculo está
 * verificado (probado con un enlace del correo o al confirmar) o sin verificar (salió del formulario). Mismos filtros que el resto.
 */
const filas = <T,>(r: unknown) => rowsOf<Record<string, unknown>>(r) as unknown as T[];
const TZ = "America/Bogota";

// Navegadores vinculados de quienes autorizaron y siguen suscritos.
const VINCULOS = sql`select sv.subscriber_id, sv.visitor_id, sv.linked_at, sv.verified from subscriber_visitors sv join newsletter_subscribers n on n.id = sv.subscriber_id where n.reading_authorized_at is not null and n.unsubscribed_at is null`;

export type FilaSuscriptor = {
  id: string;
  nombre: string;
  correo: string;
  ciudad: string | null;
  alta: string;
  confirmado: boolean;
  verificado: boolean;
  notas: number;
  segundos: number;
  scroll: number;
  completas: number;
  ultima: string | null;
  horaHabitual: number | null;
  dispositivo: string | null;
  fuente: string | null;
  seccion: string | null;
};
export type Adopcion = { autorizados: number; vinculados: number; suscritos: number };
export type Lectura = { cuando: string; slug: string; titulo: string; seccion: string | null; segundos: number; scroll: number; dispositivo: string; fuente: string | null; ciudad: string | null };

/** Cuántos suscriptores autorizaron y cuántos tienen ya un navegador vinculado (para saber qué parte de la base se puede analizar). */
export async function adopcion(): Promise<Adopcion> {
  const [r] = filas<Adopcion>(
    await db.execute(sql`select (count(*) filter (where reading_authorized_at is not null and unsubscribed_at is null))::int autorizados,
      (count(*) filter (where unsubscribed_at is null and id in (select subscriber_id from subscriber_visitors)))::int vinculados,
      (count(*) filter (where unsubscribed_at is null))::int suscritos from newsletter_subscribers`),
  );
  return r ?? { autorizados: 0, vinculados: 0, suscritos: 0 };
}

/** Una fila por persona autorizada, con lo que leyó en el periodo y con los filtros aplicados (las personas sin lectura salen con ceros). */
export async function identificados(f: Filtros): Promise<FilaSuscriptor[]> {
  return filas<FilaSuscriptor>(
    await db.execute(sql`with vinc as (${VINCULOS}),
      lect as (select vinc.subscriber_id, vinc.visitor_id, s.created_at, s.seconds, s.max_scroll, s.device, s.source, c.name categoria
        from vinc join reader_sessions s on s.visitor_id = vinc.visitor_id and s.created_at >= vinc.linked_at
        join articles a on a.id = s.article_id left join categories c on c.id = a.category_id
        where ${donde(f)}),
      agg as (select subscriber_id, count(*)::int notas, coalesce(sum(seconds), 0)::int segundos, coalesce(avg(max_scroll), 0)::float scroll,
        (count(*) filter (where max_scroll >= 85))::int completas, max(created_at) ultima,
        mode() within group (order by extract(hour from created_at at time zone ${TZ})::int) hora,
        mode() within group (order by device) dispositivo, mode() within group (order by source) fuente, mode() within group (order by categoria) seccion
        from lect group by subscriber_id)
      select n.id, trim(coalesce(n.first_name, '') || ' ' || coalesce(n.last_name, '')) nombre, n.email correo, n.signup_city ciudad,
        to_char((n.created_at at time zone ${TZ})::date, 'YYYY-MM-DD') alta, n.confirmed confirmado,
        coalesce((select bool_or(v.verified) from vinc v where v.subscriber_id = n.id), false) verificado,
        coalesce(a.notas, 0) notas, coalesce(a.segundos, 0) segundos, coalesce(a.scroll, 0) scroll, coalesce(a.completas, 0) completas,
        a.ultima::text ultima, a.hora "horaHabitual", a.dispositivo, a.fuente, a.seccion
      from newsletter_subscribers n left join agg a on a.subscriber_id = n.id
      where n.reading_authorized_at is not null and n.unsubscribed_at is null
      order by notas desc, n.created_at desc limit 300`),
  );
}

/** Las lecturas de una persona (más recientes primero) en el periodo y con los filtros; vacío si no autorizó o ya no está suscrita. */
export async function lecturasDe(id: string, f: Filtros): Promise<Lectura[]> {
  return filas<Lectura>(
    await db.execute(sql`with vinc as (${VINCULOS})
      select s.created_at::text cuando, a.slug, a.title titulo, c.name seccion, s.seconds segundos, s.max_scroll scroll, s.device dispositivo, s.source fuente, s.city ciudad
      from vinc join reader_sessions s on s.visitor_id = vinc.visitor_id and s.created_at >= vinc.linked_at
      join articles a on a.id = s.article_id left join categories c on c.id = a.category_id
      where vinc.subscriber_id = ${id}::uuid and ${donde(f)}
      order by s.created_at desc limit 200`),
  );
}
