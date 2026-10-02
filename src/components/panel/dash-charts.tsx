import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("es-CO");

/** Gráfica de área suavizada (SVG puro, sin JS): línea, relleno degradado, rejilla y etiquetas de día. */
export function AreaChart({ labels, values, className }: { labels: string[]; values: number[]; className?: string }) {
  const W = 640;
  const H = 220;
  const padL = 34;
  const padB = 28;
  const padT = 14;
  const max = Math.max(4, ...values);
  const top = Math.ceil(max / 4) * 4;
  const innerW = W - padL - 8;
  const innerH = H - padB - padT;
  const x = (i: number) => padL + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / top) * innerH;
  const pts = values.map((v, i) => [x(i), y(v)] as const);
  // Curva Catmull-Rom → Bézier para un trazo suave.
  const path = pts.reduce((d, p, i, a) => {
    if (i === 0) return `M${p[0]},${p[1]}`;
    const p0 = a[i - 2] ?? a[i - 1];
    const p1 = a[i - 1];
    const p2 = p;
    const p3 = a[i + 1] ?? p;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    return `${d} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }, "");
  const area = `${path} L${x(values.length - 1)},${padT + innerH} L${x(0)},${padT + innerH} Z`;
  const ticks = [0, 1, 2, 3, 4].map((k) => (top / 4) * k);
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Lecturas diarias: ${values.map((v) => nf.format(v)).join(", ")}`} className={cn("block h-auto w-full", className)}>
      <defs>
        <linearGradient id="dash-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.38" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - 8} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray={t === 0 ? undefined : "3 5"} />
          <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--fg-muted)">{nf.format(Math.round(t))}</text>
        </g>
      ))}
      <path d={area} fill="url(#dash-area)" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 5 : 3} fill="var(--bg)" stroke="var(--accent)" strokeWidth="2.5" />
      ))}
      {last && <circle cx={last[0]} cy={last[1]} r="11" fill="var(--accent)" opacity="0.15" />}
      {labels.map((l, i) => (
        <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--fg-muted)">{l}</text>
      ))}
    </svg>
  );
}

/** Anillo de reparto (SVG puro) con el total al centro. */
export function Donut({ parts, total, label }: { parts: { label: string; value: number; color: string }[]; total: number; label: string }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <svg viewBox="0 0 140 140" role="img" aria-label={`${label}: ${total}`} className="mx-auto block size-40 max-w-full">
      <circle cx="70" cy="70" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="16" />
      {total > 0 &&
        parts.filter((p) => p.value > 0).map((p) => {
          const len = (p.value / total) * C;
          const el = (
            <circle key={p.label} cx="70" cy="70" r={R} fill="none" stroke={p.color} strokeWidth="16" strokeDasharray={`${Math.max(len - 3, 0.5)} ${C}`} strokeDashoffset={-acc} transform="rotate(-90 70 70)" strokeLinecap="round" />
          );
          acc += len;
          return el;
        })}
      <text x="70" y="68" textAnchor="middle" fontSize="28" fontWeight="700" fill="var(--fg)">{total}</text>
      <text x="70" y="86" textAnchor="middle" fontSize="10" letterSpacing="1.5" fill="var(--fg-muted)">{label.toUpperCase()}</text>
    </svg>
  );
}
