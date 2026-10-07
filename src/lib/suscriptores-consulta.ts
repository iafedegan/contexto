import "server-only";
import { sql } from "drizzle-orm";
import { db, rowsOf } from "@/db";
import { periodoAnterior, type Filtros } from "@/lib/lectores-filtros";

/**
 * Análisis de la base de suscriptores del boletín (no de lo que leen: eso necesita identificarlos y va aparte). Usa solo
 * lo que el alta ya guarda: cuándo se suscribió, si confirmó, de qué ciudad y país, cómo se ubicó, su edad por rango
 * (nunca la fecha de nacimiento) y el proveedor de su correo (sin guardar ni mostrar direcciones). Todo agregado: ninguna
 * persona aparece sola. El rango de fechas es el mismo del resto del centro de análisis; los demás filtros no aplican aquí.
 */
const TZ = "America/Bogota";
const filas = <T,>(r: unknown) => rowsOf<Record<string, unknown>>(r) as unknown as T[];
const enRango = (r: { desde: string; hasta: string }) =>
  sql`created_at >= (${r.desde}::date)::timestamp at time zone ${TZ} and created_at < ((${r.hasta}::date + 1)::timestamp at time zone ${TZ})`;

export type ResumenSuscriptores = {
  total: number;
  activos: number;
  pendientes: number;
  bajas: number;
  altasPeriodo: number;
  altasAnterior: number;
  bajasPeriodo: number;
  confirmacion: number;
};
export type PuntoAltas = { dia: string; altas: number; acumulado: number };
export type Conteo = { clave: string; n: number };
export type PanoramaSuscriptores = {
  resumen: ResumenSuscriptores;
  serie: PuntoAltas[];
  ciudades: Conteo[];
  paises: Conteo[];
  edades: Conteo[];
  ubicacion: Conteo[];
  correos: Conteo[];
  /** Cuántos suscriptores activos informaron fecha de nacimiento, ciudad y celular (para saber qué tan completa está la base). */
  completitud: { edad: number; ciudad: number; celular: number; activos: number };
};

export async function panoramaSuscriptores(f: Pick<Filtros, "desde" | "hasta">): Promise<PanoramaSuscriptores> {
  const ant = periodoAnterior(f);
  const activo = sql`confirmed and unsubscribed_at is null`;
  const [[r], serie, ciudades, paises, edades, ubicacion, correos, [comp]] = await Promise.all([
    db
      .execute(sql`select count(*)::int total, (count(*) filter (where ${activo}))::int activos,
        (count(*) filter (where not confirmed and unsubscribed_at is null))::int pendientes, (count(*) filter (where unsubscribed_at is not null))::int bajas,
        (count(*) filter (where ${enRango(f)}))::int "altasPeriodo", (count(*) filter (where ${enRango(ant)}))::int "altasAnterior",
        (count(*) filter (where unsubscribed_at is not null and unsubscribed_at >= (${f.desde}::date)::timestamp at time zone ${TZ} and unsubscribed_at < ((${f.hasta}::date + 1)::timestamp at time zone ${TZ})))::int "bajasPeriodo",
        (count(*) filter (where confirmed))::int confirmados from newsletter_subscribers`)
      .then((x) => filas<Record<string, number>>(x)),
    db
      .execute(sql`with antes as (select count(*)::int n from newsletter_subscribers where ${activo} and created_at < (${f.desde}::date)::timestamp at time zone ${TZ}),
        d as (select to_char((created_at at time zone ${TZ})::date, 'YYYY-MM-DD') dia, count(*)::int altas from newsletter_subscribers where ${enRango(f)} group by 1)
        select dia, altas, (select n from antes) base from d order by dia`)
      .then((x) => filas<{ dia: string; altas: number; base: number }>(x)),
    db.execute(sql`select coalesce(nullif(signup_city, ''), 'Sin dato') clave, count(*)::int n from newsletter_subscribers where ${activo} group by 1 order by 2 desc, 1 limit 10`).then((x) => filas<Conteo>(x)),
    db.execute(sql`select coalesce(nullif(signup_country, ''), 'Sin dato') clave, count(*)::int n from newsletter_subscribers where ${activo} group by 1 order by 2 desc, 1 limit 8`).then((x) => filas<Conteo>(x)),
    db
      .execute(sql`select case when birth_date is null then 'Sin dato' when age < 18 then 'Menos de 18' when age < 25 then '18 a 24' when age < 35 then '25 a 34' when age < 45 then '35 a 44' when age < 55 then '45 a 54' when age < 65 then '55 a 64' else '65 o más' end clave, count(*)::int n
        from (select birth_date, extract(year from age(birth_date))::int age from newsletter_subscribers where ${activo}) t group by 1`)
      .then((x) => filas<Conteo>(x)),
    db.execute(sql`select coalesce(signup_geo_source, 'sin dato') clave, count(*)::int n from newsletter_subscribers where ${activo} group by 1 order by 2 desc`).then((x) => filas<Conteo>(x)),
    db
      .execute(sql`select case when d in ('gmail.com','googlemail.com') then 'Gmail' when d in ('hotmail.com','outlook.com','live.com','hotmail.es','outlook.es','msn.com') then 'Outlook / Hotmail' when d in ('yahoo.com','yahoo.es','ymail.com') then 'Yahoo' when d like '%.edu%' or d like '%.gov%' then 'Educativo / Gobierno' else 'Otros' end clave, count(*)::int n
        from (select lower(split_part(email, '@', 2)) d from newsletter_subscribers where ${activo}) t group by 1 order by 2 desc`)
      .then((x) => filas<Conteo>(x)),
    db
      .execute(sql`select (count(*) filter (where birth_date is not null))::int edad, (count(*) filter (where signup_city is not null and signup_city <> ''))::int ciudad,
        (count(*) filter (where mobile is not null and mobile <> ''))::int celular, count(*)::int activos from newsletter_subscribers where ${activo}`)
      .then((x) => filas<PanoramaSuscriptores["completitud"]>(x)),
  ]);

  // Altas por día con ceros y el acumulado de activos (base anterior al rango + lo que va sumando).
  const porDia = new Map(serie.map((d) => [d.dia, d.altas]));
  let acumulado = serie[0]?.base ?? (await baseAntes(f.desde));
  const completa: PuntoAltas[] = [];
  for (let t = Date.parse(`${f.desde}T00:00:00Z`); t <= Date.parse(`${f.hasta}T00:00:00Z`); t += 86_400_000) {
    const dia = new Date(t).toISOString().slice(0, 10);
    const altas = porDia.get(dia) ?? 0;
    acumulado += altas;
    completa.push({ dia, altas, acumulado });
  }
  const resumen: ResumenSuscriptores = {
    total: r?.total ?? 0,
    activos: r?.activos ?? 0,
    pendientes: r?.pendientes ?? 0,
    bajas: r?.bajas ?? 0,
    altasPeriodo: r?.altasPeriodo ?? 0,
    altasAnterior: r?.altasAnterior ?? 0,
    bajasPeriodo: r?.bajasPeriodo ?? 0,
    confirmacion: (r?.total ?? 0) > 0 ? (r!.confirmados / r!.total) * 100 : 0,
  };
  const ordenEdad = ["Menos de 18", "18 a 24", "25 a 34", "35 a 44", "45 a 54", "55 a 64", "65 o más", "Sin dato"];
  return {
    resumen,
    serie: completa,
    ciudades,
    paises,
    edades: ordenEdad.map((clave) => ({ clave, n: edades.find((e) => e.clave === clave)?.n ?? 0 })).filter((e) => e.n > 0),
    ubicacion,
    correos,
    completitud: comp ?? { edad: 0, ciudad: 0, celular: 0, activos: 0 },
  };
}

// Suscriptores activos creados antes del primer día del rango (cuando el rango no trae ninguna alta).
async function baseAntes(desde: string): Promise<number> {
  const [r] = filas<{ n: number }>(await db.execute(sql`select count(*)::int n from newsletter_subscribers where confirmed and unsubscribed_at is null and created_at < (${desde}::date)::timestamp at time zone ${TZ}`));
  return r?.n ?? 0;
}
