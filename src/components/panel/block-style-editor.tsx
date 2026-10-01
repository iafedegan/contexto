"use client";

import { RotateCcw } from "lucide-react";
import type { HomeStyle } from "@/db/schema";
import { GradientEditor } from "@/components/panel/gradient-editor";
import { ColorRow, FontSelect, Group } from "@/components/panel/region-editor";

/**
 * Ajustes libres de un bloque (una nota en la página): tamaño, fondo (color o
 * degradado), texto (fuente, color, tamaño exacto en px, degradado), esquinas y
 * relleno. Funciona igual en todas las plantillas porque se aplica por CSS al
 * bloque real (ver blockStylesCss en src/lib/home-style.ts).
 */
export function BlockStyleEditor({
  title,
  style,
  onChange,
  onClear,
}: {
  title: string;
  style: HomeStyle;
  onChange: (p: Partial<HomeStyle>) => void;
  onClear: () => void;
}) {
  const numField = (label: string, value: number | undefined, min: number, max: number, key: keyof HomeStyle, hint?: string) => (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-xs text-[var(--fg-muted)]">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value ?? ""}
        placeholder="Auto"
        onChange={(e) => onChange({ [key]: e.target.value === "" ? undefined : Number(e.target.value) } as Partial<HomeStyle>)}
        className="w-24 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] px-2 py-1.5 text-sm tabular-nums"
      />
      {hint && <span className="text-xs text-[var(--fg-muted)]">{hint}</span>}
      {value !== undefined && (
        <button type="button" onClick={() => onChange({ [key]: undefined } as Partial<HomeStyle>)} className="ml-auto text-[var(--fg-muted)] hover:text-[var(--accent)]" aria-label={`${label}: automático`}>
          <RotateCcw size={12} />
        </button>
      )}
    </div>
  );
  const slider = (label: string, value: number | undefined, min: number, max: number, key: keyof HomeStyle) => (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--fg-muted)]">{label}</span>
        <span className="tabular-nums font-semibold">{value === undefined ? "Auto" : `${value} px`}</span>
      </div>
      <input type="range" min={min} max={max} value={value ?? 0} onChange={(e) => onChange({ [key]: Number(e.target.value) } as Partial<HomeStyle>)} className="mt-1 w-full accent-[var(--accent)]" />
    </div>
  );

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius)] border border-[var(--accent)] bg-white p-3">
      <div>
        <p className="lx-kicker text-[var(--accent)]">Bloque seleccionado</p>
        <p className="truncate text-sm font-bold">{title}</p>
        <p className="mt-1 text-xs text-[var(--fg-muted)]">Arrastra la esquina inferior derecha del bloque en la página para agrandarlo.</p>
      </div>

      <Group title="Tamaño">
        {numField("Columnas (1–6)", style.colSpan, 1, 6, "colSpan", "en cuadrículas")}
        {numField("Alto mínimo (px)", style.height, 60, 1200, "height")}
      </Group>

      <Group title="Fondo">
        <ColorRow label="Color" value={style.bg} onChange={(bg) => onChange({ bg })} />
        <GradientEditor label="Degradado de fondo" value={style.bgGradient} defaults={{ from: "#33401a", to: "#c8dc6c", angle: 135 }} onChange={(bgGradient) => onChange({ bgGradient })} />
      </Group>

      <Group title="Texto">
        <FontSelect label="Fuente del texto" value={style.textFont} onChange={(textFont) => onChange({ textFont })} />
        <ColorRow label="Color" value={style.fg} onChange={(fg) => onChange({ fg })} />
        {numField("Titular (px)", style.titlePx, 10, 160, "titlePx", "ej. 24")}
        <GradientEditor label="Degradado en el titular" value={style.titleGradient} defaults={{ from: "#f4e3a1", to: "#b8892b", angle: 90 }} onChange={(titleGradient) => onChange({ titleGradient })} />
      </Group>

      <Group title="Forma">
        {slider("Esquinas redondeadas", style.radius, 0, 60, "radius")}
        {slider("Relleno interior", style.pad, 0, 80, "pad")}
      </Group>

      <button type="button" onClick={onClear} className="inline-flex items-center gap-1.5 self-start rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:border-[var(--accent)] hover:text-[var(--accent)]">
        <RotateCcw size={12} /> Restablecer bloque
      </button>
    </div>
  );
}
