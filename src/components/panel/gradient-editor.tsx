"use client";

import type { Gradient } from "@/db/schema";
import { gradientCss } from "@/lib/section-els";

/** Editor de degradado: activar, dos colores y ángulo, con vista previa. */
export function GradientEditor({
  label,
  value,
  onChange,
  defaults = { from: "#33401a", to: "#c8dc6c", angle: 135 },
}: {
  label: string;
  value: Gradient | undefined;
  onChange: (g: Gradient | undefined) => void;
  defaults?: Gradient;
}) {
  const g = value ?? defaults;
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked ? defaults : undefined)} />
        <span className="font-semibold">{label}</span>
      </label>
      {value && (
        <>
          <div className="h-5 w-full rounded-md border border-[var(--border)]" style={{ background: gradientCss(value) }} aria-hidden />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[var(--fg-muted)]">De</span>
            <input type="color" value={g.from} onChange={(e) => onChange({ ...g, from: e.target.value })} aria-label={`${label}: color inicial`} className="size-7 cursor-pointer rounded border border-[var(--border)] p-0.5" />
            <span className="text-[var(--fg-muted)]">a</span>
            <input type="color" value={g.to} onChange={(e) => onChange({ ...g, to: e.target.value })} aria-label={`${label}: color final`} className="size-7 cursor-pointer rounded border border-[var(--border)] p-0.5" />
            <span className="ml-auto tabular-nums font-semibold">{g.angle}°</span>
          </div>
          <input type="range" min={0} max={360} step={5} value={g.angle} onChange={(e) => onChange({ ...g, angle: Number(e.target.value) })} aria-label={`${label}: ángulo`} className="w-full accent-[var(--accent)]" />
        </>
      )}
    </div>
  );
}
