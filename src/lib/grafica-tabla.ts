/**
 * Gráfica a partir de una tabla que sube quien redacta (Excel o CSV ya leído en el navegador, ver `leer-hoja.ts`). Sin base de datos ni IA: aquí
 * se leen los números (formato colombiano «1.234,5», inglés «1,234.5», con $ o %) y se arma la gráfica con las columnas elegidas. La IA, si se
 * usa, solo ELIGE columnas y escribe el título: los valores salen siempre de la tabla, nunca del modelo.
 */
import type { ChartSpec } from "@/lib/chart-svg";

export type Tabla = string[][];

/** Número de una celda, o null si no es un número. */
export function numero(celda: string): number | null {
  let t = celda.replace(/[\s$€%]|COP|USD|US\$/gi, "").trim();
  if (!t || !/^[-+(]?\d/.test(t)) return null;
  const negativo = /^\(.*\)$/.test(t) || t.startsWith("-");
  t = t.replace(/[()+-]/g, "");
  const puntos = (t.match(/\./g) ?? []).length;
  const comas = (t.match(/,/g) ?? []).length;
  if (puntos && comas) {
    // El último separador es el decimal.
    t = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (comas) {
    t = comas === 1 && !/,\d{3}$/.test(t) ? t.replace(",", ".") : t.replace(/,/g, "");
  } else if (puntos > 1 || /\.\d{3}$/.test(t)) {
    t = t.replace(/\./g, "");
  }
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? (negativo ? -n : n) : null;
}

/** Fila de encabezados: la primera fila en la que la mayoría de las celdas no son números. */
export function filaEncabezado(t: Tabla): number {
  for (let i = 0; i < Math.min(t.length, 5); i++) {
    const llenas = t[i].filter((c) => c.trim());
    if (llenas.length >= 2 && llenas.filter((c) => numero(c) === null).length >= llenas.length * 0.6) return i;
  }
  return -1;
}

export type Lectura = { encabezados: string[]; filas: Tabla; numericas: number[]; texto: number[] };

/** Encabezados, filas de datos y qué columnas son numéricas (al menos el 70 % de sus celdas con valor). */
export function leerTabla(t: Tabla): Lectura {
  const h = filaEncabezado(t);
  const ancho = Math.max(0, ...t.map((f) => f.length));
  const encabezados = Array.from({ length: ancho }, (_, i) => (h >= 0 ? t[h][i] ?? "" : "").trim() || `Columna ${i + 1}`);
  const filas = t.slice(h + 1).filter((f) => f.some((c) => c.trim()));
  const numericas: number[] = [];
  const texto: number[] = [];
  for (let i = 0; i < ancho; i++) {
    const conValor = filas.map((f) => f[i] ?? "").filter((c) => c.trim());
    if (!conValor.length) continue;
    if (conValor.filter((c) => numero(c) !== null).length >= conValor.length * 0.7) numericas.push(i);
    else texto.push(i);
  }
  return { encabezados, filas, numericas, texto };
}

/** Arma la gráfica con la columna de etiquetas y las columnas de series elegidas (hasta 4 series y 24 filas). */
export function graficaDeTabla(
  l: Lectura,
  eleccion: { etiquetas: number; series: number[]; titulo: string; unidad: string; tipo: ChartSpec["type"]; fuente: string },
): ChartSpec | { error: string } {
  const series = eleccion.series.filter((i) => l.numericas.includes(i)).slice(0, 4);
  if (!series.length) return { error: "No encontré columnas con números para graficar." };
  const filas = l.filas.filter((f) => (f[eleccion.etiquetas] ?? "").trim() && series.some((i) => numero(f[i] ?? "") !== null)).slice(0, 24);
  if (filas.length < 2) return { error: "La tabla necesita al menos dos filas con datos." };
  return {
    type: eleccion.tipo,
    title: eleccion.titulo.slice(0, 110),
    unit: eleccion.unidad.slice(0, 70),
    labels: filas.map((f) => (f[eleccion.etiquetas] ?? "").slice(0, 30)),
    series: series.map((i) => ({ name: l.encabezados[i].slice(0, 40), values: filas.map((f) => numero(f[i] ?? "") ?? 0) })),
    source: eleccion.fuente.slice(0, 160),
  };
}

/** Elección sin IA: primera columna de texto como etiquetas y las numéricas como series; línea si las etiquetas son años o meses. */
export function eleccionSencilla(l: Lectura, nombreArchivo: string) {
  const etiquetas = l.texto[0] ?? (l.numericas.length > 1 ? l.numericas[0] : 0);
  const series = l.numericas.filter((i) => i !== etiquetas);
  const tiempo = l.filas.slice(0, 6).every((f) => /^(19|20)\d{2}|^(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)/i.test((f[etiquetas] ?? "").trim()));
  return {
    etiquetas,
    series,
    titulo: series.length === 1 ? `${l.encabezados[series[0]]} por ${l.encabezados[etiquetas].toLowerCase()}` : nombreArchivo.replace(/\.[a-z]+$/i, ""),
    unidad: "",
    tipo: (tiempo ? "line" : "bar") as ChartSpec["type"],
    fuente: `Datos: ${nombreArchivo}`,
  };
}
