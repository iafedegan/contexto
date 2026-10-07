"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Indicador } from "@/lib/indicadores-fedegan";
import { nfCO } from "@/lib/format";

/**
 * Indicadores ganaderos de FEDEGÁN en la portada: precio del ganado gordo y del flaco por región, mes a mes.
 * Una gráfica propia en SVG (sin librerías): curvas suaves, lectura al pasar el cursor o el dedo, una tarjeta por
 * región que a la vez es la leyenda (se enciende y se apaga) y una tabla oculta para quien usa lector de pantalla.
 * Los colores salen de la plantilla activa, así que encaja en las seis.
 */

// Una serie por color; las tres primeras salen de la plantilla y la cuarta es un azul que se lee sobre claro y oscuro.
const COLORES = ["var(--accent)", "var(--accent-2)", "#60a5fa", "#f472b6"];
const MESES_LARGOS: Record<string, string> = {
  ene: "enero", feb: "febrero", mar: "marzo", abr: "abril", may: "mayo", jun: "junio",
  jul: "julio", ago: "agosto", sep: "septiembre", oct: "octubre", nov: "noviembre", dic: "diciembre",
};

// «ago/2026» → «agosto de 2026».
const mesLargo = (p: string) => {
  const [m, a] = p.split("/");
  return `${MESES_LARGOS[m] ?? m} de ${a}`;
};
// «ago/2026» → «ago ’26» (para el eje).
const mesCorto = (p: string) => {
  const [m, a] = p.split("/");
  return `${m} ’${a.slice(2)}`;
};
const pesos = (v: number) => `$${nfCO.format(Math.round(v))}`;
const pct = (n: number) => `${n >= 0 ? "+" : "−"}${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(Math.abs(n))} %`;

type Punto = { x: number; y: number };

/** Curva suave que no se pasa de los datos (interpolación monótona de Fritsch–Carlson): sin «olas» que inventen picos. */
function trazoSuave(p: Punto[]): string {
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
function tramos(valores: (number | null)[], x: (i: number) => number, y: (v: number) => number): Punto[][] {
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
function marcasEje(min: number, max: number): number[] {
  const bruto = (max - min || Math.abs(max) * 0.1 || 1) / 4;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((f) => f * pot).find((p) => p >= bruto) ?? 10 * pot;
  const marcas: number[] = [];
  for (let v = Math.floor(min / paso) * paso; v <= Math.ceil(max / paso) * paso + 1e-9; v += paso) marcas.push(v);
  return marcas;
}

/** Variación del mes `i` frente al anterior con dato; `null` si no hay con qué comparar. */
function variacion(valores: (number | null)[], i: number): number | null {
  const actual = valores[i];
  if (actual === null || actual === undefined) return null;
  for (let j = i - 1; j >= 0; j--) {
    const previo = valores[j];
    if (previo !== null && previo !== 0) return ((actual - previo) / previo) * 100;
  }
  return null;
}

// Último mes con dato en alguna de las series visibles.
const ultimoConDato = (series: Indicador["series"]) => {
  const n = series[0]?.valores.length ?? 0;
  for (let i = n - 1; i >= 0; i--) if (series.some((s) => s.valores[i] !== null)) return i;
  return n - 1;
};

// Línea pequeña de tendencia de una tarjeta.
function Tendencia({ valores, color }: { valores: (number | null)[]; color: string }) {
  const ancho = 120;
  const alto = 30;
  const reales = valores.filter((v): v is number => v !== null);
  if (reales.length < 2) return null;
  const min = Math.min(...reales);
  const max = Math.max(...reales);
  const x = (i: number) => (i / (valores.length - 1)) * ancho;
  const y = (v: number) => alto - 3 - ((v - min) / (max - min || 1)) * (alto - 6);
  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} className="h-7 w-full" preserveAspectRatio="none" aria-hidden>
      {tramos(valores, x, y).map((t, i) => (
        <path key={i} d={trazoSuave(t)} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

// Props: los indicadores ya leídos en el servidor y los textos de la sección (que traduce el servidor).
export function IndicadoresGanaderos({
  indicadores,
  kicker,
  titulo,
  fuenteEtiqueta,
  actualizadoEtiqueta,
}: {
  indicadores: Indicador[];
  kicker: string;
  titulo: string;
  fuenteEtiqueta: string;
  actualizadoEtiqueta: string;
}) {
  const id = useId();
  const [sel, setSel] = useState(0);
  const [apagadas, setApagadas] = useState<Record<string, number[]>>({});
  const [hover, setHover] = useState<number | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(680);

  // La gráfica se dibuja al ancho real de su caja: así el texto del eje mide lo mismo en el celular que en escritorio.
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setAncho(Math.max(260, Math.round(el.getBoundingClientRect().width)));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ind = indicadores[Math.min(sel, indicadores.length - 1)];
  const off = apagadas[ind.clave] ?? [];
  const visibles = ind.series.map((_, i) => i).filter((i) => !off.includes(i));
  const n = ind.periodos.length;

  // Geometría de la gráfica: se recalcula en cada render (son pocos puntos) en vez de memorizarla con dependencias frágiles.
  const alto = ancho < 520 ? 230 : 290;
  const m = { l: ancho < 520 ? 40 : 48, r: 14, t: 16, b: 30 };
  const valoresVisibles = visibles.flatMap((i) => ind.series[i].valores).filter((v): v is number => v !== null);
  const lo = valoresVisibles.length ? Math.min(...valoresVisibles) : 0;
  const hi = valoresVisibles.length ? Math.max(...valoresVisibles) : 1;
  const holgura = (hi - lo || hi * 0.1 || 1) * 0.12;
  const marcas = marcasEje(lo - holgura, hi + holgura);
  const min = marcas[0];
  const max = marcas[marcas.length - 1];
  const x = (i: number) => m.l + ((ancho - m.l - m.r) * i) / Math.max(1, n - 1);
  const y = (v: number) => m.t + (alto - m.t - m.b) * (1 - (v - min) / (max - min || 1));
  const ultimo = ultimoConDato(ind.series);
  const idx = hover ?? ultimo;
  const cadaCuanto = Math.ceil(n / (ancho < 520 ? 4 : 7));

  // Lee el mes más cercano al cursor o al dedo.
  const alMover = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.round(((px - m.l) / (ancho - m.l - m.r)) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };
  const alternar = (i: number) =>
    setApagadas((prev) => {
      const actuales = prev[ind.clave] ?? [];
      // Siempre queda una serie encendida: una gráfica vacía no dice nada.
      if (!actuales.includes(i) && actuales.length >= ind.series.length - 1) return prev;
      return { ...prev, [ind.clave]: actuales.includes(i) ? actuales.filter((k) => k !== i) : [...actuales, i] };
    });

  const unaSerie = visibles.length === 1;
  const resumen = `${ind.titulo}: ${ind.series
    .map((s) => `${s.nombre} ${s.valores[ultimo] === null ? "sin dato" : pesos(s.valores[ultimo] as number)}`)
    .join(", ")} en ${mesLargo(ind.periodos[ultimo])}.`;

  return (
    <section aria-labelledby={`${id}-t`} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-gradient-to-b from-[var(--surface-2)] to-[var(--surface)] p-4 sm:p-7">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <p className="lx-kicker text-[var(--accent)]">{kicker}</p>
          <h2 id={`${id}-t`} className="lx-display mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
            {titulo}
          </h2>
        </div>
        <div role="tablist" aria-label={titulo} className="-mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 pb-1">
          {indicadores.map((it, i) => (
            <button
              key={it.clave}
              id={`${id}-tab-${i}`}
              role="tab"
              type="button"
              aria-selected={i === sel}
              aria-controls={`${id}-panel`}
              onClick={() => {
                setSel(i);
                setHover(null);
              }}
              className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition min-h-11 ${
                i === sel
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]"
                  : "border-[var(--border-strong)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
              }`}
            >
              {it.titulo}
            </button>
          ))}
        </div>
      </header>

      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${sel}`} className="mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-[var(--fg-muted)]">
          <p>
            {ind.descripcion} · <span className="whitespace-nowrap">{ind.unidad}</span>
          </p>
          <p className="whitespace-nowrap">
            {actualizadoEtiqueta}: <span className="font-semibold text-[var(--fg)]">{mesLargo(ind.periodos[ultimo])}</span>
          </p>
        </div>

        {/* Una tarjeta por serie: el valor del mes que se está mirando, su variación y su tendencia; también enciende y apaga la línea. */}
        <div className={`mt-4 grid gap-3 ${ind.series.length > 1 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1"}`}>
          {ind.series.map((s, i) => {
            const encendida = !off.includes(i);
            const valor = s.valores[idx];
            const v = variacion(s.valores, idx);
            return (
              <button
                key={s.nombre}
                type="button"
                aria-pressed={encendida}
                onClick={() => alternar(i)}
                disabled={ind.series.length === 1}
                className={`flex min-h-11 flex-col gap-1 rounded-[var(--radius)] border p-3 text-left transition ${
                  encendida ? "border-[var(--border-strong)] bg-[var(--surface)]" : "border-[var(--border)] opacity-50"
                } disabled:cursor-default`}
              >
                <span className="flex items-center gap-2 text-xs font-semibold text-[var(--fg-muted)]">
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: COLORES[i % COLORES.length] }} />
                  <span className="truncate">{s.nombre}</span>
                </span>
                <span className="flex items-baseline justify-between gap-2">
                  <span className="lx-display text-2xl font-semibold tabular-nums sm:text-[1.7rem]">{valor === null || valor === undefined ? "—" : pesos(valor)}</span>
                  {v !== null && (
                    <span className={`whitespace-nowrap text-xs font-bold tabular-nums ${v >= 0 ? "text-[var(--accent-2)]" : "text-[#f87171]"}`}>
                      {v >= 0 ? "▲" : "▼"} {pct(v)}
                    </span>
                  )}
                </span>
                <span className="max-sm:hidden">
                  <Tendencia valores={s.valores} color={COLORES[i % COLORES.length]} />
                </span>
              </button>
            );
          })}
        </div>

        <div ref={caja} className="relative mt-5 select-none">
          <svg
            key={ind.clave}
            width={ancho}
            height={alto}
            viewBox={`0 0 ${ancho} ${alto}`}
            role="img"
            aria-label={resumen}
            className="block touch-pan-y overflow-visible"
            onPointerMove={alMover}
            onPointerDown={alMover}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={COLORES[visibles[0] ?? 0]} stopOpacity=".32" />
                <stop offset="1" stopColor={COLORES[visibles[0] ?? 0]} stopOpacity="0" />
              </linearGradient>
            </defs>
            {marcas.map((v) => (
              <g key={v}>
                <line x1={m.l} x2={ancho - m.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray="2 5" />
                <text x={m.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--fg-muted)" className="tabular-nums">
                  {nfCO.format(v)}
                </text>
              </g>
            ))}
            {ind.periodos.map((p, i) =>
              i % cadaCuanto === (n - 1) % cadaCuanto ? (
                <text key={p} x={x(i)} y={alto - 8} textAnchor="middle" fontSize="11" fill="var(--fg-muted)">
                  {mesCorto(p)}
                </text>
              ) : null,
            )}
            {unaSerie &&
              tramos(ind.series[visibles[0]].valores, x, y).map((t, k) => (
                <path key={`a${k}`} d={`${trazoSuave(t)}L${t[t.length - 1].x} ${alto - m.b}L${t[0].x} ${alto - m.b}Z`} fill={`url(#${id}-area)`} />
              ))}
            {visibles.map((i) =>
              tramos(ind.series[i].valores, x, y).map((t, k) => (
                <path
                  key={`${i}-${k}`}
                  d={trazoSuave(t)}
                  pathLength={1}
                  fill="none"
                  stroke={COLORES[i % COLORES.length]}
                  strokeWidth="2.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ind-trazo"
                />
              )),
            )}
            {/* Guía y puntos del mes que se mira (por defecto, el último con dato). */}
            <line x1={x(idx)} x2={x(idx)} y1={m.t} y2={alto - m.b} stroke="var(--border-strong)" strokeDasharray="3 4" />
            {visibles.map((i) => {
              const v = ind.series[i].valores[idx];
              return v === null || v === undefined ? null : (
                <circle key={i} cx={x(idx)} cy={y(v)} r="5.5" fill="var(--bg)" stroke={COLORES[i % COLORES.length]} strokeWidth="3" />
              );
            })}
          </svg>
          {hover !== null && (
            <div
              className="pointer-events-none absolute top-1 z-10 min-w-36 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--bg-2)] px-3 py-2 text-xs shadow-xl"
              style={{ left: Math.min(Math.max(x(hover) - 72, 0), Math.max(0, ancho - 150)) }}
            >
              <p className="mb-1 font-semibold text-[var(--fg-muted)]">{mesLargo(ind.periodos[hover])}</p>
              {visibles.map((i) => {
                const v = ind.series[i].valores[hover];
                return (
                  <p key={i} className="flex items-center justify-between gap-3 tabular-nums">
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden className="size-2 rounded-full" style={{ background: COLORES[i % COLORES.length] }} />
                      {ind.series.length > 1 ? ind.series[i].nombre.split(" ")[0] : ind.series[i].nombre}
                    </span>
                    <span className="font-bold">{v === null || v === undefined ? "—" : pesos(v)}</span>
                  </p>
                );
              })}
            </div>
          )}
        </div>

        <p className="mt-3 text-xs text-[var(--fg-muted)]">
          {fuenteEtiqueta}: {ind.fuente}
        </p>

        <table className="sr-only">
          <caption>{`${ind.titulo} — ${ind.descripcion} (${ind.unidad})`}</caption>
          <thead>
            <tr>
              <th scope="col">Mes</th>
              {ind.series.map((s) => (
                <th key={s.nombre} scope="col">
                  {s.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ind.periodos.map((p, i) => (
              <tr key={p}>
                <th scope="row">{mesLargo(p)}</th>
                {ind.series.map((s) => (
                  <td key={s.nombre}>{s.valores[i] === null ? "sin dato" : pesos(s.valores[i] as number)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
