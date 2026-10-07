/**
 * Piezas comunes de las gráficas de indicadores (portada y Observatorio): curvas, ejes, variaciones y formatos de cifras.
 * Son funciones puras: el dibujo en sí vive en los componentes.
 */
import { nfCO } from "@/lib/format";

export type Punto = { x: number; y: number };

/** Cómo se escribe una cifra: pesos con «$», enteros con miles, o con 1 a 3 decimales. */
export type Formato = "pesos" | "entero" | "decimal1" | "decimal2" | "decimal3";

const nf = (d: number) => new Intl.NumberFormat("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });
const NF = { 1: nf(1), 2: nf(2), 3: nf(3) };

/** «10490» → «$10.490»; «2196342» → «2.196.342»; con `prefijo` se antepone («US$ »). */
export function formatear(v: number, formato: Formato = "entero", prefijo = ""): string {
  const n = formato === "pesos" ? nfCO.format(Math.round(v)) : formato === "entero" ? nfCO.format(Math.round(v)) : NF[formato === "decimal1" ? 1 : formato === "decimal2" ? 2 : 3].format(v);
  return `${formato === "pesos" ? "$" : prefijo}${n}`;
}

/** Cifra corta para ejes y tarjetas: 20204979 → «20,2 M»; 436497 → «436 mil»; 3826 → «3.826». */
export function compacto(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e6) return `${NF[1].format(v / 1e6)} M`;
  if (a >= 1e5) return `${nfCO.format(Math.round(v / 1e3))} mil`;
  return nfCO.format(Math.round(v * 100) / 100);
}

/** «+4,7 %» / «−1,2 %». */
export const pct = (n: number) => `${n >= 0 ? "+" : "−"}${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(Math.abs(n))} %`;

/** Curva suave que no se pasa de los datos (interpolación monótona de Fritsch–Carlson): sin «olas» que inventen picos. */
export function trazoSuave(p: Punto[]): string {
  const n = p.length;
  if (n === 0) return "";
  if (n === 1) return `M${p[0].x} ${p[0].y}`;
  const dx = Array.from({ length: n - 1 }, (_, i) => p[i + 1].x - p[i].x);
  const m = Array.from({ length: n - 1 }, (_, i) => (p[i + 1].y - p[i].y) / dx[i]);
  const t = new Array<number>(n);
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${p[0].x.toFixed(1)} ${p[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${(p[i].x + h).toFixed(1)} ${(p[i].y + t[i] * h).toFixed(1)} ${(p[i + 1].x - h).toFixed(1)} ${(p[i + 1].y - t[i + 1] * h).toFixed(1)} ${p[i + 1].x.toFixed(1)} ${p[i + 1].y.toFixed(1)}`;
  }
  return d;
}

/** Trozos de puntos consecutivos con dato: un mes sin dato corta la línea en vez de inventar un valor. */
export function tramos(valores: (number | null)[], x: (i: number) => number, y: (v: number) => number): Punto[][] {
  const salida: Punto[][] = [];
  let actual: Punto[] = [];
  valores.forEach((v, i) => {
    if (v === null) {
      if (actual.length) salida.push(actual);
      actual = [];
    } else actual.push({ x: x(i), y: y(v) });
  });
  if (actual.length) salida.push(actual);
  return salida;
}

/** Marcas «redondas» del eje vertical: 4 o 5 valores con pasos de 1, 2 o 5 por una potencia de diez. */
export function marcasEje(min: number, max: number): number[] {
  const bruto = (max - min || Math.abs(max) * 0.1 || 1) / 4;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((f) => f * pot).find((p) => p >= bruto) ?? 10 * pot;
  const marcas: number[] = [];
  for (let v = Math.floor(min / paso) * paso; v <= Math.ceil(max / paso) * paso + 1e-9; v += paso) marcas.push(v);
  return marcas;
}

/** Variación del mes `i` frente al anterior con dato; `null` si no hay con qué comparar. */
export function variacion(valores: (number | null)[], i: number): number | null {
  const actual = valores[i];
  if (actual === null || actual === undefined) return null;
  for (let j = i - 1; j >= 0; j--) {
    const previo = valores[j];
    if (previo !== null && previo !== 0) return ((actual - previo) / previo) * 100;
  }
  return null;
}

// Último mes con dato en alguna de las series visibles.
export const ultimoConDato = (series: { valores: (number | null)[] }[]) => {
  const n = series[0]?.valores.length ?? 0;
  for (let i = n - 1; i >= 0; i--) if (series.some((s) => s.valores[i] !== null)) return i;
  return n - 1;
};


const MESES_LARGOS: Record<string, string> = { ene: "enero", feb: "febrero", mar: "marzo", abr: "abril", may: "mayo", jun: "junio", jul: "julio", ago: "agosto", sep: "septiembre", oct: "octubre", nov: "noviembre", dic: "diciembre" };
/** «ago/2026» → «agosto de 2026»; «2025» → «2025». */
export const periodoLargo = (p: string) => {
  const [m, a] = p.split("/");
  return a ? `${MESES_LARGOS[m] ?? m} de ${a}` : p;
};
