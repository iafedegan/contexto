/**
 * Gráficas como SVG estático, dibujadas en el servidor a partir de datos ya
 * validados. Todo texto se escapa: el SVG se sirve como imagen (<img>), donde
 * no ejecuta nada, y aun así no hereda ninguna cadena sin escapar.
 */

export type ChartSpec = {
  type: "bar" | "line" | "pie";
  title: string;
  unit: string;
  labels: string[];
  series: { name: string; values: number[] }[];
};

const W = 760;
const H = 420;
const PALETTE = ["#b4622e", "#2f6b3f", "#1d4ed8", "#7b1e2b", "#b45309", "#0f766e"];
const FONT = "Inter, Helvetica, Arial, sans-serif";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const fmt = (n: number) =>
  Math.abs(n) >= 1000 ? n.toLocaleString("es-CO", { maximumFractionDigits: 0 }) : String(Math.round(n * 100) / 100);

/** Valida la forma de los datos. Devuelve el motivo si no sirve. */
export function chartProblem(c: ChartSpec): string | null {
  if (!c.labels.length || c.labels.length < 2 || c.labels.length > 12) return "La gráfica necesita entre 2 y 12 puntos.";
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

export function renderChartSvg(c: ChartSpec): string {
  const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(c.title)}" font-family="${FONT}"><rect width="${W}" height="${H}" fill="#ffffff"/><text x="24" y="34" font-size="18" font-weight="700" fill="#141210">${esc(c.title.slice(0, 90))}</text>${c.unit ? `<text x="24" y="54" font-size="12" fill="#6b645b">${esc(c.unit)}</text>` : ""}`;
  return `${head}${c.type === "pie" ? pie(c) : cartesian(c)}</svg>`;
}

function legend(c: ChartSpec, y: number) {
  if (c.series.length < 2) return "";
  return c.series
    .map((s, i) => `<rect x="${24 + i * 150}" y="${y}" width="10" height="10" rx="2" fill="${PALETTE[i % PALETTE.length]}"/><text x="${40 + i * 150}" y="${y + 9}" font-size="12" fill="#141210">${esc(s.name.slice(0, 18))}</text>`)
    .join("");
}

function cartesian(c: ChartSpec) {
  const left = 64, right = 24, top = c.series.length > 1 ? 96 : 76, bottom = 64;
  const pw = W - left - right, ph = H - top - bottom;
  const all = c.series.flatMap((s) => s.values);
  const max = Math.max(0, ...all), min = Math.min(0, ...all);
  const span = max - min || 1;
  const y = (v: number) => top + ph - ((v - min) / span) * ph;
  const n = c.labels.length;
  const step = pw / n;

  let out = legend(c, 62);
  for (let i = 0; i <= 4; i++) {
    const v = min + (span * i) / 4;
    const yy = y(v);
    out += `<line x1="${left}" y1="${yy}" x2="${W - right}" y2="${yy}" stroke="#e6e1d8"/><text x="${left - 8}" y="${yy + 4}" font-size="11" text-anchor="end" fill="#6b645b">${esc(fmt(v))}</text>`;
  }
  out += c.labels
    .map((l, i) => `<text x="${left + step * i + step / 2}" y="${H - 38}" font-size="11" text-anchor="middle" fill="#141210">${esc(l.slice(0, 14))}</text>`)
    .join("");

  if (c.type === "bar") {
    const bw = Math.min(46, (step * 0.7) / c.series.length);
    c.series.forEach((s, si) =>
      s.values.forEach((v, i) => {
        const x = left + step * i + step / 2 - (bw * c.series.length) / 2 + bw * si;
        const y0 = y(Math.max(v, 0)), h = Math.abs(y(v) - y(0));
        out += `<rect x="${x}" y="${y0}" width="${bw - 2}" height="${Math.max(h, 1)}" rx="2" fill="${PALETTE[si % PALETTE.length]}"/>`;
        if (c.series.length === 1) out += `<text x="${x + bw / 2 - 1}" y="${y0 - 6}" font-size="11" text-anchor="middle" fill="#141210">${esc(fmt(v))}</text>`;
      }),
    );
  } else {
    c.series.forEach((s, si) => {
      const pts = s.values.map((v, i) => `${left + step * i + step / 2},${y(v)}`);
      out += `<polyline points="${pts.join(" ")}" fill="none" stroke="${PALETTE[si % PALETTE.length]}" stroke-width="3" stroke-linejoin="round"/>`;
      s.values.forEach((v, i) => {
        out += `<circle cx="${left + step * i + step / 2}" cy="${y(v)}" r="4" fill="${PALETTE[si % PALETTE.length]}"/>`;
        if (c.series.length === 1) out += `<text x="${left + step * i + step / 2}" y="${y(v) - 10}" font-size="11" text-anchor="middle" fill="#141210">${esc(fmt(v))}</text>`;
      });
    });
  }
  return out;
}

function pie(c: ChartSpec) {
  const vals = c.series[0].values;
  const total = vals.reduce((a, b) => a + b, 0) || 1;
  const cx = 230, cy = 240, r = 130;
  let a0 = -Math.PI / 2;
  let out = "";
  vals.forEach((v, i) => {
    const a1 = a0 + (v / total) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a: number) => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    out += v / total >= 0.9999
      ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${PALETTE[i % PALETTE.length]}"/>`
      : `<path d="M${cx},${cy} L${p(a0)} A${r},${r} 0 ${large} 1 ${p(a1)} Z" fill="${PALETTE[i % PALETTE.length]}" stroke="#fff" stroke-width="2"/>`;
    a0 = a1;
  });
  c.labels.forEach((l, i) => {
    const yy = 110 + i * 24;
    out += `<rect x="440" y="${yy - 10}" width="12" height="12" rx="2" fill="${PALETTE[i % PALETTE.length]}"/><text x="460" y="${yy}" font-size="13" fill="#141210">${esc(l.slice(0, 26))} — ${esc(fmt(vals[i]))} (${Math.round((vals[i] / total) * 100)} %)</text>`;
  });
  return out;
}
