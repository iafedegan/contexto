import type { Indicador } from "@/lib/indicadores-fedegan";
import type { Observatorio } from "@/lib/observatorio-fedegan";

/** Una cifra del Observatorio como fila de `observatorio_datos`. */
export type FilaCifra = {
  tema: string;
  indicador: string;
  titulo: string;
  unidad: string;
  fuente: string;
  serie: string;
  periodo: string;
  fecha: string | null;
  valor: number;
};

export const TEMAS_PRECIOS = ["precios"] as const;
export const TEMAS_OBSERVATORIO = ["inventario", "hato", "produccion", "consumo", "internacional", "costos"] as const;

const MES: Record<string, string> = { ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06", jul: "07", ago: "08", sep: "09", oct: "10", nov: "11", dic: "12" };

/** «sep/2026» → 2026-09-01; «2025» → 2025-01-01; `null` si no se reconoce. */
export function fechaDelPeriodo(p: string): string | null {
  const t = p.trim().toLowerCase();
  const m = t.match(/^([a-z]{3})[a-z]*[/ -](\d{4})$/);
  if (m && MES[m[1]]) return `${m[2]}-${MES[m[1]]}-01`;
  if (/^\d{4}$/.test(t)) return `${t}-01-01`;
  const iso = t.match(/^(\d{4})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-01` : null;
}

function series(tema: string, indicador: string, titulo: string, unidad: string, fuente: string, periodos: string[], s: { nombre: string; valores: (number | null)[] }[]): FilaCifra[] {
  const filas: FilaCifra[] = [];
  for (const serie of s) {
    periodos.forEach((periodo, i) => {
      const valor = serie.valores[i];
      if (valor === null || valor === undefined || !Number.isFinite(valor)) return;
      filas.push({ tema, indicador, titulo, unidad, fuente, serie: serie.nombre, periodo, fecha: fechaDelPeriodo(periodo), valor });
    });
  }
  return filas;
}

/** Los precios de la portada, una fila por región y mes. */
export function aplanarIndicadores(precios: Indicador[]): FilaCifra[] {
  return precios.flatMap((p) => series("precios", p.clave, p.titulo, p.unidad, p.fuente, p.periodos, p.series));
}

/** Todo lo demás del Observatorio: inventario por departamento, hato, y los indicadores generales por su grupo. */
export function aplanarObservatorio(o: Observatorio): FilaCifra[] {
  const filas: FilaCifra[] = [];
  for (const g of o.generales) filas.push(...series(g.grupo, g.clave, g.titulo, g.unidad, g.fuente, g.periodos, g.series));
  for (const d of o.departamental) {
    filas.push(...series("inventario", d.clave, d.titulo, d.unidad, "FEDEGÁN · Sistema de información estadística", d.periodos, d.departamentos));
    filas.push(...series("inventario", d.clave, d.titulo, d.unidad, "FEDEGÁN · Sistema de información estadística", d.periodos, [{ nombre: "Total nacional", valores: d.nacional }]));
  }
  for (const h of o.hato) {
    for (const p of h.partes) {
      filas.push({ tema: "hato", indicador: h.clave, titulo: h.titulo, unidad: h.clave === "predios" ? "predios" : "cabezas", fuente: "FEDEGÁN · Sistema de información estadística", serie: p.nombre, periodo: h.periodo, fecha: fechaDelPeriodo(h.periodo), valor: p.valor });
    }
  }
  return filas;
}
