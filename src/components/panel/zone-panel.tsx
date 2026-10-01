"use client";

import { RotateCcw } from "lucide-react";
import type { ZoneStyle } from "@/db/schema";
import type { ZoneMapData, ZoneMapItem } from "@/lib/block-tools";

const PRESETS: Record<number, Array<[string, string]>> = {
  2: [
    ["1fr 1fr", "Iguales"],
    ["2fr 1fr", "Grande + pequeña"],
    ["1fr 2fr", "Pequeña + grande"],
    ["3fr 1fr", "Muy grande + estrecha"],
    ["1fr 3fr", "Estrecha + muy grande"],
  ],
  3: [
    ["1fr 1fr 1fr", "Iguales"],
    ["2fr 1fr 1fr", "Primera grande"],
    ["1fr 2fr 1fr", "Central grande"],
    ["1fr 1fr 2fr", "Última grande"],
  ],
};

/**
 * Mapa de la zona del bloque elegido: dibuja el contenedor y sus bloques tal
 * como están ahora (medidos en la página real) y deja decidir cómo se
 * acomodan: cuántas columnas, con qué proporciones y cuánto espacio entre
 * ellos. El cambio convierte esa zona en una cuadrícula, así que vale en
 * cualquier plantilla. Pulsar un bloque del mapa lo selecciona.
 */
export function ZonePanel({
  map,
  style,
  selectedSlug,
  onChange,
  onSelect,
}: {
  map: ZoneMapData | null;
  style: ZoneStyle | undefined;
  selectedSlug?: string | null;
  onChange: (z: ZoneStyle | undefined) => void;
  onSelect: (item: ZoneMapItem) => void;
}) {
  if (!map || !map.key) {
    return <p className="text-xs leading-relaxed text-[var(--fg-muted)]">Midiendo la zona de este bloque… (si no aparece, vuelve a pulsar el bloque).</p>;
  }
  const z = style ?? {};
  const cols = z.cols ?? (z.tpl ? z.tpl.split(" ").length : undefined);
  const fs = Math.max(10, map.w / 34);
  const patch = (p: Partial<ZoneStyle>) => {
    const merged = { ...z, ...p } as Record<string, unknown>;
    for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k];
    onChange(Object.keys(merged).length ? (merged as ZoneStyle) : undefined);
  };
  const preset = (cols && PRESETS[cols]) || null;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[#f4f6e8] p-2">
        <svg viewBox={`0 0 ${map.w} ${map.h}`} className="block w-full" role="img" aria-label="Mapa de la zona del bloque" style={{ maxHeight: 360 }}>
          <rect x={0} y={0} width={map.w} height={map.h} rx={fs * 0.4} fill="#ffffff" stroke="#9fb04a" strokeWidth={Math.max(1, map.w / 300)} strokeDasharray="6 4" />
          {map.items.map((it) => {
            const sel = !!selectedSlug && it.slug === selectedSlug;
            return (
              <g key={it.id} onClick={it.kind === "block" ? () => onSelect(it) : undefined} className={it.kind === "block" ? "cursor-pointer" : undefined}>
                <title>{it.label || (it.kind === "block" ? "Bloque" : "Texto de la zona")}</title>
                <rect
                  x={it.x}
                  y={it.y}
                  width={Math.max(it.w, 2)}
                  height={Math.max(it.h, 2)}
                  rx={fs * 0.3}
                  fill={it.kind === "block" ? (sel ? "#b9d35a" : "#d9e7a3") : "#eef0e0"}
                  stroke={sel ? "#556b2f" : "#8c9860"}
                  strokeWidth={sel ? Math.max(2, map.w / 160) : Math.max(1, map.w / 400)}
                />
                {it.kind === "block" && it.h > fs * 2 && (
                  <>
                    <text x={it.x + fs * 0.6} y={it.y + fs * 1.5} fontSize={fs * 1.1} fontWeight={800} fill="#33401a">
                      {it.index !== undefined ? it.index + 1 : "•"}
                    </text>
                    {it.h > fs * 4 && it.w > fs * 6 && (
                      <text x={it.x + fs * 0.6} y={it.y + fs * 3} fontSize={fs * 0.8} fill="#44522a">
                        {it.label.slice(0, Math.max(6, Math.floor(it.w / (fs * 0.55))))}
                      </text>
                    )}
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-[0.7rem] text-[var(--fg-muted)]">
        Ahora: {map.display.includes("grid") ? `cuadrícula de ${map.cols} columna${map.cols === 1 ? "" : "s"}` : "lista"} · {map.items.filter((i) => i.kind === "block").length} bloques. Pulsa un bloque del mapa para elegirlo.
      </p>

      <div>
        <p className="mb-1.5 text-xs font-semibold">Columnas de la zona</p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => onChange(undefined)} aria-pressed={!cols} className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${!cols ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--border)] bg-white"}`}>
            Auto
          </button>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button key={n} type="button" onClick={() => patch({ cols: n, tpl: undefined })} aria-pressed={cols === n} className={`size-8 rounded-md border text-xs font-semibold ${cols === n ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--border)] bg-white"}`}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {preset && (
        <div>
          <p className="mb-1.5 text-xs font-semibold">Proporciones</p>
          <div className="flex flex-wrap gap-1.5">
            {preset.map(([tpl, label]) => (
              <button
                key={tpl}
                type="button"
                onClick={() => patch({ tpl: tpl === preset[0][0] ? undefined : tpl, cols: tpl.split(" ").length })}
                aria-pressed={(z.tpl ?? preset[0][0]) === tpl}
                className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${(z.tpl ?? preset[0][0]) === tpl ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--border)] bg-white"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold">Espacio entre bloques</span>
          <span className="tabular-nums">{z.gap === undefined ? "Auto" : `${z.gap} px`}</span>
        </div>
        <input type="range" min={0} max={80} step={2} value={z.gap ?? 16} onChange={(e) => patch({ gap: Number(e.target.value) })} className="mt-1 w-full accent-[var(--accent)]" />
      </div>

      {style && (
        <button type="button" onClick={() => onChange(undefined)} className="inline-flex items-center gap-1.5 self-start rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:border-[var(--accent)] hover:text-[var(--accent)]">
          <RotateCcw size={12} /> Restablecer zona
        </button>
      )}
      <p className="text-[0.7rem] leading-snug text-[var(--fg-muted)]">En el móvil las zonas siempre se apilan en una sola columna.</p>
    </div>
  );
}
