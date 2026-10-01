"use client";

import { RotateCcw } from "lucide-react";
import type { HomeLayoutConfig, SectionElId, SectionElStyle } from "@/db/schema";
import { GradientEditor } from "@/components/panel/gradient-editor";
import { ColorRow, FontSelect, Group, RegionEditor } from "@/components/panel/region-editor";
import { SectionFiltersPicker } from "@/components/panel/section-filters-picker";
import { EL_RANGES, SECTION_ELS, WEIGHTS } from "@/lib/section-els";
import type { RegionId } from "@/lib/home-regions";

type Layout = Required<HomeLayoutConfig>;

/**
 * Panel de una página de sección: dos piezas, «Encabezado» (lo de arriba:
 * migas, etiqueta, título, descripción, datos y filtros, cada uno por
 * separado) y «Cuerpo» (la zona de las notas). La barra y el pie se editan en
 * la vista de portada, no aquí.
 */
export function SectionPanel({
  layout,
  onChange,
  region,
  onRegion,
  el,
  onEl,
}: {
  layout: Layout;
  onChange: (partial: Partial<Layout>) => void;
  region: RegionId;
  onRegion: (r: RegionId) => void;
  el: SectionElId;
  onEl: (e: SectionElId) => void;
}) {
  const tab: "encabezado" | "body" = region === "encabezado" ? "encabezado" : "body";
  const els = layout.sectionEls ?? {};
  const style: SectionElStyle = els[el] ?? {};
  const meta = SECTION_ELS.find((x) => x.id === el)!;

  function patchEl(p: Partial<SectionElStyle>) {
    const merged = { ...style, ...p } as Record<string, unknown>;
    for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k];
    const next = { ...els };
    if (Object.keys(merged).length) next[el] = merged as SectionElStyle;
    else delete next[el];
    onChange({ sectionEls: next });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-[var(--border)] p-1">
        {(
          [
            ["encabezado", "Encabezado"],
            ["body", "Cuerpo"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onRegion(id)}
            aria-pressed={tab === id}
            className={`rounded-md px-1 py-1.5 text-xs font-semibold transition ${tab === id ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "encabezado" ? (
        <>
          <div>
            <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">Elige una pieza (o púlsala en la página)</p>
            <div className="flex flex-wrap gap-1.5">
              {SECTION_ELS.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  title={x.hint}
                  onClick={() => onEl(x.id)}
                  aria-pressed={el === x.id}
                  className={`relative rounded-full border px-3 py-1 text-xs font-semibold transition ${el === x.id ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--border)] bg-white hover:border-[var(--accent)]"}`}
                >
                  {x.label}
                  {els[x.id] && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[#c9a227]" aria-label="modificado" />}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-[var(--fg-muted)]">{meta.hint}</p>
          </div>

          <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-white p-3">
            <FontSelect label="Fuente" value={style.font} onChange={(font) => patchEl({ font })} />

            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs text-[var(--fg-muted)]">Tamaño (px)</span>
              <input
                type="number"
                min={EL_RANGES.size.min}
                max={EL_RANGES.size.max}
                step={1}
                value={style.size ?? ""}
                placeholder="Auto"
                onChange={(e) => patchEl({ size: e.target.value === "" ? undefined : Number(e.target.value) })}
                className="w-24 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] px-2 py-1.5 text-sm tabular-nums"
              />
              <span className="text-xs text-[var(--fg-muted)]">ej. 12</span>
              {style.size !== undefined && (
                <button type="button" onClick={() => patchEl({ size: undefined })} className="ml-auto text-[var(--fg-muted)] hover:text-[var(--accent)]" aria-label="Tamaño automático">
                  <RotateCcw size={12} />
                </button>
              )}
            </div>
            <input
              type="range"
              min={EL_RANGES.size.min}
              max={Math.min(EL_RANGES.size.max, 160)}
              value={style.size ?? 16}
              onChange={(e) => patchEl({ size: Number(e.target.value) })}
              aria-label="Tamaño en píxeles"
              className="w-full accent-[var(--accent)]"
            />

            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs text-[var(--fg-muted)]">Grosor</span>
              <select
                value={style.weight ?? ""}
                onChange={(e) => patchEl({ weight: e.target.value ? Number(e.target.value) : undefined })}
                className="min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] px-2 py-1.5 text-sm"
              >
                <option value="">Auto</option>
                {WEIGHTS.map((w) => (
                  <option key={w} value={w}>
                    {w} {w <= 300 ? "· fino" : w === 400 ? "· normal" : w >= 700 ? "· negrita" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs text-[var(--fg-muted)]">Mayúsculas</span>
              <select
                value={style.upper === undefined ? "" : style.upper ? "si" : "no"}
                onChange={(e) => patchEl({ upper: e.target.value === "" ? undefined : e.target.value === "si" })}
                className="min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] px-2 py-1.5 text-sm"
              >
                <option value="">Auto</option>
                <option value="si">TODO EN MAYÚSCULAS</option>
                <option value="no">Normal</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--fg-muted)]">Espacio entre letras</span>
                <span className="tabular-nums font-semibold">{style.tracking === undefined ? "Auto" : `${style.tracking} px`}</span>
              </div>
              <input
                type="range"
                min={EL_RANGES.tracking.min}
                max={EL_RANGES.tracking.max}
                step={0.5}
                value={style.tracking ?? 0}
                onChange={(e) => patchEl({ tracking: Number(e.target.value) })}
                className="mt-1 w-full accent-[var(--accent)]"
              />
            </div>

            {meta.gradient && (
              <GradientEditor
                label="Degradado en el texto"
                value={style.gradient}
                defaults={{ from: "#f4e3a1", to: "#b8892b", angle: 90 }}
                onChange={(gradient) => patchEl({ gradient, ...(gradient ? { color: undefined } : {}) })}
              />
            )}
            {!style.gradient && <ColorRow label="Color" value={style.color} onChange={(color) => patchEl({ color })} />}

            {els[el] && (
              <button type="button" onClick={() => onChange({ sectionEls: Object.fromEntries(Object.entries(els).filter(([k]) => k !== el)) })} className="inline-flex items-center gap-1.5 self-start rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:border-[var(--accent)] hover:text-[var(--accent)]">
                <RotateCcw size={12} /> Restablecer {meta.label.toLowerCase()}
              </button>
            )}
          </div>

          <Group title="Fondo y espacio del encabezado">
            <RegionEditor value={layout.regions ?? {}} active="encabezado" onActive={onRegion} onChange={(regions) => onChange({ regions })} only={["encabezado"]} hideTabs />
          </Group>

          {el === "filters" && (
            <div className="border-t border-[var(--border)] pt-3">
              <SectionFiltersPicker value={layout.sectionFilters ?? "cabecera"} onChange={(sectionFilters) => onChange({ sectionFilters })} />
            </div>
          )}
        </>
      ) : (
        <RegionEditor value={layout.regions ?? {}} active="body" onActive={onRegion} onChange={(regions) => onChange({ regions })} only={["body"]} hideTabs />
      )}
    </div>
  );
}
