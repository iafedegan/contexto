"use client";

import { useRef, useState } from "react";
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
  onMoveBlock,
  level = 0,
  onLevel,
}: {
  map: ZoneMapData | null;
  style: ZoneStyle | undefined;
  selectedSlug?: string | null;
  onChange: (z: ZoneStyle | undefined) => void;
  onSelect: (item: ZoneMapItem) => void;
  /** Se suelta un bloque en otra celda del mapa (columna y fila empiezan en 1). */
  onMoveBlock?: (item: ZoneMapItem, cell: { col: number; row: number }) => void;
  /** Nivel de la zona: 0 = el contenedor del bloque; más = contenedores superiores. */
  level?: number;
  onLevel?: (n: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number; col: number; row: number } | null>(null);
  if (!map || !map.key) {
    return <p className="text-xs leading-relaxed text-[var(--fg-muted)]">Midiendo la zona de este bloque… (si no aparece, vuelve a pulsar el bloque).</p>;
  }
  const z = style ?? {};

  // Pistas de la cuadrícula: posición de cada columna y fila (para encajar al soltar).
  const track = (sizes: number[], gap: number) => {
    let at = 0;
    return sizes.map((w) => {
      const t = { start: at, size: w };
      at += w + gap;
      return t;
    });
  };
  const colT = track(map.colTracks, map.colGap);
  const rowT = track(map.rowTracks, map.rowGap);
  const canDrag = map.display.includes("grid") && colT.length > 0 && !!onMoveBlock;
  const cellAt = (arr: { start: number; size: number }[], v: number, gap: number) => {
    if (!arr.length) return 0;
    for (let i = 0; i < arr.length; i++) if (v < arr[i].start + arr[i].size + gap / 2) return i;
    return arr.length; // por debajo de la última: una fila nueva
  };
  const toSvg = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };
  function startDrag(e: React.PointerEvent, it: ZoneMapItem) {
    if (!canDrag) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const start = toSvg(e);
    let moved = false;
    const move = (ev: PointerEvent) => {
      const p = toSvg(ev as unknown as React.PointerEvent);
      const dx = p.x - start.x, dy = p.y - start.y;
      if (Math.abs(dx) + Math.abs(dy) > map!.w / 120) moved = true;
      const cx = it.x + it.w / 2 + dx, cy = it.y + it.h / 2 + dy;
      setDrag({ id: it.id, dx, dy, col: cellAt(colT, cx - it.w / 2, map!.colGap), row: cellAt(rowT, cy - it.h / 2, map!.rowGap) });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const p = toSvg(ev as unknown as React.PointerEvent);
      const dx = p.x - start.x, dy = p.y - start.y;
      setDrag(null);
      if (!moved) return onSelect(it);
      const col = cellAt(colT, it.x + dx, map!.colGap);
      const row = cellAt(rowT, it.y + dy, map!.rowGap);
      onMoveBlock?.(it, { col: Math.min(col, colT.length - 1) + 1, row: row + 1 });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
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
        <svg ref={svgRef} viewBox={`0 0 ${map.w} ${map.h}`} className="block w-full touch-none select-none" role="img" aria-label="Mapa de la zona del bloque" style={{ maxHeight: 360 }}>
          <rect x={0} y={0} width={map.w} height={map.h} rx={fs * 0.4} fill="#ffffff" stroke="#9fb04a" strokeWidth={Math.max(1, map.w / 300)} strokeDasharray="6 4" />
          {canDrag &&
            (rowT.length ? rowT : [{ start: 0, size: map.h }]).map((r, ri) =>
              colT.map((c, ci) => {
                const occupied = map.items.some((it) => it.kind === "block" && it.x < c.start + c.size - 2 && it.x + it.w > c.start + 2 && it.y < r.start + r.size - 2 && it.y + it.h > r.start + 2);
                return (
                  <g key={`cell${ri}-${ci}`}>
                    <rect x={c.start} y={r.start} width={c.size} height={r.size} rx={fs * 0.3} fill={occupied ? "none" : "#f5f8e3"} stroke="#c9d49a" strokeWidth={Math.max(1, map.w / 450)} strokeDasharray="5 4" />
                    {!occupied && (
                      <text x={c.start + c.size / 2} y={r.start + r.size / 2} fontSize={fs * 0.85} textAnchor="middle" fill="#8c9860">
                        {`Columna ${ci + 1}${rowT.length > 1 ? ` · fila ${ri + 1}` : ""} · libre`}
                      </text>
                    )}
                  </g>
                );
              }),
            )}
          {drag && canDrag && (() => {
            const it = map.items.find((x) => x.id === drag.id);
            if (!it) return null;
            const c = colT[Math.min(drag.col, colT.length - 1)];
            const r = rowT[drag.row];
            const gy = r ? r.start : (rowT.length ? rowT[rowT.length - 1].start + rowT[rowT.length - 1].size + map.rowGap : 0);
            return <rect x={c.start} y={gy} width={Math.min(it.w, map.w - c.start)} height={it.h} rx={fs * 0.3} fill="#c9a22733" stroke="#c9a227" strokeWidth={Math.max(2, map.w / 200)} strokeDasharray="6 4" />;
          })()}
          {map.items.map((it) => {
            const sel = !!selectedSlug && it.slug === selectedSlug;
            const dragging = drag?.id === it.id;
            return (
              <g
                key={it.id}
                onClick={it.kind === "block" && !canDrag ? () => onSelect(it) : undefined}
                onPointerDown={it.kind === "block" ? (e) => startDrag(e, it) : undefined}
                transform={dragging ? `translate(${drag!.dx} ${drag!.dy})` : undefined}
                opacity={dragging ? 0.85 : 1}
                className={it.kind === "block" ? (canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer") : undefined}
              >
                <title>{it.label || (it.kind === "block" ? "Bloque" : "Texto de la zona")}</title>
                <rect
                  x={it.x}
                  y={it.y}
                  width={Math.max(it.w, 2)}
                  height={Math.max(it.h, 2)}
                  rx={fs * 0.3}
                  fill={it.kind === "block" ? (sel ? "#b9d35a" : "#d9e7a3") : it.kind === "group" ? "none" : "#eef0e0"}
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
        {canDrag ? "Arrastra un bloque a otra celda para moverlo. " : "Para mover bloques en el mapa, la zona debe ser una cuadrícula (elige columnas abajo). "}Ahora: {map.display.includes("grid") ? `cuadrícula de ${map.cols} columna${map.cols === 1 ? "" : "s"}` : "lista"} · {map.items.filter((i) => i.kind === "block").length} bloques. Pulsa un bloque del mapa para elegirlo.
      </p>

      {onLevel && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold">Zona:</span>
          <button type="button" onClick={() => onLevel(Math.max(0, level - 1))} disabled={level === 0} className="rounded-md border border-[var(--border)] bg-white px-2.5 py-1 text-xs font-semibold disabled:opacity-40">
            ↓ Más interna
          </button>
          <button type="button" onClick={() => onLevel(level + 1)} disabled={!map.canGoUp || level >= 3} className="rounded-md border border-[var(--border)] bg-white px-2.5 py-1 text-xs font-semibold disabled:opacity-40">
            ↑ Zona superior
          </button>
          <span className="text-[0.7rem] text-[var(--fg-muted)]">nivel {level + 1}</span>
        </div>
      )}

      {(map.items.some((i) => i.kind === "group") || z.flat) && (
        <label className="flex items-start gap-2 rounded-[var(--radius)] bg-[var(--surface-2)] p-2 text-xs">
          <input type="checkbox" checked={!!z.flat} onChange={(e) => patch({ flat: e.target.checked || undefined })} className="mt-0.5" />
          <span>
            <strong>Colocar aquí los bloques de los grupos internos.</strong> Cada nota pasa a ser una celda de esta cuadrícula y la puedes arrastrar a cualquier columna.
          </span>
        </label>
      )}

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
