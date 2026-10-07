"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Indicador } from "@/lib/indicadores-fedegan";
import { nfCO } from "@/lib/format";
import { marcasEje, pct, tramos, trazoSuave, ultimoConDato, variacion } from "@/lib/graficas";
import { MapaRegiones } from "@/components/mapa-regiones";

/**
 * Indicadores ganaderos de FEDEGÁN en la portada: precio del ganado gordo y del flaco por región, mes a mes.
 * Una gráfica propia en SVG (sin librerías) con los mismos filtros que el widget original, más cómodos: regiones
 * (las tarjetas, que a la vez son la leyenda), rango de fechas con atajos, tipo de gráfica (líneas, área o barras) y vista
 * (gráfica, tabla o ambas), más exportar a CSV. Lectura al pasar el cursor o el dedo y tabla accesible para lectores
 * de pantalla. Los colores salen de la plantilla activa, así que encaja en las seis.
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

type Forma = "lineas" | "area" | "barras";
type Vista = "grafica" | "tabla" | "ambas";

/** Textos de la sección (los traduce el servidor con `t()`), para que los controles también salgan en inglés. */
export type EtiquetasIndicadores = Record<
  | "kicker" | "title" | "source" | "updated" | "period" | "from" | "to" | "last6" | "last12" | "last36" | "all"
  | "chart" | "lines" | "area" | "bars" | "view" | "viewChart" | "viewTable" | "viewBoth" | "regions" | "month" | "export" | "noData" | "moreFilters" | "show" | "map",
  string
>;

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

// Botonera de opciones excluyentes (tipo «segmented control»).
function Opciones<T extends string>({ etiqueta, valor, opciones, onChange, sinRotulo = false }: { etiqueta: string; valor: T; opciones: { id: T; texto: string }[]; onChange: (v: T) => void; sinRotulo?: boolean }) {
  return (
    <div role="group" aria-label={etiqueta} className="flex flex-col gap-1.5">
      <span className={sinRotulo ? "sr-only" : "text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]"}>{etiqueta}</span>
      <div className="inline-flex max-w-full overflow-x-auto rounded-full border border-[var(--border-strong)] p-0.5">
        {opciones.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={o.id === valor}
            onClick={() => onChange(o.id)}
            className={`min-h-9 whitespace-nowrap rounded-full px-2.5 text-[0.82rem] font-semibold transition sm:px-3.5 sm:text-sm ${
              o.id === valor ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
            }`}
          >
            {o.texto}
          </button>
        ))}
      </div>
    </div>
  );
}

// Selector de mes (nativo: en el celular abre la rueda del sistema).
function Mes({ etiqueta, valor, periodos, desde, hasta, onChange }: { etiqueta: string; valor: number; periodos: string[]; desde: number; hasta: number; onChange: (i: number) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">{etiqueta}</span>
      <select
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-h-11 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--bg)] px-3 text-base text-[var(--fg)] sm:min-h-9 sm:text-sm"
      >
        {periodos.map((p, i) => (i >= desde && i <= hasta ? <option key={p} value={i}>{p.replace("/", " ")}</option> : null))}
      </select>
    </label>
  );
}

// Props: los indicadores ya leídos en el servidor y los textos de la sección (que traduce el servidor).
export function IndicadoresGanaderos({ indicadores, etiquetas: L }: { indicadores: Indicador[]; etiquetas: EtiquetasIndicadores }) {
  const id = useId();
  const [sel, setSel] = useState(0);
  const [apagadas, setApagadas] = useState<Record<string, number[]>>({});
  const [rangos, setRangos] = useState<Record<string, [number, number]>>({});
  const [forma, setForma] = useState<Forma>("lineas");
  const [vista, setVista] = useState<Vista>("grafica");
  const [hover, setHover] = useState<number | null>(null);
  // En el celular los filtros avanzados van plegados y la gráfica y el mapa se alternan (en escritorio van juntos).
  const [masFiltros, setMasFiltros] = useState(false);
  const [panel, setPanel] = useState<"grafica" | "mapa">("grafica");
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
  }, [vista]);

  const completo = indicadores[Math.min(sel, indicadores.length - 1)];
  const total = completo.periodos.length;
  // Rango elegido: por defecto, los últimos doce meses con dato.
  const [ini, fin] = rangos[completo.clave] ?? [Math.max(0, total - 12), total - 1];
  const ind: Indicador = {
    ...completo,
    periodos: completo.periodos.slice(ini, fin + 1),
    series: completo.series.map((s) => ({ ...s, valores: s.valores.slice(ini, fin + 1) })),
  };
  const fijarRango = (a: number, b: number) => {
    setRangos((prev) => ({ ...prev, [completo.clave]: [Math.min(a, b), Math.max(a, b)] }));
    setHover(null);
  };
  const atajo = (meses: number) => fijarRango(meses === 0 ? 0 : Math.max(0, total - meses), total - 1);
  const atajoActivo = [6, 12, 36, 0].find((k) => (k === 0 ? ini === 0 : ini === Math.max(0, total - k)) && fin === total - 1);

  const off = apagadas[ind.clave] ?? [];
  const visibles = ind.series.map((_, i) => i).filter((i) => !off.includes(i));
  const n = ind.periodos.length;
  const barras = forma === "barras";

  // Geometría de la gráfica: se recalcula en cada render (son pocos puntos) en vez de memorizarla con dependencias frágiles.
  const alto = ancho < 520 ? 190 : 235;
  const m = { l: ancho < 520 ? 40 : 48, r: 14, t: 16, b: 30 };
  const interior = ancho - m.l - m.r;
  const valoresVisibles = visibles.flatMap((i) => ind.series[i].valores).filter((v): v is number => v !== null);
  const lo = valoresVisibles.length ? Math.min(...valoresVisibles) : 0;
  const hi = valoresVisibles.length ? Math.max(...valoresVisibles) : 1;
  const holgura = (hi - lo || hi * 0.1 || 1) * 0.12;
  // Las barras parten de cero (una barra cortada exagera las diferencias); las líneas se ajustan a los datos.
  const marcas = barras ? marcasEje(0, hi * 1.05) : marcasEje(lo - holgura, hi + holgura);
  const min = marcas[0];
  const max = marcas[marcas.length - 1];
  const banda = interior / Math.max(1, n);
  const x = (i: number) => (barras ? m.l + banda * (i + 0.5) : m.l + (interior * i) / Math.max(1, n - 1));
  const y = (v: number) => m.t + (alto - m.t - m.b) * (1 - (v - min) / (max - min || 1));
  const ultimo = ultimoConDato(ind.series);
  const idx = Math.min(hover ?? ultimo, n - 1);
  const cadaCuanto = Math.ceil(n / (ancho < 520 ? 4 : 7));
  const grosorBarra = Math.max(3, Math.min(26, (banda * 0.72) / Math.max(1, visibles.length)));

  // Lee el mes más cercano al cursor o al dedo.
  const alMover = (e: React.PointerEvent<SVGSVGElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    const i = barras ? Math.floor((px - m.l) / banda) : Math.round(((px - m.l) / interior) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };
  const alternar = (i: number) =>
    setApagadas((prev) => {
      const actuales = prev[ind.clave] ?? [];
      // Siempre queda una serie encendida: una gráfica vacía no dice nada.
      if (!actuales.includes(i) && actuales.length >= ind.series.length - 1) return prev;
      return { ...prev, [ind.clave]: actuales.includes(i) ? actuales.filter((k) => k !== i) : [...actuales, i] };
    });

  // Descarga lo que se está viendo (el rango elegido y todas las series) como CSV que abre Excel.
  const exportar = () => {
    const filas = [["Fecha", ...ind.series.map((s) => s.nombre)].join(";")];
    ind.periodos.forEach((p, i) => filas.push([p, ...ind.series.map((s) => s.valores[i] ?? "")].join(";")));
    const url = URL.createObjectURL(new Blob(["﻿" + filas.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${ind.clave}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const unaSerie = visibles.length === 1;
  const resumen = `${ind.titulo}: ${ind.series
    .map((s) => `${s.nombre} ${s.valores[ultimo] === null ? L.noData : pesos(s.valores[ultimo] as number)}`)
    .join(", ")} — ${mesLargo(ind.periodos[ultimo])}.`;
  const verGrafica = vista !== "tabla";
  const verTabla = vista !== "grafica";

  // Tabla de datos: visible en las vistas «tabla» y «ambas»; en «gráfica» queda oculta para los lectores de pantalla.
  const tabla = (
    <table className={verTabla ? "w-full min-w-max border-collapse text-sm tabular-nums" : "sr-only"}>
      <caption className={verTabla ? "sr-only" : undefined}>{`${ind.titulo} — ${ind.descripcion} (${ind.unidad})`}</caption>
      <thead>
        <tr className="border-b border-[var(--border-strong)] text-left text-xs uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          <th scope="col" className="sticky left-0 bg-[var(--bg-2)] px-3 py-2.5 font-semibold">{L.month}</th>
          {ind.series.map((s, i) => (
            <th key={s.nombre} scope="col" className="px-3 py-2.5 text-right font-semibold">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full" style={{ background: COLORES[i % COLORES.length] }} />
                {s.nombre}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ind.periodos
          .map((p, i) => ({ p, i }))
          .reverse()
          .map(({ p, i }) => (
            <tr key={p} className={`border-b border-[var(--border)] ${i === idx ? "bg-[var(--surface-2)]" : ""}`}>
              <th scope="row" className="sticky left-0 bg-[var(--bg-2)] px-3 py-2 text-left font-medium">{mesLargo(p).replace(/^./, (c) => c.toUpperCase())}</th>
              {ind.series.map((s) => (
                <td key={s.nombre} className="px-3 py-2 text-right">{s.valores[i] === null ? L.noData : pesos(s.valores[i] as number)}</td>
              ))}
            </tr>
          ))}
      </tbody>
    </table>
  );

  return (
    <section aria-labelledby={`${id}-t`} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-gradient-to-b from-[var(--surface-2)] to-[var(--surface)] p-4 sm:p-7">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <p className="lx-kicker text-[var(--accent)]">{L.kicker}</p>
          <h2 id={`${id}-t`} className="lx-display mt-2 text-2xl font-semibold leading-tight sm:text-3xl">{L.title}</h2>
        </div>
        <div role="tablist" aria-label={L.title} className="-mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 pb-1">
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
              className={`min-h-11 shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
                i === sel ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--border-strong)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
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
            {L.updated}: <span className="font-semibold text-[var(--fg)]">{mesLargo(completo.periodos[completo.periodos.length - 1])}</span>
          </p>
        </div>

        {/* Filtros. En el celular: periodo y forma a la vista, y lo demás (meses y vista) tras «Más filtros». */}
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-4 gap-y-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)]/60 p-3 sm:flex sm:flex-wrap sm:gap-y-4 sm:p-4">
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <Opciones
              etiqueta={L.period}
              valor={String(atajoActivo ?? "")}
              opciones={[{ id: "6", texto: L.last6 }, { id: "12", texto: L.last12 }, { id: "36", texto: L.last36 }, { id: "0", texto: L.all }]}
              onChange={(v) => atajo(Number(v))}
            />
          </div>
          <div className="max-sm:order-2 sm:order-4">
            <Opciones<Forma>
              etiqueta={L.chart}
              valor={forma}
              opciones={[{ id: "lineas", texto: L.lines }, { id: "area", texto: L.area }, { id: "barras", texto: L.bars }]}
              onChange={setForma}
            />
          </div>
          <button
            type="button"
            aria-expanded={masFiltros}
            onClick={() => setMasFiltros((v) => !v)}
            className="order-3 inline-flex min-h-11 items-center gap-1.5 justify-self-end rounded-full border border-[var(--border-strong)] px-3 text-sm font-semibold text-[var(--accent)] sm:hidden"
          >
            {L.moreFilters}
            <span aria-hidden className={`transition-transform ${masFiltros ? "rotate-180" : ""}`}>▾</span>
          </button>
          <div className={`max-sm:order-4 sm:order-2 ${masFiltros ? "" : "max-sm:hidden"}`}>
            <Mes etiqueta={L.from} valor={ini} periodos={completo.periodos} desde={0} hasta={fin} onChange={(i) => fijarRango(i, fin)} />
          </div>
          <div className={`max-sm:order-5 sm:order-3 ${masFiltros ? "" : "max-sm:hidden"}`}>
            <Mes etiqueta={L.to} valor={fin} periodos={completo.periodos} desde={ini} hasta={total - 1} onChange={(i) => fijarRango(ini, i)} />
          </div>
          <div className={`col-span-2 max-sm:order-6 sm:order-5 sm:col-span-1 ${masFiltros ? "" : "max-sm:hidden"}`}>
            <Opciones<Vista>
              etiqueta={L.view}
              valor={vista}
              opciones={[{ id: "grafica", texto: L.viewChart }, { id: "tabla", texto: L.viewTable }, { id: "ambas", texto: L.viewBoth }]}
              onChange={setVista}
            />
          </div>
        </div>

        {/* Una tarjeta por serie: el valor del mes que se está mirando, su variación y su tendencia; también enciende y apaga la línea. */}
        <p className="mt-4 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">{L.regions}</p>
        <div className={`-mx-1 mt-1.5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 ${ind.series.length > 1 ? "sm:grid-cols-3" : "sm:grid-cols-1"}`}>
          {ind.series.map((s, i) => {
            const encendida = !off.includes(i);
            const valor = s.valores[idx];
            const v = variacion(s.valores, idx);
            return (
              <button
                key={s.nombre}
                type="button"
                aria-pressed={encendida}
                data-unica={ind.series.length === 1}
                onClick={() => alternar(i)}
                disabled={ind.series.length === 1}
                className={`flex min-h-11 shrink-0 snap-start flex-col gap-1 rounded-[var(--radius)] border p-2.5 text-left transition max-sm:w-[11.5rem] max-sm:data-[unica=true]:w-full sm:p-3 ${
                  encendida ? "border-[var(--border-strong)] bg-[var(--surface)]" : "border-[var(--border)] opacity-50"
                } disabled:cursor-default`}
              >
                <span className="flex items-center gap-2 text-xs font-semibold text-[var(--fg-muted)]">
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: COLORES[i % COLORES.length] }} />
                  <span className="truncate">{s.nombre}</span>
                </span>
                <span className="flex items-baseline justify-between gap-2">
                  <span className="lx-display text-xl font-semibold tabular-nums sm:text-2xl">{valor === null || valor === undefined ? "—" : pesos(valor)}</span>
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

        {verGrafica && (
          <div className="mt-5 grid grid-cols-[minmax(0,1fr)] items-center gap-4 lg:grid-cols-[minmax(0,1fr)_14.5rem] lg:gap-5">
          <div className="lg:hidden">
            <Opciones<"grafica" | "mapa">
              etiqueta={L.show}
              sinRotulo
              valor={panel}
              opciones={[{ id: "grafica", texto: L.viewChart }, { id: "mapa", texto: L.map }]}
              onChange={setPanel}
            />
          </div>
          <div ref={caja} className={`relative min-w-0 select-none ${panel === "mapa" ? "max-lg:hidden" : ""}`}>
            {/* En el celular el mes que se mira se lee arriba (el globo se tapa con el dedo). */}
            <p className="mb-1 text-xs font-semibold text-[var(--fg-muted)] sm:hidden" aria-hidden>
              {mesLargo(ind.periodos[idx])}
            </p>
            <svg
              key={`${ind.clave}-${forma}`}
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
                {ind.series.map((_, i) => (
                  <linearGradient key={i} id={`${id}-area-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={COLORES[i % COLORES.length]} stopOpacity={forma === "area" && !unaSerie ? 0.28 : 0.32} />
                    <stop offset="1" stopColor={COLORES[i % COLORES.length]} stopOpacity="0" />
                  </linearGradient>
                ))}
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
              {/* Guía del mes que se mira (por defecto, el último con dato), detrás de las series. */}
              {barras && <rect x={x(idx) - banda / 2} y={m.t} width={banda} height={alto - m.t - m.b} fill="var(--surface-2)" />}
              {!barras && <line x1={x(idx)} x2={x(idx)} y1={m.t} y2={alto - m.b} stroke="var(--border-strong)" strokeDasharray="3 4" />}
              {barras
                ? visibles.map((i, k) =>
                    ind.series[i].valores.map((v, j) =>
                      v === null ? null : (
                        <rect
                          key={`${i}-${j}`}
                          x={x(j) - (grosorBarra * visibles.length) / 2 + k * grosorBarra}
                          y={y(v)}
                          width={Math.max(2, grosorBarra - 2)}
                          height={Math.max(0, alto - m.b - y(v))}
                          rx="2"
                          fill={COLORES[i % COLORES.length]}
                          opacity={j === idx ? 1 : 0.8}
                        />
                      ),
                    ),
                  )
                : visibles.map((i) =>
                    tramos(ind.series[i].valores, x, y).map((t, k) => (
                      <g key={`${i}-${k}`}>
                        {(forma === "area" || unaSerie) && (
                          <path d={`${trazoSuave(t)}L${t[t.length - 1].x} ${alto - m.b}L${t[0].x} ${alto - m.b}Z`} fill={`url(#${id}-area-${i})`} />
                        )}
                        <path
                          d={trazoSuave(t)}
                          pathLength={1}
                          fill="none"
                          stroke={COLORES[i % COLORES.length]}
                          strokeWidth="2.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="ind-trazo"
                        />
                      </g>
                    )),
                  )}
              {!barras &&
                visibles.map((i) => {
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
          <MapaRegiones
            className={`mx-auto w-full max-w-[15rem] lg:max-w-none ${panel === "grafica" ? "max-lg:hidden" : ""}`}
            series={ind.series.map((sr, i) => ({
              nombre: sr.nombre,
              valor: sr.valores[idx] === null || sr.valores[idx] === undefined ? "—" : pesos(sr.valores[idx] as number),
              color: COLORES[i % COLORES.length],
              encendida: !off.includes(i),
            }))}
            alternar={alternar}
          />
          </div>
        )}

        {verTabla ? (
          <div className="relative mt-5 max-h-96 overflow-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)]">{tabla}</div>
        ) : (
          tabla
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-xs text-[var(--fg-muted)]">
            {L.source}: {ind.fuente}
          </p>
          <button
            type="button"
            onClick={exportar}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border-strong)] px-4 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--surface-2)] sm:min-h-9"
          >
            <span aria-hidden>↓</span> {L.export} (CSV)
          </button>
        </div>
      </div>
    </section>
  );
}
