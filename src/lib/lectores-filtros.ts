/**
 * Filtros del centro de análisis de lectores: se leen de la dirección (para que cada vista se pueda guardar y compartir),
 * se validan y se les calcula el periodo anterior para las comparaciones. Pura y probada; las fechas son de Colombia.
 */
export type Filtros = {
  /** Primer día incluido, `aaaa-mm-dd` (hora de Colombia). */
  desde: string;
  /** Último día incluido. */
  hasta: string;
  dispositivo?: "mobile" | "tablet" | "desktop";
  ciudad?: string;
  fuente?: string;
  categoria?: string;
  visitante?: "nuevo" | "recurrente";
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const DIA = 86_400_000;
const dia = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const ms = (f: string) => Date.parse(`${f}T00:00:00Z`);

/** La fecha de hoy en Colombia (UTC−5, sin horario de verano). */
export const hoyColombia = (ahora = new Date()) => dia(ahora.getTime() - 5 * 3_600_000);

/** Atajos de periodo, en días hacia atrás desde hoy (incluido). */
export const PERIODOS = [7, 30, 90, 365] as const;

const un = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const texto = (v: string | string[] | undefined, max = 80) => un(v).replace(/[\u0000-\u001f]/g, "").trim().slice(0, max) || undefined;

export function leerFiltros(q: Record<string, string | string[] | undefined>, ahora = new Date()): Filtros {
  const hoy = hoyColombia(ahora);
  let hasta = FECHA.test(un(q.hasta)) && !Number.isNaN(ms(un(q.hasta))) ? un(q.hasta) : hoy;
  if (hasta > hoy) hasta = hoy;
  let desde = FECHA.test(un(q.desde)) && !Number.isNaN(ms(un(q.desde))) ? un(q.desde) : dia(ms(hasta) - 29 * DIA);
  if (desde > hasta) desde = hasta;
  // Un rango de más de dos años se acorta: la medición es de 400 días y una consulta enorme no ayuda a nadie.
  if (ms(hasta) - ms(desde) > 730 * DIA) desde = dia(ms(hasta) - 730 * DIA);
  const d = un(q.dispositivo);
  const v = un(q.visitante);
  return {
    desde,
    hasta,
    dispositivo: d === "mobile" || d === "tablet" || d === "desktop" ? d : undefined,
    ciudad: texto(q.ciudad),
    fuente: texto(q.fuente),
    categoria: texto(q.categoria, 60),
    visitante: v === "nuevo" || v === "recurrente" ? v : undefined,
  };
}

/** El periodo inmediatamente anterior y de la misma duración (para «frente al periodo anterior»). */
export function periodoAnterior(f: Pick<Filtros, "desde" | "hasta">): { desde: string; hasta: string; dias: number } {
  const dias = Math.round((ms(f.hasta) - ms(f.desde)) / DIA) + 1;
  return { desde: dia(ms(f.desde) - dias * DIA), hasta: dia(ms(f.desde) - DIA), dias };
}

/** Pasa los filtros a parámetros de dirección (solo los que tienen valor). */
export function aParametros(f: Partial<Filtros>): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, String(v));
  return p;
}

/** Cuántas notas de filtro hay activas además del rango de fechas (para el distintivo «3 filtros»). */
export const filtrosActivos = (f: Filtros) => [f.dispositivo, f.ciudad, f.fuente, f.categoria, f.visitante].filter(Boolean).length;
