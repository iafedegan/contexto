"use client";

import { useMemo, useState } from "react";
import { DEPARTAMENTOS, MAPA_ALTO, MAPA_ANCHO } from "@/lib/colombia-mapa";
import { proyectar } from "@/lib/mapa-proyeccion";

/** Una ciudad con suscriptores y el promedio de dónde se registraron (para ubicarla en el mapa). */
export type CiudadMapa = { clave: string; nombre: string; n: number; lat: number | null; lon: number | null };

/**
 * Mapa de Colombia con una burbuja por ciudad (su tamaño es el número de suscriptores). Pulsar una burbuja la elige o la quita: sirve
 * para decidir a qué ciudades va una edición. También se maneja con el teclado (Tab y Enter o Espacio). Las ciudades sin ubicación o
 * fuera de Colombia no se dibujan, pero siguen en la lista de ciudades del panel.
 */
export function MapaSuscriptores({ ciudades, seleccionadas, alAlternar, bloqueada }: { ciudades: CiudadMapa[]; seleccionadas: string[]; alAlternar: (clave: string) => void; bloqueada: boolean }) {
  const [foco, setFoco] = useState<string | null>(null);

  const { puntos, fuera, max } = useMemo(() => {
    const dentro: (CiudadMapa & { x: number; y: number })[] = [];
    let sinPunto = 0;
    for (const c of ciudades) {
      const p = c.lat !== null && c.lon !== null ? proyectar(c.lat, c.lon) : null;
      if (p) dentro.push({ ...c, ...p });
      else sinPunto += c.n;
    }
    // Las grandes primero: las pequeñas quedan encima y se pueden pulsar aunque estén juntas.
    dentro.sort((a, b) => b.n - a.n);
    return { puntos: dentro, fuera: sinPunto, max: Math.max(1, ...dentro.map((c) => c.n)) };
  }, [ciudades]);

  const activa = puntos.find((c) => c.clave === foco);
  const elegidas = new Set(seleccionadas);
  const radio = (n: number) => 2.8 + 8.5 * Math.sqrt(n / max);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox={`0 0 ${MAPA_ANCHO} ${MAPA_ALTO}`} role="group" aria-label="Mapa de Colombia con los suscriptores por ciudad" className="h-auto max-h-[22rem] w-full max-w-[16rem]">
        {DEPARTAMENTOS.map((d) => (
          <path key={d.nombre} d={d.d} fill="var(--surface-2)" stroke="var(--border-strong)" strokeWidth={0.6} strokeLinejoin="round" />
        ))}
        {puntos.map((c) => {
          const marcada = elegidas.has(c.clave);
          return (
            <circle
              key={c.clave}
              cx={c.x}
              cy={c.y}
              r={radio(c.n)}
              role="button"
              tabIndex={bloqueada ? -1 : 0}
              aria-pressed={marcada}
              aria-disabled={bloqueada}
              aria-label={`${c.nombre}: ${c.n} ${c.n === 1 ? "suscriptor" : "suscriptores"}${marcada ? ", elegida" : ""}`}
              fill="var(--accent)"
              fillOpacity={marcada ? 0.95 : 0.38}
              stroke={marcada ? "var(--fg)" : "var(--accent)"}
              strokeWidth={marcada ? 1.6 : 0.8}
              className={bloqueada ? "" : "cursor-pointer outline-none transition-[fill-opacity] hover:[fill-opacity:0.75] focus-visible:[stroke-width:2.4]"}
              onMouseEnter={() => setFoco(c.clave)}
              onMouseLeave={() => setFoco((f) => (f === c.clave ? null : f))}
              onFocus={() => setFoco(c.clave)}
              onBlur={() => setFoco((f) => (f === c.clave ? null : f))}
              onClick={() => !bloqueada && alAlternar(c.clave)}
              onKeyDown={(e) => {
                if (!bloqueada && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  alAlternar(c.clave);
                }
              }}
            />
          );
        })}
      </svg>
      <p className="min-h-5 text-center text-xs text-[var(--fg-muted)]" aria-live="polite">
        {activa ? (
          <>
            <strong className="text-[var(--fg)]">{activa.nombre}</strong> · {activa.n} {activa.n === 1 ? "suscriptor" : "suscriptores"}
            {elegidas.has(activa.clave) ? " · elegida" : ""}
          </>
        ) : puntos.length ? (
          bloqueada ? "El público ya no se puede cambiar." : "Pulsa una ciudad para elegirla o quitarla."
        ) : (
          "Aún no hay suscriptores con ubicación para dibujar."
        )}
      </p>
      {fuera > 0 && <p className="text-center text-[0.7rem] text-[var(--fg-muted)]">{fuera} {fuera === 1 ? "suscriptor no aparece" : "suscriptores no aparecen"} en el mapa (sin ubicación o fuera de Colombia); sí están en la lista de ciudades.</p>}
    </div>
  );
}
