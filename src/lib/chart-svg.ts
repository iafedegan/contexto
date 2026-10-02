/**
 * Gráficas como SVG estático a partir de datos ya validados. Convenciones que
 * se respetan siempre: título y unidad explícitos, fuente al pie, barras desde
 * cero, ejes con marcas «redondas», etiquetas directas sin leyendas
 * innecesarias, barras horizontales cuando los nombres son largos y nada de 3D.
 * Todo texto se escapa: el SVG se pinta como imagen (<img>), donde no ejecuta
 * nada, y aun así no hereda ninguna cadena sin escapar.
 */

export type ChartSpec = {
  type: "bar" | "line" | "pie";
  /** Forma concreta dentro del tipo (la elige quien redacta): vertical/horizontal/histograma, línea/área, torta/dona. */
  variant?: "vertical" | "horizontal" | "histograma" | "area" | "torta" | "dona";
  title: string;
  unit: string;
  labels: string[];
  series: { name: string; values: number[] }[];
  /** Fuente y periodo de las cifras (se imprime al pie de la gráfica). */
  source?: string;
};

const W = 800;
/** Estilo «infografía moderna»: panel de vidrio oscuro con degradados neón (turquesa, violeta, rosa, ámbar). */
const PALETTE = ["#2dd4bf", "#a78bfa", "#f472b6", "#fbbf24"];
const GRAD: [string, string][] = [["#34d399", "#22d3ee"], ["#a78bfa", "#6366f1"], ["#f472b6", "#fb7185"], ["#fbbf24", "#f97316"]];
const INK = "#ffffff";
const MUTED = "rgba(255,255,255,0.64)";
const GRID = "rgba(255,255,255,0.11)";
const AXIS = "rgba(255,255,255,0.32)";
const CARD_EDGE = "#171a52";
const FONT = "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const nf = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });
/** 1 250 000 -> «1,3 M»; 12 000 -> «12 mil»; independiente de la versión de ICU del navegador. */
function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${nf.format(n / 1e9)} mil M`;
  if (a >= 1e6) return `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(n / 1e6)} M`;
  if (a >= 1e4) return `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(n / 1e3)} mil`;
  return nf.format(n);
}
export const fmt = (n: number) => (Math.abs(n) >= 1e6 ? compact(n) : nf.format(n));
const fmtTick = (n: number) => compact(n);

export type TipoGrafica = "auto" | "vertical" | "horizontal" | "histograma" | "line" | "area" | "torta" | "dona";
export const TIPOS_GRAFICA: { id: TipoGrafica; label: string; hint: string }[] = [
  { id: "auto", label: "Automático", hint: "La IA elige el que mejor cuenta los datos" },
  { id: "vertical", label: "Barras", hint: "Comparar categorías" },
  { id: "horizontal", label: "Barras horizontales", hint: "Nombres largos o muchas categorías" },
  { id: "histograma", label: "Histograma", hint: "Barras pegadas: distribución por rangos o periodos" },
  { id: "line", label: "Líneas", hint: "Evolución en el tiempo" },
  { id: "area", label: "Área", hint: "Evolución con volumen" },
  { id: "torta", label: "Torta", hint: "Partes de un total" },
  { id: "dona", label: "Dona", hint: "Partes de un total, con el total al centro" },
];

/** Cambia la forma de una gráfica ya armada sin tocar sus datos. «auto» la deja como está. */
export function aplicarTipo(c: ChartSpec, tipo: TipoGrafica): { ok: true; chart: ChartSpec } | { ok: false; error: string } {
  if (tipo === "auto") return { ok: true, chart: c };
  if (tipo === "torta" || tipo === "dona") {
    const s = c.series[0];
    if (!s || s.values.some((v) => v < 0)) return { ok: false, error: "La torta y la dona necesitan valores positivos." };
    return { ok: true, chart: { ...c, type: "pie", variant: tipo, series: [s] } };
  }
  if (tipo === "line" || tipo === "area") return { ok: true, chart: { ...c, type: "line", variant: tipo === "area" ? "area" : undefined } };
  return { ok: true, chart: { ...c, type: "bar", variant: tipo } };
}

/** Valida la forma de los datos. Devuelve el motivo si no sirve. */
export function chartProblem(c: ChartSpec): string | null {
  if (c.labels.length < 2 || c.labels.length > 12) return "La gráfica necesita entre 2 y 12 puntos.";
  if (!c.series.length || c.series.length > 4) return "La gráfica necesita entre 1 y 4 series.";
  for (const s of c.series) {
    if (s.values.length !== c.labels.length) return "Una serie no tiene un valor por cada etiqueta.";
    if (s.values.some((v) => !Number.isFinite(v))) return "Hay valores que no son números.";
  }
  if (c.type === "pie" && (c.series.length !== 1 || c.series[0].values.some((v) => v < 0))) {
    return "La torta usa una sola serie con valores positivos.";
  }
  return null;
}

/** Marcas «redondas» para el eje: 0, 50, 100… en vez de 813.179. */
function niceScale(min: number, max: number, ticks = 4, fromZero = true) {
  // Las líneas muestran la TENDENCIA: no hace falta partir de cero (las barras sí, siempre).
  const lo = fromZero ? Math.min(0, min) : min;
  const hi = fromZero ? Math.max(0, max) || 1 : max === min ? max + 1 : max;
  const raw = (hi - lo) / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const nmin = Math.floor(lo / step) * step;
  const nmax = Math.ceil(hi / step) * step;
  const vals: number[] = [];
  for (let v = nmin; v <= nmax + step / 2; v += step) vals.push(Math.round(v * 1e6) / 1e6);
  return { min: nmin, max: nmax, ticks: vals };
}

/** Parte un texto en hasta `lines` líneas de ~`width` caracteres. */
function wrap(text: string, width: number, lines = 2): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > width && cur) {
      out.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  if (out.length > lines) {
    out.length = lines;
    out[lines - 1] = out[lines - 1].replace(/.{0,2}$/, "…");
  }
  return out;
}

function lines(x: number, y: number, ls: string[], size: number, fill: string, anchor = "start", weight = 400, lh = 1.25) {
  return ls
    .map((l, i) => `<text x="${x}" y="${y + i * size * lh}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(l)}</text>`)
    .join("");
}

export type RenderOpts = {
  /** Marca los elementos con data-* y añade estilos/animaciones para la versión interactiva. */
  interactive?: boolean;
  /** Series ocultas desde la leyenda (índices). */
  hidden?: number[];
  /** Identificador único del degradado cuando hay varias gráficas en la página. */
  id?: string;
};

const STYLE = `<style>
.lxc .mk{cursor:pointer;transition:opacity .15s ease,filter .15s ease}
.lxc.hov .mk{opacity:.4}.lxc.hov .mk.on{opacity:1;filter:brightness(1.06)}
.lxc .lg{cursor:pointer}.lxc .lg.off{opacity:.35}
.lxc .bar{transform-box:fill-box;transform-origin:bottom;animation:lxg .7s cubic-bezier(.2,.8,.2,1) both}
.lxc .hb{transform-box:fill-box;transform-origin:left;animation:lxh .7s cubic-bezier(.2,.8,.2,1) both}
.lxc .ln{stroke-dasharray:1;stroke-dashoffset:1;animation:lxd 1.1s ease-out .1s forwards}
.lxc .dot{transform-box:fill-box;transform-origin:center;transition:transform .15s ease}
.lxc .col .gd{opacity:0;transition:opacity .15s}.lxc .col:hover .gd{opacity:1}.lxc .col:hover .dot{transform:scale(1.55)}
.lxc .sl{transform-box:fill-box;transform-origin:center;transition:transform .18s ease}.lxc .sl.on{transform:scale(1.045)}
@keyframes lxg{from{transform:scaleY(0)}}@keyframes lxh{from{transform:scaleX(0)}}@keyframes lxd{to{stroke-dashoffset:0}}
@media (prefers-reduced-motion:reduce){.lxc *{animation:none!important}.lxc .ln{stroke-dashoffset:0}}
</style>`;

export function renderChartSvg(c: ChartSpec, opts: RenderOpts = {}): string {
  const titleLines = wrap(c.title, 46, 2);
  const headH = 30 + titleLines.length * 26 + (c.unit ? 22 : 0) + (c.series.length > 1 ? 26 : 0);
  const source = c.source ? wrap(`Fuente: ${c.source}`, 118, 2) : [];
  const footH = source.length ? 24 + source.length * 15 : 18;

  const horizontal = c.type === "bar" && (c.variant === "horizontal" || (c.variant !== "vertical" && c.variant !== "histograma" && (c.labels.some((l) => l.length > 14) || c.labels.length > 7)));
  const bodyH =
    c.type === "pie" ? Math.max(300, 80 + c.labels.length * 28) : horizontal ? 28 + c.labels.length * 44 : 320;
  const H = headH + bodyH + footH;

  const hidden = new Set(opts.hidden ?? []);
  // Cifra destacada (como los «KPI» de un tablero): el mayor valor, el cambio de una serie en el tiempo o la porción principal.
  const v0 = c.series[0].values;
  let kpi = "", kpiSub = "";
  if (c.type === "pie") {
    const tot = v0.reduce((a, b) => a + b, 0) || 1;
    const m = v0.indexOf(Math.max(...v0));
    kpi = `${Math.round((v0[m] / tot) * 100)} %`;
    kpiSub = c.labels[m].slice(0, 30);
  } else if (c.type === "line" && v0[0]) {
    const ch = ((v0[v0.length - 1] - v0[0]) / Math.abs(v0[0])) * 100;
    kpi = `${ch >= 0 ? "▲" : "▼"} ${nf.format(Math.round(Math.abs(ch) * 10) / 10)} %`;
    kpiSub = `desde ${c.labels[0]}`.slice(0, 34);
  } else {
    const m = v0.indexOf(Math.max(...v0));
    kpi = fmt(v0[m]);
    kpiSub = `${c.labels[m]} · mayor valor`.slice(0, 34);
  }

  const o = { interactive: !!opts.interactive, hidden, gid: `g${opts.id ?? "a"}` };
  let body = "";
  if (c.type === "pie") body = donut(c, headH, bodyH, o);
  else if (horizontal) body = hbars(c, headH, bodyH, o);
  else body = cartesian(c, headH, bodyH, o);

  const legend =
    c.series.length > 1 && c.type !== "pie"
      ? c.series
          .map((s, i) => `<g class="lg${hidden.has(i) ? " off" : ""}"${o.interactive ? ` data-lg="${i}"` : ""}><rect x="${24 + i * 170}" y="${headH - 28}" width="160" height="24" fill="transparent"/><circle cx="${34 + i * 170}" cy="${headH - 14}" r="5" fill="${PALETTE[i % PALETTE.length]}"/><text x="${46 + i * 170}" y="${headH - 10}" font-size="12.5" fill="${INK}">${esc(s.name.slice(0, 22))}</text></g>`)
          .join("")
      : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(c.title)}" font-family="${FONT}"${o.interactive ? ' class="lxc"' : ""}>` +
    (o.interactive ? STYLE : "") +
    `<defs>
<linearGradient id="${o.gid}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d0f33" stop-opacity="0.94"/><stop offset="1" stop-color="#232a78" stop-opacity="0.90"/></linearGradient>
<radialGradient id="${o.gid}gl1"><stop offset="0" stop-color="#22d3ee" stop-opacity="0.20"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient>
<radialGradient id="${o.gid}gl2"><stop offset="0" stop-color="#a78bfa" stop-opacity="0.22"/><stop offset="1" stop-color="#a78bfa" stop-opacity="0"/></radialGradient>
<linearGradient id="${o.gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${PALETTE[0]}" stop-opacity="0.38"/><stop offset="1" stop-color="${PALETTE[0]}" stop-opacity="0"/></linearGradient>` +
    GRAD.map((g, i) => `<linearGradient id="${o.gid}c${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${g[1]}"/><stop offset="1" stop-color="${g[0]}" stop-opacity="0.85"/></linearGradient><linearGradient id="${o.gid}h${i}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${g[0]}" stop-opacity="0.85"/><stop offset="1" stop-color="${g[1]}"/></linearGradient>`).join("") +
    `<filter id="${o.gid}f" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>` +
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="22" fill="url(#${o.gid}bg)" stroke="rgba(255,255,255,0.16)"/><circle cx="${W - 70}" cy="30" r="170" fill="url(#${o.gid}gl1)"/><circle cx="60" cy="${H - 20}" r="190" fill="url(#${o.gid}gl2)"/>` +
    lines(32, 42, titleLines, 21, INK, "start", 700, 1.2) +
    `<text x="${W - 32}" y="48" font-size="32" font-weight="800" text-anchor="end" fill="${PALETTE[0]}">${esc(kpi)}</text><text x="${W - 32}" y="68" font-size="11.5" text-anchor="end" fill="${MUTED}">${esc(kpiSub)}</text>` +
    (c.unit ? `<text x="32" y="${42 + titleLines.length * 25 + 2}" font-size="13" fill="${MUTED}">${esc(c.unit)}</text>` : "") +
    legend +
    body +
    (source.length ? lines(32, H - footH + 22, source, 11, MUTED) : "") +
    `</svg>`
  );
}

type Ctx = { interactive: boolean; hidden: Set<number>; gid: string };

function cartesian(c: ChartSpec, top: number, h: number, o: Ctx) {
  const left = 58, right = 28, padT = 16, padB = 52;
  const pw = W - left - right, ph = h - padT - padB;
  const shown = c.series.map((s, si) => ({ s, si })).filter((x) => !o.hidden.has(x.si));
  const all = shown.flatMap((x) => x.s.values);
  const sc = niceScale(Math.min(...all), Math.max(...all), 4, c.type !== "line");
  const y = (v: number) => top + padT + ph - ((v - sc.min) / (sc.max - sc.min || 1)) * ph;
  const n = c.labels.length;
  const step = pw / n;
  const cx = (i: number) => left + step * i + step / 2;

  let out = "";
  for (const v of sc.ticks) {
    out += `<line x1="${left}" y1="${y(v)}" x2="${W - right}" y2="${y(v)}" stroke="${v === 0 ? AXIS : GRID}" ${v === 0 ? "" : 'stroke-dasharray="3 4"'}/>`;
    out += `<text x="${left - 10}" y="${y(v) + 4}" font-size="11.5" text-anchor="end" fill="${MUTED}">${esc(fmtTick(v))}</text>`;
  }
  c.labels.forEach((l, i) => {
    out += lines(cx(i), top + padT + ph + 20, wrap(l, Math.max(8, Math.floor(step / 7)), 2), 12, INK, "middle");
  });

  if (c.type === "bar") {
    const hist = c.variant === "histograma";
    const gap = hist ? 0 : 6;
    const bw = hist ? (step * 0.94) / shown.length : Math.min(54, (step * 0.66) / shown.length - gap / 2);
    shown.forEach(({ s, si }, vi) =>
      s.values.forEach((v, i) => {
        const x = cx(i) - ((bw + gap / 2) * shown.length) / 2 + (bw + gap / 2) * vi;
        const y0 = y(Math.max(v, 0));
        const hh = Math.max(Math.abs(y(v) - y(0)), 2);
        const r = Math.min(hist ? 3 : 8, bw / 2, hh);
        const d = `M${x},${y0 + hh} V${y0 + r} Q${x},${y0} ${x + r},${y0} H${x + bw - r} Q${x + bw},${y0} ${x + bw},${y0 + r} V${y0 + hh} Z`;
        out += o.interactive
          ? `<path d="${d}" fill="url(#${o.gid}c${si % 4})" filter="url(#${o.gid}f)" class="mk bar" data-i="${i}" data-s="${si}" tabindex="0" style="animation-delay:${i * 50}ms"/>`
          : `<path d="${d}" fill="url(#${o.gid}c${si % 4})" filter="url(#${o.gid}f)"/>`;
        if (shown.length === 1 || n <= 5) out += `<text x="${x + bw / 2}" y="${y0 - 7}" font-size="12" font-weight="600" text-anchor="middle" fill="${INK}" pointer-events="none">${esc(fmt(v))}</text>`;
      }),
    );
  } else {
    shown.forEach(({ s, si }) => {
      const color = PALETTE[si % PALETTE.length];
      const pts = s.values.map((v, i) => [cx(i), y(v)] as const);
      if (c.variant === "area") {
        const base = top + padT + ph; // el relleno llega hasta el pie del área de trazado, aunque el eje no parta de cero
        const fillA = shown.length === 1 ? `url(#${o.gid})` : color;
        out += `<path d="M${pts[0][0]},${base} ${pts.map((p) => `L${p[0]},${p[1]}`).join(" ")} L${pts[pts.length - 1][0]},${base} Z" fill="${fillA}"${shown.length === 1 ? "" : ' fill-opacity="0.22"'}/>`;
      }
      out += `<polyline${o.interactive ? ' class="ln" pathLength="1"' : ""} points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${color}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" filter="url(#${o.gid}f)"/>`;
      if (!o.interactive) {
        pts.forEach((p, i) => {
          out += `<circle cx="${p[0]}" cy="${p[1]}" r="4.5" fill="#14163f" stroke="${color}" stroke-width="2.5"/>`;
          if (shown.length === 1 && (n <= 8 || i === n - 1 || i === 0)) {
            out += `<text x="${p[0]}" y="${p[1] - 12}" font-size="12" font-weight="600" text-anchor="middle" fill="${INK}">${esc(fmt(s.values[i]))}</text>`;
          }
        });
      }
    });
    if (o.interactive) {
      // Una columna sensible por punto: guía vertical, puntos que crecen y tooltip.
      c.labels.forEach((_, i) => {
        out += `<g class="col" data-i="${i}"><rect data-i="${i}" x="${cx(i) - step / 2}" y="${top + padT}" width="${step}" height="${ph}" fill="transparent"/><line class="gd" x1="${cx(i)}" y1="${top + padT}" x2="${cx(i)}" y2="${top + padT + ph}" stroke="${MUTED}" stroke-width="1" stroke-dasharray="3 3"/>`;
        shown.forEach(({ s, si }) => {
          out += `<circle class="dot" cx="${cx(i)}" cy="${y(s.values[i])}" r="4.5" fill="#14163f" stroke="${PALETTE[si % PALETTE.length]}" stroke-width="2.5" pointer-events="none"/>`;
        });
        out += `</g>`;
      });
    }
  }
  return out;
}

function hbars(c: ChartSpec, top: number, h: number, o: Ctx) {
  const left = 190, right = 80;
  const pw = W - left - right;
  const shown = c.series.map((s, si) => ({ s, si })).filter((x) => !o.hidden.has(x.si));
  const all = shown.flatMap((x) => x.s.values);
  const sc = niceScale(Math.min(...all), Math.max(...all), 4);
  const x = (v: number) => left + ((v - sc.min) / (sc.max - sc.min || 1)) * pw;
  const rowH = (h - 28) / c.labels.length;
  const bh = Math.min(26, (rowH - 12) / shown.length);

  let out = "";
  for (const v of sc.ticks) {
    out += `<line x1="${x(v)}" y1="${top + 6}" x2="${x(v)}" y2="${top + h - 22}" stroke="${v === 0 ? AXIS : GRID}" ${v === 0 ? "" : 'stroke-dasharray="3 4"'}/>`;
    out += `<text x="${x(v)}" y="${top + h - 6}" font-size="11.5" text-anchor="middle" fill="${MUTED}">${esc(fmtTick(v))}</text>`;
  }
  c.labels.forEach((l, i) => {
    const yc = top + 6 + rowH * i + rowH / 2;
    out += lines(left - 12, yc - (wrap(l, 26, 2).length - 1) * 7 + 4, wrap(l, 26, 2), 12.5, INK, "end");
    shown.forEach(({ s, si }, vi) => {
      const v = s.values[i];
      const by = yc - (bh * shown.length) / 2 + bh * vi;
      const x0 = x(Math.min(v, 0)), x1 = x(Math.max(v, 0));
      const w = Math.max(x1 - x0, 2);
      const r = Math.min(8, bh / 2, w);
      const d = `M${x0},${by} H${x0 + w - r} Q${x0 + w},${by} ${x0 + w},${by + r} V${by + bh - r} Q${x0 + w},${by + bh} ${x0 + w - r},${by + bh} H${x0} Z`;
      out += o.interactive
        ? `<path d="${d}" fill="url(#${o.gid}h${si % 4})" filter="url(#${o.gid}f)" class="mk hb" data-i="${i}" data-s="${si}" tabindex="0" style="animation-delay:${i * 45}ms"/>`
        : `<path d="${d}" fill="url(#${o.gid}h${si % 4})" filter="url(#${o.gid}f)"/>`;
      out += `<text x="${x0 + w + 8}" y="${by + bh / 2 + 4}" font-size="12" font-weight="600" fill="${INK}" pointer-events="none">${esc(fmt(v))}</text>`;
    });
  });
  return out;
}

function donut(c: ChartSpec, top: number, h: number, o: Ctx) {
  const vals = c.series[0].values;
  const total = vals.reduce((a, b) => a + b, 0) || 1;
  const cx = 230, cy = top + h / 2, r = 120, ri = c.variant === "torta" ? 0 : 74;
  let a0 = -Math.PI / 2;
  let out = "";
  vals.forEach((v, i) => {
    const frac = v / total;
    const a1 = a0 + Math.min(frac, 0.9999) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a: number, rad: number) => `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
    const d = `M${p(a0, r)} A${r},${r} 0 ${large} 1 ${p(a1, r)} L${p(a1, ri)} A${ri},${ri} 0 ${large} 0 ${p(a0, ri)} Z`;
    out += `<path d="${d}" fill="url(#${o.gid}c${i % 4})" stroke="${CARD_EDGE}" stroke-width="3"${o.interactive ? ` class="mk sl" data-i="${i}" data-s="0" tabindex="0"` : ""}/>`;
    a0 = a1;
  });
  if (ri > 0) out += `<text x="${cx}" y="${cy - 2}" font-size="22" font-weight="700" text-anchor="middle" fill="${INK}" pointer-events="none">${esc(fmt(total))}</text><text x="${cx}" y="${cy + 18}" font-size="12" text-anchor="middle" fill="${MUTED}" pointer-events="none">total</text>`;
  c.labels.forEach((l, i) => {
    const yy = top + h / 2 - ((c.labels.length - 1) * 28) / 2 + i * 28;
    out += `<g${o.interactive ? ` class="mk" data-i="${i}" data-s="0"` : ""}><rect x="440" y="${yy - 18}" width="${W - 440 - 24}" height="26" fill="transparent"/><circle cx="450" cy="${yy - 4}" r="6" fill="${PALETTE[i % PALETTE.length]}"/><text x="466" y="${yy}" font-size="13.5" fill="${INK}">${esc(l.slice(0, 28))}</text><text x="${W - 32}" y="${yy}" font-size="13.5" font-weight="600" text-anchor="end" fill="${INK}">${esc(fmt(vals[i]))} · ${Math.round((vals[i] / total) * 100)} %</text></g>`;
  });
  return out;
}

// --- Viaje del dato: el artículo guarda la gráfica como imagen incrustada ----

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));
const unb64 = (s: string) => decodeURIComponent(escape(atob(s)));

/** Datos de la gráfica en texto corto (para el marcador del editor). */
export const encodeSpec = (c: ChartSpec) => b64(JSON.stringify(c)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export function decodeSpec(token: string): ChartSpec | null {
  try {
    const c = JSON.parse(unb64(token.replace(/-/g, "+").replace(/_/g, "/"))) as ChartSpec;
    return chartProblem(c) ? null : c;
  } catch {
    return null;
  }
}
/** SVG como `data:` URI: va dentro del HTML del artículo, sin depender del almacenamiento. */
export const svgDataUri = (svg: string) => `data:image/svg+xml;base64,${b64(svg)}`;
