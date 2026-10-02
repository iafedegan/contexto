"use client";

import { useId, useMemo, useRef, useState } from "react";
import { fmt, renderChartSvg, type ChartSpec } from "@/lib/chart-svg";

type Tip = { x: number; y: number; title: string; rows: { color: string; name: string; value: string }[] };

const COLORS = ["#2f6b3f", "#c2652a", "#3b6fd4", "#8a5cf6"];

/**
 * Gráfica interactiva: al pasar el cursor (o tocar / enfocar con teclado) se
 * resalta la marca y aparece su valor; en las de varias series la leyenda
 * activa y desactiva cada una; entran con animación (salvo que el lector
 * prefiera menos movimiento). Se dibuja con el mismo SVG que la versión
 * estática y trae una tabla oculta con los datos para lectores de pantalla.
 */
export function InteractiveChart({ spec, caption }: { spec: ChartSpec; caption?: string }) {
  const uid = useId().replace(/[^a-z0-9]/gi, "");
  const [hidden, setHidden] = useState<number[]>([]);
  const [tip, setTip] = useState<Tip | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const svg = useMemo(() => renderChartSvg(spec, { interactive: true, hidden, id: uid }), [spec, hidden, uid]);

  function describe(el: Element): Tip["rows"] {
    const i = Number(el.getAttribute("data-i"));
    const sAttr = el.getAttribute("data-s");
    const vis = spec.series.map((s, si) => ({ s, si })).filter((x) => !hidden.includes(x.si));
    if (spec.type === "pie") {
      const total = spec.series[0].values.reduce((a, b) => a + b, 0) || 1;
      const v = spec.series[0].values[i];
      return [{ color: COLORS[i % COLORS.length], name: `${Math.round((v / total) * 100)} % del total`, value: `${fmt(v)}` }];
    }
    const list = sAttr === null ? vis : vis.filter((x) => x.si === Number(sAttr));
    return list.map(({ s, si }) => ({ color: COLORS[si % COLORS.length], name: s.name, value: fmt(s.values[i]) }));
  }

  function show(el: Element, clientX: number, clientY: number) {
    const b = box.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const i = Number(el.getAttribute("data-i"));
    const svgEl = b.querySelector("svg");
    svgEl?.classList.add("hov");
    svgEl?.querySelectorAll(".on").forEach((n) => n.classList.remove("on"));
    const s = el.getAttribute("data-s");
    svgEl?.querySelectorAll(`.mk[data-i="${i}"]${s === null || spec.type === "pie" ? "" : `[data-s="${s}"]`}`).forEach((n) => n.classList.add("on"));
    setTip({
      x: Math.min(Math.max(clientX - r.left, 8), r.width - 8),
      y: Math.max(clientY - r.top, 8),
      title: spec.labels[i],
      rows: describe(el),
    });
  }
  function hide() {
    const svgEl = box.current?.querySelector("svg");
    svgEl?.classList.remove("hov");
    svgEl?.querySelectorAll(".on").forEach((n) => n.classList.remove("on"));
    setTip(null);
  }

  return (
    <figure className="lx-chart-fig my-8">
      <div
        ref={box}
        className="relative overflow-hidden rounded-2xl [&>div>svg]:h-auto [&>div>svg]:w-full [&_svg]:touch-manipulation"
        onPointerMove={(e) => {
          const el = (e.target as Element).closest?.("[data-i]");
          if (el) show(el, e.clientX, e.clientY);
          else hide();
        }}
        onPointerLeave={hide}
        onClick={(e) => {
          const lg = (e.target as Element).closest?.("[data-lg]");
          if (!lg) return;
          const idx = Number(lg.getAttribute("data-lg"));
          setHidden((h) => (h.includes(idx) ? h.filter((x) => x !== idx) : h.length < spec.series.length - 1 ? [...h, idx] : h));
        }}
        onFocusCapture={(e) => {
          const el = (e.target as Element).closest?.("[data-i]");
          if (!el) return;
          const r = el.getBoundingClientRect();
          show(el, r.left + r.width / 2, r.top);
        }}
        onBlurCapture={hide}
      >
        <div dangerouslySetInnerHTML={{ __html: svg }} />
        {tip && (
          <div
            role="status"
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-[#141210] px-3 py-2 text-xs leading-snug text-white shadow-xl"
            style={{ left: tip.x, top: tip.y - 10 }}
          >
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
      <table className="sr-only">
        <caption>{spec.title}</caption>
        <thead>
          <tr>
            <th scope="col" />
            {spec.series.map((s) => (
              <th key={s.name} scope="col">
                {s.name} ({spec.unit})
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.labels.map((l, i) => (
            <tr key={l + i}>
              <th scope="row">{l}</th>
              {spec.series.map((s) => (
                <td key={s.name}>{s.values[i]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs opacity-70">
        {spec.type === "pie" ? "Pasa el cursor o toca una porción para ver su valor." : "Pasa el cursor o toca una marca para ver su valor."}
        {spec.series.length > 1 && " Toca una serie de la leyenda para ocultarla o mostrarla."}
      </p>
      {caption && <figcaption className="mt-2 text-sm opacity-80" dangerouslySetInnerHTML={{ __html: caption }} />}
    </figure>
  );
}
