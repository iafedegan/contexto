/**
 * Lectura del CSV que publica FEDEGÁN para cada indicador ganadero (estadisticas.fedegan.org.co, `export.jsp`).
 * Es puro (sin red ni base de datos) para poder probarlo: `indicadores-fedegan.ts` descarga y este archivo interpreta.
 *
 * Formato: una línea con el título, una cabecera `Fecha;Serie 1;Serie 2;…;` y una fila por mes: `ago/2026;10.490;11.438;`.
 * Los miles van con punto, las celdas sin dato van vacías y el archivo viene en ISO-8859-1 (las tildes de la cabecera
 * llegan rotas): por eso los nombres de las series los pone el catálogo y no se leen de aquí.
 */

/** Un mes con sus valores, uno por serie (`null` si ese mes no hay dato). */
export type SerieCsv = { nombre: string; valores: (number | null)[] };
// Tabla ya interpretada: los meses y una serie por columna.
export type TablaCsv = { periodos: string[]; series: SerieCsv[] };

// Fila de datos: mes abreviado, barra y año, y el resto de celdas separadas por «;».
const FILA = /^([a-záéíóú]{3})\/(\d{4});(.*)$/i;

/** «10.490» → 10490, «10,5» → 10.5, vacío o ilegible → null. */
export function numeroDelCsv(celda: string): number | null {
  const t = celda.trim();
  if (!t) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Interpreta el CSV. `nombres` son las series que se esperan, en el orden de las columnas pedidas. Devuelve `null` si
 * no hay al menos dos meses con dato o si alguna serie queda vacía: mejor ocultar el indicador que dibujar uno roto.
 */
export function parsearCsvIndicador(texto: string, nombres: string[]): TablaCsv | null {
  const periodos: string[] = [];
  const columnas: (number | null)[][] = nombres.map(() => []);
  for (const linea of texto.split(/\r?\n/)) {
    const m = FILA.exec(linea.trim());
    if (!m) continue;
    periodos.push(`${m[1].toLowerCase()}/${m[2]}`);
    const celdas = m[3].split(";");
    nombres.forEach((_, i) => columnas[i].push(numeroDelCsv(celdas[i] ?? "")));
  }
  if (periodos.length < 2) return null;
  if (columnas.some((c) => c.every((v) => v === null))) return null;
  return { periodos, series: nombres.map((nombre, i) => ({ nombre, valores: columnas[i] })) };
}

/** Los doce meses que terminan en el mes de `ahora` (hora de Colombia), en el formato del origen: `dd-mm-aaaa`. */
export function rangoDeMeses(ahora: Date, meses = 12): { desde: string; hasta: string } {
  // Colombia no tiene horario de verano: UTC−5 todo el año.
  const c = new Date(ahora.getTime() - 5 * 3_600_000);
  const dos = (n: number) => String(n).padStart(2, "0");
  const inicio = new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() - (meses - 1), 1));
  const fin = new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + 1, 0));
  return {
    desde: `01-${dos(inicio.getUTCMonth() + 1)}-${inicio.getUTCFullYear()}`,
    hasta: `${dos(fin.getUTCDate())}-${dos(fin.getUTCMonth() + 1)}-${fin.getUTCFullYear()}`,
  };
}
