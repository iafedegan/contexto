"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { aplicarTipo, chartProblem, fmt, renderChartSvg, type ChartSpec, type TipoGrafica } from "@/lib/chart-svg";
import { nfCO2 as nf } from "@/lib/format";

// Globo informativo: posición, título y filas con color, nombre y valor.
type Tip = { x: number; y: number; title: string; rows: { color: string; name: string; value: string }[] };

// Colores de las series.
const COLORS = ["#2dd4bf", "#a78bfa", "#f472b6", "#fbbf24"];
// Formatea una variación porcentual con signo.
const pct = (n: number) => `${n >= 0 ? "+" : "−"}${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(Math.abs(n))} %`;

// Formas en que se puede ver la gráfica.
const FORMAS: { id: Exclude<TipoGrafica, "auto">; label: string }[] = [
  { id: "vertical", label: "Barras" },
  { id: "horizontal", label: "Horizontal" },
  { id: "histograma", label: "Histograma" },
  { id: "line", label: "Líneas" },
  { id: "area", label: "Área" },
  { id: "torta", label: "Torta" },
  { id: "dona", label: "Dona" },
];

/** Forma con la que viene la gráfica (la misma regla que usa el dibujo para decidir barras horizontales). */
function formaDe(c: ChartSpec): Exclude<TipoGrafica, "auto"> {
  if (c.type === "pie") return c.variant === "torta" ? "torta" : "dona";
  if (c.type === "line") return c.variant === "area" ? "area" : "line";
  if (c.variant === "horizontal" || c.variant === "histograma" || c.variant === "vertical") return c.variant;
  return c.labels.some((l) => l.length > 14) || c.labels.length > 7 ? "horizontal" : "vertical";
}

// Patrón de nombres de mes abreviados en español.
const MESES = /\b(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)/i;
// Indica si las etiquetas son fechas o periodos, para sugerir líneas.
const esTemporal = (labels: string[]) => labels.every((l) => /\b(19|20)\d{2}\b/.test(l) || MESES.test(l) || /^t[1-4]\b/i.test(l.trim()));

// Clases de un botón de opción según esté activo.
const chip = (on: boolean) =>
  `inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
    on ? "border-transparent bg-[var(--accent)] text-[var(--accent-fg,#fff)]" : "border-[color-mix(in_srgb,currentColor_22%,transparent)] hover:border-[var(--accent)]"
  }`;

/**
 * Gráfica interactiva con fondo transparente (hereda el color y el fondo del sitio).
 * Controles: tipo de gráfica, rango «desde / hasta», orden, series (leyenda), indicadores calculados sobre lo
 * que se ve, clic para fijar un dato, tabla, descarga CSV y pantalla completa. Trae una tabla oculta con los datos
 * para lectores de pantalla.
 */
export function InteractiveChart({ spec, caption }: { spec: ChartSpec; caption?: string }) {
  const uid = useId().replace(/[^a-z0-9]/gi, "");
  const fig = useRef<HTMLElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const n0 = spec.labels.length;

  const [forma, setForma] = useState<Exclude<TipoGrafica, "auto">>(() => formaDe(spec));
  const [desde, setDesde] = useState(0);
  const [hasta, setHasta] = useState(n0 - 1);
  const [orden, setOrden] = useState<"orig" | "desc" | "asc">("orig");
  const [hidden, setHidden] = useState<number[]>([]);
  const [tabla, setTabla] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  // Ancho real del contenedor: el dibujo se compone para ese ancho (no se encoge uno de 800 px, que dejaba los textos ilegibles en el celular).
  const [ancho, setAncho] = useState(800);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width / 20) * 20; // de 20 en 20 px: no se redibuja a cada píxel
      if (w > 0) setAncho(Math.min(900, Math.max(300, w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const temporal = useMemo(() => esTemporal(spec.labels), [spec.labels]);
  const primera = useMemo(() => spec.series.findIndex((_, i) => !hidden.includes(i)), [spec.series, hidden]);
  const refIdx = primera < 0 ? 0 : primera;
  const filtrado = desde > 0 || hasta < n0 - 1 || orden !== "orig" || forma !== formaDe(spec) || hidden.length > 0;

  // Datos que se ven: rango → orden → forma.
  const view = useMemo<ChartSpec>(() => {
    let idx = spec.labels.map((_, i) => i).filter((i) => i >= desde && i <= hasta);
    const ref = spec.series[refIdx].values;
    if (orden !== "orig" && forma !== "line" && forma !== "area") idx = [...idx].sort((a, b) => (orden === "desc" ? ref[b] - ref[a] : ref[a] - ref[b]));
    const base: ChartSpec = { ...spec, labels: idx.map((i) => spec.labels[i]), series: spec.series.map((s) => ({ ...s, values: idx.map((i) => s.values[i]) })) };
    const conUna = forma === "torta" || forma === "dona" ? { ...base, series: [base.series[refIdx]] } : base;
    const f = aplicarTipo(conUna, forma);
    if (!f.ok || chartProblem(f.chart)) return spec;
    return f.chart;
  }, [spec, desde, hasta, orden, forma, refIdx]);

  const esTorta = view.type === "pie";
  const hiddenView = useMemo(() => (esTorta ? [] : hidden), [esTorta, hidden]);
  const svg = useMemo(() => renderChartSvg(view, { interactive: true, transparent: true, hidden: hiddenView, id: uid, width: ancho }), [view, hiddenView, uid, ancho]);
  const vals = view.series[esTorta ? 0 : Math.min(refIdx, view.series.length - 1)].values;
  const total = vals.reduce((a, b) => a + b, 0) || 1;

  // Indicadores sobre lo que se ve.
  const kpis = useMemo(() => {
    const iMax = vals.indexOf(Math.max(...vals));
    const iMin = vals.indexOf(Math.min(...vals));
    const prom = vals.reduce((a, b) => a + b, 0) / vals.length;
    const out: { k: string; v: string; s: string }[] = [
      { k: esTorta ? "Mayor parte" : "Máximo", v: esTorta ? `${Math.round((vals[iMax] / total) * 100)} %` : fmt(vals[iMax]), s: view.labels[iMax] },
      { k: esTorta ? "Menor parte" : "Mínimo", v: esTorta ? `${Math.round((vals[iMin] / total) * 100)} %` : fmt(vals[iMin]), s: view.labels[iMin] },
    ];
    if (!esTorta) out.push({ k: "Promedio", v: fmt(prom), s: `${vals.length} datos` });
    if (!esTorta && temporal && vals[0]) out.push({ k: "Cambio", v: pct(((vals[vals.length - 1] - vals[0]) / Math.abs(vals[0])) * 100), s: `${view.labels[0]} → ${view.labels[view.labels.length - 1]}`.slice(0, 30) });
    if (esTorta) out.push({ k: "Total", v: fmt(total), s: view.unit.slice(0, 30) });
    return out;
  }, [vals, view, esTorta, total, temporal]);

  // Marca fija (clic) sobre el SVG actual.
  useLayoutEffect(() => {
    const el = box.current?.querySelector("svg");
    if (!el) return;
    el.classList.toggle("hasel", sel !== null);
    el.querySelectorAll(".sel").forEach((n) => n.classList.remove("sel"));
    if (sel !== null) el.querySelectorAll(`[data-i="${sel}"]`).forEach((n) => n.classList.add("sel"));
  }, [svg, sel]);

  // Filas del globo informativo para el elemento bajo el cursor.
  function describe(el: Element): Tip["rows"] {
    const i = Number(el.getAttribute("data-i"));
    const sAttr = el.getAttribute("data-s");
    if (esTorta) {
      const v = view.series[0].values[i];
      return [{ color: COLORS[i % COLORS.length], name: `${Math.round((v / total) * 100)} % del total`, value: fmt(v) }];
    }
    const vis = view.series.map((s, si) => ({ s, si })).filter((x) => !hidden.includes(x.si));
    const list = sAttr === null ? vis : vis.filter((x) => x.si === Number(sAttr));
    return list.map(({ s, si }) => {
      const prev = i > 0 ? s.values[i - 1] : null;
      const d = prev ? ` (${pct(((s.values[i] - prev) / Math.abs(prev)) * 100)})` : "";
      return { color: COLORS[si % COLORS.length], name: s.name, value: `${fmt(s.values[i])}${temporal && orden === "orig" ? d : ""}` };
    });
  }

  // Muestra el globo junto al cursor.
  function show(el: Element, clientX: number, clientY: number) {
    const b = box.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const i = Number(el.getAttribute("data-i"));
    const svgEl = b.querySelector("svg");
    svgEl?.classList.add("hov");
    svgEl?.querySelectorAll(".on").forEach((n) => n.classList.remove("on"));
    const s = el.getAttribute("data-s");
    svgEl?.querySelectorAll(`.mk[data-i="${i}"]${s === null || esTorta ? "" : `[data-s="${s}"]`}`).forEach((n) => n.classList.add("on"));
    setTip({ x: Math.min(Math.max(clientX - r.left, 8), r.width - 8), y: Math.max(clientY - r.top, 8), title: view.labels[i], rows: describe(el) });
  }
  // Oculta el globo.
  function hide() {
    const svgEl = box.current?.querySelector("svg");
    svgEl?.classList.remove("hov");
    svgEl?.querySelectorAll(".on").forEach((n) => n.classList.remove("on"));
    setTip(null);
  }

  // Vuelve la gráfica a su forma y series originales.
  function reiniciar() {
    setForma(formaDe(spec)); setDesde(0); setHasta(n0 - 1); setOrden("orig"); setHidden([]); setSel(null);
  }

  // Descarga los datos de la gráfica como CSV.
  function csv() {
    // Escapa un valor como celda CSV entre comillas.
    const q = (x: string | number) => `"${String(x).replace(/"/g, '""')}"`;
    const filas = [[q(`${view.title} (${view.unit})`), ...view.series.map((s) => q(s.name))].join(",")];
    view.labels.forEach((l, i) => filas.push([q(l), ...view.series.map((s) => s.values[i])].join(",")));
    if (view.source) filas.push("", q(`Fuente: ${view.source}`));
    const url = URL.createObjectURL(new Blob(["﻿" + filas.join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${view.title.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "grafica"}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const detalle = sel !== null && sel < view.labels.length ? (() => {
    const v = vals[sel];
    const rank = [...vals].sort((a, b) => b - a).indexOf(v) + 1;
    const prev = sel > 0 ? vals[sel - 1] : null;
    return `${view.labels[sel]}: ${nf.format(v)} ${view.unit} · ${Math.round((v / total) * 100)} % del total · puesto ${rank} de ${vals.length}${prev && temporal && orden === "orig" ? ` · ${pct(((v - prev) / Math.abs(prev)) * 100)} frente a ${view.labels[sel - 1]}` : ""}`;
  })() : null;

  // Muestra u oculta una serie al pulsar su leyenda.
  const alternar = (e: { target: EventTarget | null }) => {
    const el = (e.target as Element).closest?.("[data-i]");
    if (!el) return setSel(null);
    const i = Number(el.getAttribute("data-i"));
    setSel((cur) => (cur === i ? null : i));
  };

  return (
    <figure
      ref={fig}
      className="lx-chart-fig my-8 rounded-2xl border border-[color-mix(in_srgb,currentColor_14%,transparent)] bg-transparent p-3 text-[var(--fg)] sm:p-5 [&:fullscreen]:overflow-auto [&:fullscreen]:bg-[var(--bg)] [&:fullscreen]:p-8"
    >
      {/* Controles */}
      <div className="lx-ui not-prose mb-3 flex flex-col gap-2.5">
        <div role="group" aria-label="Tipo de gráfica" className="flex gap-1.5 overflow-x-auto pb-0.5">
          {FORMAS.filter((f) => (f.id === "torta" || f.id === "dona" ? !temporal && spec.series[refIdx].values.every((v) => v > 0) : true)).map((f) => (
            <button key={f.id} type="button" aria-pressed={forma === f.id} className={chip(forma === f.id)} onClick={() => { setForma(f.id); setSel(null); }}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          {n0 > 3 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <label htmlFor={`${uid}d`} className="opacity-70">Desde</label>
              <select id={`${uid}d`} value={desde} onChange={(e) => { const v = Number(e.target.value); setDesde(v); if (hasta <= v) setHasta(Math.min(n0 - 1, v + 1)); setSel(null); }} className="max-w-[8.5rem] rounded-md border border-[color-mix(in_srgb,currentColor_22%,transparent)] bg-transparent px-2 py-1">
                {spec.labels.slice(0, n0 - 1).map((l, i) => <option key={i} value={i} className="text-black">{l}</option>)}
              </select>
              <label htmlFor={`${uid}h`} className="opacity-70">hasta</label>
              <select id={`${uid}h`} value={hasta} onChange={(e) => { const v = Number(e.target.value); setHasta(v); if (desde >= v) setDesde(Math.max(0, v - 1)); setSel(null); }} className="max-w-[8.5rem] rounded-md border border-[color-mix(in_srgb,currentColor_22%,transparent)] bg-transparent px-2 py-1">
                {spec.labels.map((l, i) => (i > 0 ? <option key={i} value={i} className="text-black">{l}</option> : null))}
              </select>
            </div>
          )}
          {forma !== "line" && forma !== "area" && (
            <div role="group" aria-label="Orden" className="flex flex-wrap items-center gap-1.5">
              <span className="opacity-70">Orden</span>
              {([["orig", "Original"], ["desc", "Mayor a menor"], ["asc", "Menor a mayor"]] as const).map(([id, label]) => (
                <button key={id} type="button" aria-pressed={orden === id} className={chip(orden === id)} onClick={() => { setOrden(id); setSel(null); }}>{label}</button>
              ))}
            </div>
          )}
          {spec.series.length > 1 && !esTorta && (
            <div role="group" aria-label="Series" className="flex flex-wrap items-center gap-1.5">
              <span className="opacity-70">Series</span>
              {spec.series.map((s, i) => {
                const on = !hidden.includes(i);
                return (
                  <button key={s.name} type="button" aria-pressed={on} className={chip(on)} onClick={() => setHidden((h) => (h.includes(i) ? h.filter((x) => x !== i) : h.length < spec.series.length - 1 ? [...h, i] : h))}>
                    <span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{s.name}
                  </button>
                );
              })}
            </div>
          )}
          {filtrado && <button type="button" onClick={reiniciar} className="font-semibold text-[var(--accent)] underline-offset-4 hover:underline">Restablecer</button>}
        </div>
      </div>

      {/* Gráfica */}
      <div
        ref={box}
        className="relative overflow-hidden text-[var(--fg)] [&>div>svg]:h-auto [&>div>svg]:w-full [&_svg]:touch-manipulation"
        onPointerMove={(e) => {
          const el = (e.target as Element).closest?.("[data-i]");
          if (el) show(el, e.clientX, e.clientY);
          else hide();
        }}
        onPointerLeave={hide}
        onClick={alternar}
        onFocusCapture={(e) => {
          const el = (e.target as Element).closest?.("[data-i]");
          if (!el) return;
          const r = el.getBoundingClientRect();
          show(el, r.left + r.width / 2, r.top);
        }}
        onBlurCapture={hide}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          if (!(e.target as Element).closest?.("[data-i]")) return;
          e.preventDefault();
          alternar(e);
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: svg }} />
        {tip && (
          <div role="status" className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-[#141210] px-3 py-2 text-xs leading-snug text-white shadow-xl" style={{ left: tip.x, top: tip.y - 10 }}>
            <div className="mb-1 font-semibold">{tip.title}</div>
            {tip.rows.map((r) => (
              <div key={r.name} className="flex items-center gap-2 whitespace-nowrap">
                <span className="size-2 rounded-full" style={{ background: r.color }} />
                <span className="text-white/75">{r.name}</span>
                <span className="ml-auto pl-3 font-semibold">{r.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {detalle && (
        <p role="status" className="lx-ui not-prose mt-2 rounded-lg border border-[var(--accent)]/40 px-3 py-2 text-sm">
          {detalle}
        </p>
      )}

      {/* Indicadores y acciones */}
      <dl className="lx-ui not-prose mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.k} className="rounded-xl border border-[color-mix(in_srgb,currentColor_14%,transparent)] px-3 py-2">
            <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] opacity-65">{k.k}</dt>
            <dd className="text-lg font-bold leading-tight">{k.v}</dd>
            <dd className="truncate text-xs opacity-65">{k.s}</dd>
          </div>
        ))}
      </dl>
      <div className="lx-ui not-prose mt-3 flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={tabla} className={chip(tabla)} onClick={() => setTabla((v) => !v)}>{tabla ? "Ocultar tabla" : "Ver tabla de datos"}</button>
        <button type="button" className={chip(false)} onClick={csv}>Descargar datos (CSV)</button>
        <button type="button" className={chip(false)} onClick={() => (document.fullscreenElement ? document.exitFullscreen() : fig.current?.requestFullscreen?.())}>Pantalla completa</button>
        <span className="ml-auto text-xs opacity-65">Toca o haz clic en un dato para fijarlo.</span>
      </div>

      {tabla && (
        <div className="lx-ui not-prose mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color-mix(in_srgb,currentColor_22%,transparent)] text-left">
                <th className="py-1.5 pr-4 font-semibold" scope="col" />
                {view.series.map((s) => <th key={s.name} scope="col" className="py-1.5 pr-4 font-semibold">{s.name} ({view.unit})</th>)}
              </tr>
            </thead>
            <tbody>
              {view.labels.map((l, i) => (
                <tr key={l + i} className="border-b border-[color-mix(in_srgb,currentColor_10%,transparent)]">
                  <th scope="row" className="py-1.5 pr-4 text-left font-medium">{l}</th>
                  {view.series.map((s) => <td key={s.name} className="py-1.5 pr-4 tabular-nums">{nf.format(s.values[i])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Datos para lectores de pantalla (siempre presentes, filtrados o no) */}
      <div className="sr-only">
      <table>
        <caption>{spec.title}</caption>
        <thead>
          <tr>
            <th scope="col" />
            {spec.series.map((s) => <th key={s.name} scope="col">{s.name} ({spec.unit})</th>)}
          </tr>
        </thead>
        <tbody>
          {spec.labels.map((l, i) => (
            <tr key={l + i}>
              <th scope="row">{l}</th>
              {spec.series.map((s) => <td key={s.name}>{s.values[i]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {caption && <figcaption className="mt-3 text-sm opacity-80" dangerouslySetInnerHTML={{ __html: caption }} />}
    </figure>
  );
}
