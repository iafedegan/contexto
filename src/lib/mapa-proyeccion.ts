/**
 * Pasa una coordenada (latitud, longitud) al lienzo del mapa de `colombia-mapa.ts` (300 × 412). Es la MISMA proyección con que
 * `scripts/generar-mapa.mjs` dibuja los departamentos (longitud × coseno de la latitud media), calculada sobre los límites del
 * Marco Geoestadístico Nacional del DANE (2018), así que un punto cae exactamente sobre su departamento.
 */
import { MAPA_ALTO, MAPA_ANCHO } from "@/lib/colombia-mapa";

const LON0 = -79.00698704453185;
const LAT1 = 12.440104837867828;
const K = 0.997427976005916;
const ESCALA = 24.75314092131177;
// Margen (en unidades del lienzo) que se tolera fuera del dibujo, para los puntos justo en la costa o la frontera.
const MARGEN = 6;

/** Posición en el lienzo, o `null` si el punto está fuera de Colombia continental (otro país, o San Andrés, que el mapa omite). */
export function proyectar(lat: number, lon: number): { x: number; y: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const x = (lon - LON0) * K * ESCALA;
  const y = (LAT1 - lat) * ESCALA;
  if (x < -MARGEN || y < -MARGEN || x > MAPA_ANCHO + MARGEN || y > MAPA_ALTO + MARGEN) return null;
  return { x: +x.toFixed(1), y: +y.toFixed(1) };
}
