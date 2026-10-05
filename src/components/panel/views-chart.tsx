import { cn } from "@/lib/utils";

// Formato de números de Colombia.
const nf = new Intl.NumberFormat("es-CO");

/** Mini-gráfica de barras (SVG, sin JS) para la tabla de artículos. */
export function ViewsSparkline({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(1, ...values);
  const w = 4;
  const gap = 2;
  const h = 22;
  const total = values.reduce((s, v) => s + v, 0);
  return (
    <svg
      width={values.length * (w + gap) - gap}
      height={h}
      viewBox={`0 0 ${values.length * (w + gap) - gap} ${h}`}
      role="img"
      aria-label={`${nf.format(total)} lecturas en los últimos ${values.length} días`}
      className={cn("block", className)}
    >
      {values.map((v, i) => {
        const bh = v === 0 ? 1 : Math.max(2, Math.round((v / max) * h));
        return (
          <rect
            key={i}
            x={i * (w + gap)}
            y={h - bh}
            width={w}
            height={bh}
            rx={1}
            fill={v === 0 ? "var(--border)" : "var(--accent)"}
            opacity={i === values.length - 1 ? 1 : 0.75}
          />
        );
      })}
    </svg>
  );
}

/** Gráfica diaria con ejes mínimos para la ficha de un artículo. */
export function ViewsBarChart({ days, values }: { days: string[]; values: number[] }) {
  const max = Math.max(1, ...values);
  // Formatea un día en español, en UTC.
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" }).format(
      new Date(`${iso}T00:00:00Z`),
    );
  return (
    <div>
      <div className="flex h-32 items-end gap-[3px]" role="img" aria-label="Lecturas por día">
        {values.map((v, i) => (
          <div
            key={days[i]}
            title={`${fmt(days[i])}: ${nf.format(v)} lecturas`}
            className="flex-1 rounded-t-sm transition-opacity hover:opacity-70"
            style={{
              height: `${v === 0 ? 1 : Math.max(3, (v / max) * 100)}%`,
              background: v === 0 ? "var(--border)" : "var(--accent)",
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-[var(--fg-muted)]">
        <span>{fmt(days[0])}</span>
        <span>Máx. {nf.format(max)} / día</span>
        <span>Hoy</span>
      </div>
    </div>
  );
}
