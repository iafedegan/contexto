"use client";

import { RotateCcw } from "lucide-react";
import type { HomeStyle } from "@/db/schema";
import { GradientEditor } from "@/components/panel/gradient-editor";
import { ColorRow, FontSelect, Group } from "@/components/panel/region-editor";
import { ZonePanel } from "@/components/panel/zone-panel";
import type { ZoneStyle } from "@/db/schema";
import type { ZoneMapData, ZoneMapItem } from "@/lib/block-tools";

/**
 * Ajustes libres de un bloque (una nota en la página): tamaño, fondo (color o
 * degradado), texto (fuente, color, tamaño exacto en px, degradado), esquinas y
 * relleno. Funciona igual en todas las plantillas porque se aplica por CSS al
 * bloque real (ver blockStylesCss en src/lib/home-style.ts).
 */
export type ZoneBundle = {
  map: ZoneMapData | null;
  style: ZoneStyle | undefined;
  selectedSlug?: string | null;
  onChange: (z: ZoneStyle | undefined) => void;
  onSelect: (item: ZoneMapItem) => void;
  onMoveBlock?: (item: ZoneMapItem, cell: { col: number; row: number }) => void;
  level?: number;
  onLevel?: (n: number) => void;
};

export function BlockStyleEditor({
  title,
  style,
  onChange,
  onClear,
  zone,
  bare = false,
}: {
  title: string;
  style: HomeStyle;
  onChange: (p: Partial<HomeStyle>) => void;
  onClear: () => void;
  zone?: ZoneBundle;
  /** Sin marco ni título: va dentro de otro panel (p. ej. «Más ajustes» de una nota). */
  bare?: boolean;
}) {
  const numField = (label: string, value: number | undefined, min: number, max: number, key: keyof HomeStyle, hint?: string) => (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-xs text-[var(--fg-muted)]">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value ?? ""}
        placeholder="Automático"
        onChange={(e) => onChange({ [key]: e.target.value === "" ? undefined : Number(e.target.value) } as Partial<HomeStyle>)}
        className="w-28 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] px-2 py-1.5 text-sm tabular-nums"
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
        <span className="tabular-nums font-semibold">{value === undefined ? "Automático" : `${value} px`}</span>
      </div>
      <input type="range" min={min} max={max} value={value ?? 0} onChange={(e) => onChange({ [key]: Number(e.target.value) } as Partial<HomeStyle>)} className="mt-1 w-full accent-[var(--accent)]" />
    </div>
  );

  return (
    <div className={bare ? "flex flex-col gap-4" : "flex flex-col gap-4 rounded-[var(--radius)] border border-[var(--accent)] bg-white p-3"}>
      {!bare && (
        <div>
          <p className="lx-kicker text-[var(--accent)]">Nota seleccionada</p>
          <p className="truncate text-sm font-bold">{title}</p>
          <p className="mt-1 text-xs text-[var(--fg-muted)]">Arrastra la esquina inferior derecha de la nota en la página para agrandarla.</p>
        </div>
      )}
      {bare && <p className="text-xs text-[var(--fg-muted)]">También puedes arrastrar la esquina inferior derecha de la nota en la página para agrandarla.</p>}

      {zone && (
        <Group title="Dónde está en la cuadrícula">
          <ZonePanel map={zone.map} style={zone.style} selectedSlug={zone.selectedSlug} onChange={zone.onChange} onSelect={zone.onSelect} onMoveBlock={zone.onMoveBlock} level={zone.level} onLevel={zone.onLevel} />
        </Group>
      )}

      <Group title="Tamaño y posición">
        {numField("Columnas (1–6)", style.colSpan, 1, 6, "colSpan", "solo en cuadrículas")}
        {numField("Columna (inicio)", style.colStart, 1, 6, "colStart", "en cuadrículas")}
        {numField("Fila (inicio)", style.rowStart, 1, 12, "rowStart")}
        {numField("Ancho (%)", style.widthPct, 20, 100, "widthPct", "en listas")}
        <div className="flex items-center gap-2">
          <span className="w-28 shrink-0 text-xs text-[var(--fg-muted)]">Alinear bloque</span>
          <select
            value={style.blockAlign ?? ""}
            onChange={(e) => onChange({ blockAlign: (e.target.value || undefined) as HomeStyle["blockAlign"] })}
            className="min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] px-2 py-1.5 text-sm"
          >
            <option value="">Izquierda</option>
            <option value="center">Centro</option>
            <option value="right">Derecha</option>
          </select>
        </div>
        <p className="text-[0.7rem] leading-snug text-[var(--fg-muted)]">
          «Columnas» solo cambia algo si el bloque está en una cuadrícula (p. ej. «Lo más reciente»). En una lista de una sola columna, como esta, el bloque ya ocupa todo el ancho: úsalo para hacerlo más estrecho con «Ancho (%)».
        </p>
        {numField("Alto mínimo (px)", style.height, 60, 1200, "height")}
      </Group>

      <Group title="Fondo">
        <ColorRow label="Color de fondo" value={style.bg} onChange={(bg) => onChange({ bg })} />
        <GradientEditor label="Degradado de fondo" value={style.bgGradient} defaults={{ from: "#33401a", to: "#c8dc6c", angle: 135 }} onChange={(bgGradient) => onChange({ bgGradient })} />
      </Group>

      <Group title="Texto">
        <FontSelect label="Fuente del texto" value={style.textFont} onChange={(textFont) => onChange({ textFont })} />
        <ColorRow label="Color del texto" value={style.fg} onChange={(fg) => onChange({ fg })} />
        {numField("Titular (tamaño exacto, px)", style.titlePx, 10, 160, "titlePx", "ej. 24")}
        <GradientEditor label="Degradado de color en el titular" value={style.titleGradient} defaults={{ from: "#f4e3a1", to: "#b8892b", angle: 90 }} onChange={(titleGradient) => onChange({ titleGradient })} />
      </Group>

      <Group title="Forma">
        {slider("Esquinas redondeadas", style.radius, 0, 60, "radius")}
        {slider("Relleno interior", style.pad, 0, 80, "pad")}
      </Group>

      <button type="button" onClick={onClear} className="inline-flex items-center gap-1.5 self-start rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:border-[var(--accent)] hover:text-[var(--accent)]">
        <RotateCcw size={12} /> Quitar estos ajustes de la nota
      </button>
    </div>
  );
}
