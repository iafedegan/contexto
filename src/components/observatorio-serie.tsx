"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { IndicadorGeneral } from "@/lib/observatorio-fedegan";
import { compacto, formatear, marcasEje, pct, periodoLargo, tramos, trazoSuave, ultimoConDato, variacion } from "@/lib/graficas";

/** Una serie por color: tres de la plantilla y siete más que se leen sobre fondo claro y oscuro. */
export const PALETA = ["var(--accent)", "var(--accent-2)", "#60a5fa", "#f472b6", "#a78bfa", "#fb923c", "#2dd4bf", "#facc15", "#f87171", "#94a3b8"];
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
// Etiqueta corta del eje: «ago ’26» o «2025».
const eje = (p: string) => {
  const [m, a] = p.split("/");
  return a ? `${MES.includes(m) ? m : m} ’${a.slice(2)}` : p;
};
// El nombre sin la unidad entre paréntesis: «Estados Unidos (US$/L)» → «Estados Unidos».
const limpio = (n: string) => n.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+-\s+(Valor|Precio)$/i, "").replace(/\s+/g, " ").trim();

/**
 * Tarjeta de un indicador del Observatorio: cifra del último periodo con su variación, leyenda que enciende y apaga las
 * series, gráfica (líneas, área o barras) con lectura al pasar el cursor o el dedo, rango de años y CSV.
 */
export function ObservatorioSerie({ ind, ancha = false }: { ind: IndicadorGeneral; ancha?: boolean }) {
  const id = useId();
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(520);
  const [hover, setHover] = useState<number | null>(null);
  const total = ind.periodos.length;
  // Atajos de rango: mensual 1, 3 o 5 años; anual, 10 años o todo.
  const atajos = ind.mensual ? [{ t: "1 año", n: 12 }, { t: "3 años", n: 36 }, { t: "Todo", n: 0 }] : total > 12 ? [{ t: "10 años", n: 10 }, { t: "Todo", n: 0 }] : [];
  const [n, setN] = useState(ind.mensual ? 36 : total > 12 ? 10 : 0);
  const [apagadas, setApagadas] = useState<number[]>(() => {
    if (!ind.destacadas) return [];
    return ind.series.map((s, i) => (ind.destacadas!.includes(s.nombre) ? -1 : i)).filter((i) => i >= 0);
  });

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setAncho(Math.max(240, Math.round(el.getBoundingClientRect().width)));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ini = n === 0 ? 0 : Math.max(0, total - n);
  const periodos = ind.periodos.slice(ini);
  const series = ind.series.map((s) => ({ ...s, valores: s.valores.slice(ini) }));
  const m = periodos.length;
  const visibles = series.map((_, i) => i).filter((i) => !apagadas.includes(i));
  // Las barras solo se leen con pocos periodos y series; si no, la forma pasa a líneas.
  const barras = ind.forma === "barras" && m * Math.max(1, visibles.length) <= 60;
  const area = ind.forma === "area" || (ind.forma === "linea" && visibles.length === 1);

  const alto = ancho < 420 ? 190 : 230;
  const mg = { l: ancho < 420 ? 38 : 46, r: 12, t: 12, b: 26 };
  const interior = ancho - mg.l - mg.r;
  const vals = visibles.flatMap((i) => series[i].valores).filter((v): v is number => v !== null);
  const lo = vals.length ? Math.min(...vals) : 0;
  const hi = vals.length ? Math.max(...vals) : 1;
  const marcas = barras ? marcasEje(0, hi * 1.05) : marcasEje(lo - (hi - lo || hi * 0.1 || 1) * 0.1, hi + (hi - lo || hi * 0.1 || 1) * 0.1);
  const [min, max] = [marcas[0], marcas[marcas.length - 1]];
  const banda = interior / Math.max(1, m);
  const x = (i: number) => (barras ? mg.l + banda * (i + 0.5) : mg.l + (interior * i) / Math.max(1, m - 1));
  const y = (v: number) => mg.t + (alto - mg.t - mg.b) * (1 - (v - min) / (max - min || 1));
  const ultimo = ultimoConDato(series);
  const idx = Math.min(hover ?? ultimo, m - 1);
  const cada = Math.ceil(m / (ancho < 420 ? 4 : 6));
  const ver = (v: number | null | undefined) => (v === null || v === undefined ? "—" : formatear(v, ind.formato, ind.prefijo));

  const alMover = (e: React.PointerEvent<SVGSVGElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    const i = barras ? Math.floor((px - mg.l) / banda) : Math.round(((px - mg.l) / interior) * (m - 1));
    setHover(Math.min(m - 1, Math.max(0, i)));
  };
  const alternar = (i: number) =>
    setApagadas((p) => (p.includes(i) ? p.filter((k) => k !== i) : p.length >= series.length - 1 ? p : [...p, i]));

  // Cifra principal: la primera serie encendida en el periodo que se mira.
  const principal = visibles[0] ?? 0;
  const v0 = series[principal]?.valores[idx];
  const delta = series[principal] ? variacion(series[principal].valores, idx) : null;

  // Mínimo, promedio y máximo de la serie principal en el rango que se está viendo.
  const estadistica = (() => {
    const v = series[principal]?.valores ?? [];
    const con = v.map((x, i) => ({ x, i })).filter((e): e is { x: number; i: number } => e.x !== null);
    if (con.length < 2) return null;
    const min = con.reduce((a, b) => (b.x < a.x ? b : a));
    const max = con.reduce((a, b) => (b.x > a.x ? b : a));
    return { min: { v: min.x, p: periodos[min.i] }, max: { v: max.x, p: periodos[max.i] }, prom: { v: con.reduce((t, e) => t + e.x, 0) / con.length } };
  })();

  const exportar = () => {
    const filas = [["Fecha", ...ind.series.map((s) => s.nombre)].join(";")];
    ind.periodos.forEach((p, i) => filas.push([p, ...ind.series.map((s) => s.valores[i] ?? "")].join(";")));
    const url = URL.createObjectURL(new Blob(["﻿" + filas.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    Object.assign(document.createElement("a"), { href: url, download: `${ind.clave}.csv` }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <article className={`flex min-w-0 flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-gradient-to-b from-[var(--surface-2)] to-[var(--surface)] p-4 transition duration-300 hover:border-[var(--border-strong)] hover:shadow-[0_24px_60px_-34px_rgba(0,0,0,0.8)] sm:p-5 ${ancha ? "md:col-span-2" : ""}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="lx-display text-lg font-semibold leading-snug sm:text-xl">{ind.titulo}</h3>
          <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
            {ind.descripcion} · {ind.unidad}
          </p>
        </div>
        <button type="button" onClick={exportar} aria-label={`Descargar ${ind.titulo} en CSV`} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-[var(--border-strong)] px-3 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--surface-2)]">
          <span aria-hidden>↓</span> CSV
        </button>
      </header>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <p className="flex items-baseline gap-2">
          <span className="lx-display text-3xl font-semibold tabular-nums sm:text-[2rem]">{ver(v0)}</span>
          {delta !== null && (
            <span className={`text-xs font-bold tabular-nums ${delta >= 0 ? "text-[var(--accent-2)]" : "text-[#f87171]"}`}>
              {delta >= 0 ? "▲" : "▼"} {pct(delta)}
            </span>
          )}
          <span className="text-xs text-[var(--fg-muted)]">{periodoLargo(periodos[idx])}</span>
        </p>
        {atajos.length > 0 && (
          <div role="group" aria-label="Periodo" className="inline-flex rounded-full border border-[var(--border-strong)] p-0.5">
            {atajos.map((a) => (
              <button key={a.t} type="button" aria-pressed={n === a.n} onClick={() => { setN(a.n); setHover(null); }}
                className={`min-h-8 rounded-full px-3 text-xs font-semibold transition ${n === a.n ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>
                {a.t}
              </button>
            ))}
          </div>
        )}
      </div>

      {series.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Series">
          {series.map((s, i) => (
            <li key={s.nombre}>
              <button type="button" aria-pressed={!apagadas.includes(i)} onClick={() => alternar(i)}
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition ${apagadas.includes(i) ? "border-[var(--border)] text-[var(--fg-muted)] opacity-50" : "border-[var(--border-strong)] text-[var(--fg)]"}`}>
                <span aria-hidden className="size-2 rounded-full" style={{ background: PALETA[i % PALETA.length] }} />
                {limpio(s.nombre)}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div ref={caja} className="relative mt-3 min-w-0 select-none">
        <svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={`${ind.titulo}: ${series.map((s) => `${limpio(s.nombre)} ${ver(s.valores[ultimo])}`).join(", ")} (${periodoLargo(periodos[ultimo])})`}
          className="block touch-pan-y overflow-visible" onPointerMove={alMover} onPointerDown={alMover} onPointerLeave={() => setHover(null)}>
          <defs>
            {series.map((_, i) => (
              <linearGradient key={i} id={`${id}-a${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={PALETA[i % PALETA.length]} stopOpacity=".3" />
                <stop offset="1" stopColor={PALETA[i % PALETA.length]} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {marcas.map((v) => (
            <g key={v}>
              <line x1={mg.l} x2={ancho - mg.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray="2 5" />
              <text x={mg.l - 7} y={y(v) + 4} textAnchor="end" fontSize="10.5" fill="var(--fg-muted)" className="tabular-nums">{compacto(v)}</text>
            </g>
          ))}
          {periodos.map((p, i) => (i % cada === (m - 1) % cada ? <text key={p} x={x(i)} y={alto - 7} textAnchor="middle" fontSize="10.5" fill="var(--fg-muted)">{eje(p)}</text> : null))}
          {barras ? <rect x={x(idx) - banda / 2} y={mg.t} width={banda} height={alto - mg.t - mg.b} fill="var(--surface-2)" /> : <line x1={x(idx)} x2={x(idx)} y1={mg.t} y2={alto - mg.b} stroke="var(--border-strong)" strokeDasharray="3 4" />}
          {barras
            ? visibles.map((i, k) => {
                const w = Math.max(3, Math.min(24, (banda * 0.72) / visibles.length));
                return series[i].valores.map((v, j) => v === null ? null : (
                  <rect key={`${i}-${j}`} x={x(j) - (w * visibles.length) / 2 + k * w} y={y(v)} width={Math.max(2, w - 1.5)} height={Math.max(0, alto - mg.b - y(v))} rx="2" fill={PALETA[i % PALETA.length]} opacity={j === idx ? 1 : 0.78} />
                ));
              })
            : visibles.map((i) =>
                tramos(series[i].valores, x, y).map((t, k) => (
                  <g key={`${i}-${k}`}>
                    {area && <path d={`${trazoSuave(t)}L${t[t.length - 1].x} ${alto - mg.b}L${t[0].x} ${alto - mg.b}Z`} fill={`url(#${id}-a${i})`} />}
                    <path d={trazoSuave(t)} pathLength={1} fill="none" stroke={PALETA[i % PALETA.length]} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="ind-trazo" />
                  </g>
                )),
              )}
          {!barras && visibles.map((i) => { const v = series[i].valores[idx]; return v === null || v === undefined ? null : <circle key={i} cx={x(idx)} cy={y(v)} r="4.5" fill="var(--bg)" stroke={PALETA[i % PALETA.length]} strokeWidth="2.5" />; })}
        </svg>
        {hover !== null && (
          <div className="pointer-events-none absolute top-0 z-10 min-w-36 max-w-56 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--bg-2)] px-3 py-2 text-xs shadow-xl" style={{ left: Math.min(Math.max(x(hover) - 70, 0), Math.max(0, ancho - 170)) }}>
            <p className="mb-1 font-semibold text-[var(--fg-muted)]">{periodoLargo(periodos[hover])}</p>
            {visibles.map((i) => (
              <p key={i} className="flex items-center justify-between gap-3 tabular-nums">
                <span className="flex min-w-0 items-center gap-1.5"><span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: PALETA[i % PALETA.length] }} /><span className="truncate">{limpio(series[i].nombre)}</span></span>
                <span className="font-bold">{ver(series[i].valores[hover])}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      {estadistica && (
        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-3 text-center">
          {([["Mínimo", estadistica.min], ["Promedio", estadistica.prom], ["Máximo", estadistica.max]] as const).map(([t, e]) => (
            <div key={t} className="min-w-0">
              <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">{t}</dt>
              <dd className="mt-0.5 truncate text-sm font-bold tabular-nums">{ver(e.v)}</dd>
              {"p" in e && <dd className="truncate text-[0.65rem] text-[var(--fg-muted)]">{eje(e.p)}</dd>}
            </div>
          ))}
        </dl>
      )}

      <table className="sr-only">
        <caption>{`${ind.titulo} (${ind.unidad})`}</caption>
        <thead><tr><th scope="col">Periodo</th>{ind.series.map((s) => <th key={s.nombre} scope="col">{s.nombre}</th>)}</tr></thead>
        <tbody>{ind.periodos.map((p, i) => <tr key={p}><th scope="row">{periodoLargo(p)}</th>{ind.series.map((s) => <td key={s.nombre}>{ver(s.valores[i])}</td>)}</tr>)}</tbody>
      </table>
      <p className="mt-2 text-[0.7rem] text-[var(--fg-muted)]">{ind.fuente}</p>
    </article>
  );
}
