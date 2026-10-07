import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db, rowsOf } from "@/db";
import { periodoAnterior, type Filtros } from "@/lib/lectores-filtros";
import { LECTURA_COMPLETA } from "@/lib/lectores-entrada";

/**
 * Consultas del centro de análisis de lectores. Todas reciben los mismos `Filtros` y se arman con las mismas condiciones,
 * así que cada tarjeta del panel responde a lo mismo que el resto. Las horas y los días son de Colombia; nada devuelve un
 * visitante individual (el código aleatorio solo sirve para contar personas distintas).
 */
const TZ = "America/Bogota";
export const DESDE = sql`from reader_sessions s join articles a on a.id = s.article_id left join categories c on c.id = a.category_id`;

// Condiciones comunes. `sin` deja fuera un filtro (para las listas de opciones, que no deben encogerse al elegir).
export function donde(f: Filtros, rango = { desde: f.desde, hasta: f.hasta }, sin: (keyof Filtros)[] = []): SQL {
  const p: SQL[] = [
    sql`s.created_at >= (${rango.desde}::date)::timestamp at time zone ${TZ}`,
    sql`s.created_at < ((${rango.hasta}::date + 1)::timestamp at time zone ${TZ})`,
  ];
  if (f.dispositivo && !sin.includes("dispositivo")) p.push(sql`s.device = ${f.dispositivo}`);
  if (f.ciudad && !sin.includes("ciudad")) p.push(sql`s.city = ${f.ciudad}`);
  if (f.fuente && !sin.includes("fuente")) p.push(sql`s.source = ${f.fuente}`);
  if (f.categoria && !sin.includes("categoria")) p.push(sql`c.slug = ${f.categoria}`);
  if (f.visitante && !sin.includes("visitante")) p.push(sql`s.returning = ${f.visitante === "recurrente"}`);
  return sql.join(p, sql` and `);
}
const filas = <T,>(r: unknown) => rowsOf<Record<string, unknown>>(r) as unknown as T[];

export type Indicadores = { lecturas: number; visitantes: number; segundosMedios: number; segundosMediana: number; scrollMedio: number; completas: number; recurrentes: number; rebotes: number };
export type Dia = { dia: string; lecturas: number; visitantes: number; recurrentes: number };
export type Calor = { dow: number; hora: number; n: number };
export type Desglose = { clave: string; lecturas: number; visitantes: number; scroll: number; segundos: number };
export type NotaTop = { slug: string; titulo: string; categoria: string | null; lecturas: number; visitantes: number; scroll: number; segundos: number; completas: number };
export type Embudo = { alcance: { lecturas: number; a25: number; a50: number; a75: number; completas: number }; tiempo: { clave: string; n: number }[]; frecuencia: { clave: string; n: number }[] };
export type Opciones = { ciudades: { valor: string; n: number }[]; fuentes: { valor: string; n: number }[]; categorias: { valor: string; etiqueta: string; n: number }[] };

/** Todo lo que muestra el panel para unos filtros. */
export type Panorama = {
  hayLecturas: boolean;
  indicadores: Indicadores;
  anterior: Indicadores;
  /** Lecturas contadas por el contador simple (todas las visitas) en el mismo periodo: sirve para decir qué parte de ellas acepta la medición. */
  lecturasTotales: number;
  serie: Dia[];
  calor: Calor[];
  embudo: Embudo;
  dispositivos: Desglose[];
  navegadores: Desglose[];
  sistemas: Desglose[];
  fuentes: Desglose[];
  ciudades: Desglose[];
  regiones: Desglose[];
  categorias: Desglose[];
  notas: NotaTop[];
  opciones: Opciones;
};

async function indicadores(f: Filtros, rango = { desde: f.desde, hasta: f.hasta }): Promise<Indicadores> {
  const [r] = filas<Record<string, number>>(
    await db.execute(sql`select count(*)::int lecturas, count(distinct s.visitor_id)::int visitantes,
      coalesce(avg(s.seconds), 0)::float "segundosMedios", coalesce(percentile_cont(0.5) within group (order by s.seconds), 0)::float "segundosMediana",
      coalesce(avg(s.max_scroll), 0)::float "scrollMedio",
      (count(*) filter (where s.max_scroll >= ${LECTURA_COMPLETA}))::int completas, (count(*) filter (where s.returning))::int recurrentes,
      (count(*) filter (where s.seconds < 10 and s.max_scroll < 25))::int rebotes
      ${DESDE} where ${donde(f, rango)}`),
  );
  return { lecturas: 0, visitantes: 0, segundosMedios: 0, segundosMediana: 0, scrollMedio: 0, completas: 0, recurrentes: 0, rebotes: 0, ...r };
}

async function desglose(columna: "device" | "browser" | "os" | "source" | "city" | "region" | "categoria", f: Filtros, limite: number): Promise<Desglose[]> {
  const col = columna === "categoria" ? sql`c.name` : sql.raw(`s.${columna}`);
  return filas<Desglose>(
    await db.execute(sql`select coalesce(${col}, 'Sin dato') clave, count(*)::int lecturas, count(distinct s.visitor_id)::int visitantes,
      coalesce(avg(s.max_scroll), 0)::float scroll, coalesce(avg(s.seconds), 0)::float segundos
      ${DESDE} where ${donde(f)} group by 1 order by 2 desc, 1 limit ${limite}`),
  );
}

export async function panorama(f: Filtros): Promise<Panorama> {
  const ant = periodoAnterior(f);
  const [existe] = filas<{ n: number }>(await db.execute(sql`select count(*)::int n from (select 1 from reader_sessions limit 1) t`));
  const [
    actual, previo, [totales], serie, calor, [alcance], tiempo, frecuencia,
    dispositivos, navegadores, sistemas, fuentes, ciudades, regiones, categorias, notas, optCiudades, optFuentes, optCategorias,
  ] = await Promise.all([
    indicadores(f),
    indicadores(f, ant),
    db.execute(sql`select coalesce(sum(views), 0)::int n from article_views_daily where day between ${f.desde}::date and ${f.hasta}::date`).then((r) => filas<{ n: number }>(r)),
    db.execute(sql`select to_char((s.created_at at time zone ${TZ})::date, 'YYYY-MM-DD') dia, count(*)::int lecturas, count(distinct s.visitor_id)::int visitantes,
      (count(*) filter (where s.returning))::int recurrentes ${DESDE} where ${donde(f)} group by 1 order by 1`).then((r) => filas<Dia>(r)),
    db.execute(sql`select extract(dow from s.created_at at time zone ${TZ})::int dow, extract(hour from s.created_at at time zone ${TZ})::int hora, count(*)::int n
      ${DESDE} where ${donde(f)} group by 1, 2`).then((r) => filas<Calor>(r)),
    db.execute(sql`select count(*)::int lecturas, (count(*) filter (where s.max_scroll >= 25))::int a25, (count(*) filter (where s.max_scroll >= 50))::int a50,
      (count(*) filter (where s.max_scroll >= 75))::int a75, (count(*) filter (where s.max_scroll >= ${LECTURA_COMPLETA}))::int completas
      ${DESDE} where ${donde(f)}`).then((r) => filas<Embudo["alcance"]>(r)),
    db.execute(sql`select case when s.seconds < 10 then '0' when s.seconds < 30 then '1' when s.seconds < 60 then '2' when s.seconds < 180 then '3' else '4' end clave, count(*)::int n
      ${DESDE} where ${donde(f)} group by 1 order by 1`).then((r) => filas<{ clave: string; n: number }>(r)),
    db.execute(sql`select case when n = 1 then '1' when n = 2 then '2' when n <= 5 then '3' else '4' end clave, count(*)::int n
      from (select s.visitor_id, count(*) n ${DESDE} where ${donde(f)} group by 1) t group by 1 order by 1`).then((r) => filas<{ clave: string; n: number }>(r)),
    desglose("device", f, 6),
    desglose("browser", f, 8),
    desglose("os", f, 8),
    desglose("source", f, 12),
    desglose("city", f, 12),
    desglose("region", f, 40),
    desglose("categoria", f, 12),
    db.execute(sql`select a.slug, a.title titulo, c.name categoria, count(*)::int lecturas, count(distinct s.visitor_id)::int visitantes,
      coalesce(avg(s.max_scroll), 0)::float scroll, coalesce(avg(s.seconds), 0)::float segundos,
      (count(*) filter (where s.max_scroll >= ${LECTURA_COMPLETA}))::int completas
      ${DESDE} where ${donde(f)} group by a.id, a.slug, a.title, c.name order by lecturas desc, a.title limit 15`).then((r) => filas<NotaTop>(r)),
    db.execute(sql`select s.city valor, count(*)::int n ${DESDE} where ${donde(f, undefined, ["ciudad"])} and s.city is not null group by 1 order by 2 desc, 1 limit 40`).then((r) => filas<{ valor: string; n: number }>(r)),
    db.execute(sql`select s.source valor, count(*)::int n ${DESDE} where ${donde(f, undefined, ["fuente"])} and s.source is not null group by 1 order by 2 desc, 1 limit 30`).then((r) => filas<{ valor: string; n: number }>(r)),
    db.execute(sql`select c.slug valor, c.name etiqueta, count(*)::int n ${DESDE} where ${donde(f, undefined, ["categoria"])} and c.slug is not null group by 1, 2 order by 3 desc, 2`).then((r) => filas<{ valor: string; etiqueta: string; n: number }>(r)),
  ]);

  // Días sin lecturas también cuentan (cero), para que la línea no salte.
  const porDia = new Map(serie.map((d) => [d.dia, d]));
  const completa: Dia[] = [];
  for (let t = Date.parse(`${f.desde}T00:00:00Z`); t <= Date.parse(`${f.hasta}T00:00:00Z`); t += 86_400_000) {
    const dia = new Date(t).toISOString().slice(0, 10);
    completa.push(porDia.get(dia) ?? { dia, lecturas: 0, visitantes: 0, recurrentes: 0 });
  }
  const llena = (esperadas: string[], filasConteo: { clave: string; n: number }[]) => esperadas.map((clave) => ({ clave, n: filasConteo.find((x) => x.clave === clave)?.n ?? 0 }));

  return {
    hayLecturas: (existe?.n ?? 0) > 0,
    indicadores: actual,
    anterior: previo,
    lecturasTotales: totales?.n ?? 0,
    serie: completa,
    calor,
    embudo: { alcance: alcance ?? { lecturas: 0, a25: 0, a50: 0, a75: 0, completas: 0 }, tiempo: llena(["0", "1", "2", "3", "4"], tiempo), frecuencia: llena(["1", "2", "3", "4"], frecuencia) },
    dispositivos, navegadores, sistemas, fuentes, ciudades, regiones, categorias, notas,
    opciones: { ciudades: optCiudades, fuentes: optFuentes, categorias: optCategorias },
  };
}
