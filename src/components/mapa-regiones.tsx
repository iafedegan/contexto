"use client";

import { useState } from "react";
import { DEPARTAMENTOS, MAPA_ALTO, MAPA_ANCHO } from "@/lib/colombia-mapa";

/**
 * Mapa de Colombia con las regiones ganaderas de FEDEGÁN coloreadas como su serie en la gráfica, y su valor encima.
 * Es una aproximación por departamentos (las regiones del origen no son límites oficiales): Caribe = Atlántico,
 * Bolívar, Cesar, Córdoba, La Guajira, Magdalena y Sucre; Magdalena Medio y Santanderes = Santander y Norte de
 * Santander; Llanos Orientales = Meta, Casanare, Arauca y Vichada. Tocar una región enciende o apaga su serie.
 */
const REGIONES: Record<string, string[]> = {
  "Región Caribe": ["ATLANTICO", "BOLIVAR", "CESAR", "CORDOBA", "LA GUAJIRA", "MAGDALENA", "SUCRE"],
  "Magdalena Medio y Santanderes": ["SANTANDER", "NORTE DE SANTANDER"],
  "Llanos Orientales": ["META", "CASANARE", "ARAUCA", "VICHADA"],
  // Series nacionales: el país entero.
  Colombia: DEPARTAMENTOS.map((d) => d.nombre),
};

// «Región Caribe» → «Caribe», «Magdalena Medio y Santanderes» → «Magdalena Medio», «Llanos Orientales» → «Llanos».
const corto = (n: string) => n.replace(/^Región /, "").split(" y ")[0].replace(" Orientales", "");

// Una serie tal como la necesita el mapa.
export type SerieMapa = { nombre: string; valor: string; color: string; encendida: boolean };

// Mapa con las regiones de las series; `alternar` enciende o apaga la serie de la región tocada.
export function MapaRegiones({ series, alternar, className = "" }: { series: SerieMapa[]; alternar: (i: number) => void; className?: string }) {
  const [sobre, setSobre] = useState<number | null>(null);
  const deRegion = (i: number) => REGIONES[series[i].nombre] ?? [];
  const pertenece = new Set(series.flatMap((_, i) => deRegion(i)));
  const nacional = series.length === 1 && series[0].nombre === "Colombia";

  return (
    <figure className={className}>
      <svg viewBox={`0 0 ${MAPA_ANCHO} ${MAPA_ALTO}`} className="mx-auto block h-auto max-h-[19rem] w-full" role="group" aria-label="Mapa de Colombia con las regiones del indicador">
        {/* Departamentos fuera de las regiones del indicador: de fondo. */}
        <g aria-hidden fill="var(--surface-2)" stroke="var(--border)" strokeWidth="0.8" strokeLinejoin="round">
          {DEPARTAMENTOS.filter((d) => !pertenece.has(d.nombre)).map((d) => (
            <path key={d.nombre} d={d.d} />
          ))}
        </g>
        {series.map((s, i) => {
          const nombres = deRegion(i);
          const deptos = DEPARTAMENTOS.filter((d) => nombres.includes(d.nombre));
          if (!deptos.length) return null;
          const activa = s.encendida && (sobre === null || sobre === i);
          const cx = deptos.reduce((t, d) => t + d.c[0], 0) / deptos.length;
          const cy = deptos.reduce((t, d) => t + d.c[1], 0) / deptos.length;
          return (
            <g
              key={s.nombre}
              role="button"
              tabIndex={0}
              aria-pressed={s.encendida}
              aria-label={`${s.nombre}: ${s.valor}`}
              className="cursor-pointer outline-none transition-opacity focus-visible:[&>g]:stroke-[var(--fg)]"
              style={{ opacity: s.encendida ? 1 : 0.35 }}
              onClick={() => (series.length > 1 ? alternar(i) : undefined)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && series.length > 1 && (e.preventDefault(), alternar(i))}
              onPointerEnter={() => setSobre(i)}
              onPointerLeave={() => setSobre(null)}
            >
              <g fill={s.color} fillOpacity={activa ? 0.78 : 0.45} stroke="var(--bg)" strokeWidth="0.9" strokeLinejoin="round">
                {deptos.map((d) => (
                  <path key={d.nombre} d={d.d} />
                ))}
              </g>
              {!nacional && (
                <g textAnchor="middle" style={{ paintOrder: "stroke" }} stroke="var(--bg)" strokeWidth="3.5" strokeLinejoin="round" pointerEvents="none">
                  <text x={cx} y={cy - 3} fontSize="11" fontWeight="600" fill="var(--fg)">{corto(s.nombre)}</text>
                  <text x={cx} y={cy + 11} fontSize="13" fontWeight="800" fill="var(--fg)" className="tabular-nums">{s.valor}</text>
                </g>
              )}
            </g>
          );
        })}
        {nacional && (
          <g textAnchor="middle" style={{ paintOrder: "stroke" }} stroke="var(--bg)" strokeWidth="4" pointerEvents="none">
            <text x={MAPA_ANCHO / 2 + 10} y={MAPA_ALTO / 2 - 4} fontSize="13" fontWeight="600" fill="var(--fg)">Colombia</text>
            <text x={MAPA_ANCHO / 2 + 10} y={MAPA_ALTO / 2 + 16} fontSize="18" fontWeight="800" fill="var(--fg)" className="tabular-nums">{series[0].valor}</text>
          </g>
        )}
      </svg>
      <figcaption className="mt-1 text-center text-[0.7rem] leading-snug text-[var(--fg-muted)]">
        Regiones aproximadas por departamentos
      </figcaption>
    </figure>
  );
}
