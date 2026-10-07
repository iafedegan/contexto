"use client";

import { useEffect, useMemo, useState } from "react";
import { DEPARTAMENTOS, MAPA_ALTO, MAPA_ANCHO } from "@/lib/colombia-mapa";
import { compacto, pct } from "@/lib/graficas";
import { nfCO } from "@/lib/format";
import type { Departamental } from "@/lib/observatorio-fedegan";
import { colorCalor, normaDepartamento as norma } from "@/lib/mapa-util";

/**
 * Mapa de calor de Colombia por departamento (inventario de bovinos y predios ganaderos), con el año en una barra que
 * también se puede reproducir, la ficha del departamento que se mira y el ranking al lado. El color sale de la plantilla.
 */
const bonito = (n: string) => n.replace(/\s+/g, " ").trim();

export function ObservatorioMapa({ datos, etiquetas }: { datos: Departamental[]; etiquetas: { bovinos: string; predios: string; year: string; national: string; share: string; rank: string; play: string; pause: string; top: string } }) {
  const [clave, setClave] = useState<Departamental["clave"]>(datos[0]?.clave ?? "bovinos");
  const d = datos.find((x) => x.clave === clave) ?? datos[0];
  const [anio, setAnio] = useState(Math.max(0, (d?.periodos.length ?? 1) - 1));
  const [foco, setFoco] = useState<string | null>(null);
  const [juega, setJuega] = useState(false);
  const n = d?.periodos.length ?? 0;

  // La reproducción avanza un año cada 0,7 s y se detiene en el último.
  useEffect(() => {
    if (!juega) return;
    const t = setInterval(() => setAnio((a) => (a >= n - 1 ? (setJuega(false), a) : a + 1)), 700);
    return () => clearInterval(t);
  }, [juega, n]);

  const calc = useMemo(() => {
    if (!d) return null;
    const max = Math.max(1, ...d.departamentos.flatMap((s) => s.valores).filter((v): v is number => v !== null));
    return { max };
  }, [d]);
  if (!d || !calc) return null;

  const filas = d.departamentos
    .map((s) => ({ nombre: bonito(s.nombre), clave: norma(s.nombre), v: s.valores[anio] ?? null, previo: anio > 0 ? s.valores[anio - 1] ?? null : null }))
    .filter((f): f is typeof f & { v: number } => f.v !== null)
    .sort((a, b) => b.v - a.v);
  const porClave = new Map(filas.map((f, i) => [f.clave, { ...f, puesto: i + 1 }]));
  const total = d.nacional[anio] ?? filas.reduce((t, f) => t + f.v, 0);
  const totalPrevio = anio > 0 ? d.nacional[anio - 1] ?? null : null;
  const activo = (foco && porClave.get(foco)) || porClave.get(filas[0]?.clave ?? "");
  const relleno = (v: number | undefined) => colorCalor(v, calc.max);
  const maxAnio = filas[0]?.v ?? 1;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-gradient-to-b from-[var(--surface-2)] to-[var(--surface)] p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div role="group" aria-label="Indicador" className="inline-flex rounded-full border border-[var(--border-strong)] p-0.5">
            {datos.map((x) => (
              <button key={x.clave} type="button" aria-pressed={x.clave === clave}
                onClick={() => { setClave(x.clave); setAnio(x.periodos.length - 1); setJuega(false); }}
                className={`min-h-9 rounded-full px-4 text-sm font-semibold transition ${x.clave === clave ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>
                {x.clave === "bovinos" ? etiquetas.bovinos : etiquetas.predios}
              </button>
            ))}
          </div>
        </div>
        <p className="text-right">
          <span className="block text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">{etiquetas.national} · {d.periodos[anio]}</span>
          <span className="lx-display text-3xl font-semibold tabular-nums sm:text-4xl">{nfCO.format(Math.round(total))}</span>
          {totalPrevio ? <span className={`ml-2 text-xs font-bold tabular-nums ${total >= totalPrevio ? "text-[var(--accent-2)]" : "text-[#f87171]"}`}>{total >= totalPrevio ? "▲" : "▼"} {pct(((total - totalPrevio) / totalPrevio) * 100)}</span> : null}
        </p>
      </div>

      <div className="mt-5 grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <figure className="relative mx-auto w-full max-w-[22rem]">
          <svg viewBox={`0 0 ${MAPA_ANCHO} ${MAPA_ALTO}`} className="block h-auto w-full" role="img" aria-label={`Mapa de Colombia: ${d.titulo} por departamento en ${d.periodos[anio]}`} onPointerLeave={() => setFoco(null)}>
            {DEPARTAMENTOS.map((dep) => {
              const k = norma(dep.nombre);
              const f = porClave.get(k);
              const esFoco = activo?.clave === k;
              return (
                <path key={dep.nombre} d={dep.d} fill={relleno(f?.v)} stroke={esFoco ? "var(--fg)" : "var(--bg)"} strokeWidth={esFoco ? 1.6 : 0.8} strokeLinejoin="round"
                  className="cursor-pointer transition-[fill] duration-500" onPointerEnter={() => setFoco(k)} onClick={() => setFoco(k)} />
              );
            })}
          </svg>
          <figcaption className="mt-2 flex items-center gap-2 text-[0.7rem] text-[var(--fg-muted)]" aria-hidden>
            <span>0</span>
            <span className="h-2 flex-1 rounded-full" style={{ background: "linear-gradient(90deg, color-mix(in oklab, var(--accent) 14%, var(--bg-2)), var(--accent))" }} />
            <span>{compacto(calc.max)}</span>
          </figcaption>
        </figure>

        <div className="min-w-0">
          {activo && (
            <div className="rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--bg-2)] p-4" aria-live="polite">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">{etiquetas.rank} #{activo.puesto}</p>
              <p className="lx-display mt-1 text-2xl font-semibold">{activo.nombre}</p>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-2xl font-bold tabular-nums">{nfCO.format(Math.round(activo.v))}</span>
                <span className="text-sm text-[var(--fg-muted)]">{((activo.v / (total || 1)) * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} % {etiquetas.share}</span>
                {activo.previo ? <span className={`text-xs font-bold tabular-nums ${activo.v >= activo.previo ? "text-[var(--accent-2)]" : "text-[#f87171]"}`}>{activo.v >= activo.previo ? "▲" : "▼"} {pct(((activo.v - activo.previo) / activo.previo) * 100)}</span> : null}
              </p>
            </div>
          )}
          <p className="mb-2 mt-4 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">{etiquetas.top}</p>
          <ol className="flex flex-col gap-1">
            {filas.slice(0, 8).map((f, i) => (
              <li key={f.clave}>
                <button type="button" onClick={() => setFoco(f.clave)} onPointerEnter={() => setFoco(f.clave)} aria-pressed={activo?.clave === f.clave}
                  className={`grid min-h-9 w-full grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--radius)] px-2 text-left text-sm transition ${activo?.clave === f.clave ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface)]"}`}>
                  <span className="text-xs font-bold tabular-nums text-[var(--fg-muted)]">{i + 1}</span>
                  <span className="relative min-w-0">
                    <span className="relative z-10 block truncate py-1 font-medium">{f.nombre}</span>
                    <span aria-hidden className="absolute inset-y-1 left-0 rounded-sm bg-[var(--accent)]/25 transition-[width] duration-500" style={{ width: `${(f.v / maxAnio) * 100}%` }} />
                  </span>
                  <span className="tabular-nums text-xs font-semibold">{compacto(f.v)}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button type="button" onClick={() => { if (anio >= n - 1) setAnio(0); setJuega((j) => !j); }} aria-label={juega ? etiquetas.pause : etiquetas.play}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-[var(--border-strong)] text-[var(--accent)] transition hover:bg-[var(--surface-2)]">
          <span aria-hidden>{juega ? "❚❚" : "▶"}</span>
        </button>
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex justify-between text-xs font-semibold text-[var(--fg-muted)]"><span>{etiquetas.year}</span><span className="tabular-nums text-[var(--fg)]">{d.periodos[anio]}</span></span>
          <input type="range" min={0} max={n - 1} value={anio} onChange={(e) => { setAnio(Number(e.target.value)); setJuega(false); }} className="h-6 w-full accent-[var(--accent)]" aria-valuetext={d.periodos[anio]} />
        </label>
      </div>
    </div>
  );
}
