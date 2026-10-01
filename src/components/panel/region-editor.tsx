"use client";

import { AlignCenter, AlignLeft, AlignRight, EyeOff, RotateCcw } from "lucide-react";
import { HOME_FONT_GROUPS, HOME_FONTS, type HomeTitleFont } from "@/lib/home-fonts";
import {
  RANGES,
  REGIONS,
  type RegionId,
  type RegionStyle,
  type RegionStyles,
} from "@/lib/home-regions";

const SWATCHES = ["#ffffff", "#f7f4ee", "#141210", "#0d2318", "#1a1430", "#7b1e2b", "#b45309", "#1d4ed8"];

/**
 * Editor por componente de la plantilla: se elige Navbar, Hero, Tarjetas,
 * Cuerpo o Footer y se ajustan color, tipografía, tamaños y dimensiones.
 * Solo muestra los controles que tienen sentido para cada componente.
 */
export function RegionEditor({
  value,
  active,
  onActive,
  onChange,
  only,
}: {
  value: RegionStyles;
  active: RegionId;
  onActive: (id: RegionId) => void;
  onChange: (next: RegionStyles) => void;
  /** Limita los componentes editables (p. ej. en las secciones no hay Hero ni Tarjetas). */
  only?: RegionId[];
}) {
  const visibles = REGIONS.filter((r) => !only || only.includes(r.id));
  const meta = REGIONS.find((r) => r.id === active)!;
  const s: RegionStyle = value[active] ?? {};
  const has = (k: keyof RegionStyle) => meta.controls.includes(k);

  function patch(p: Partial<RegionStyle>) {
    const merged = { ...s, ...p };
    for (const k of Object.keys(merged) as (keyof RegionStyle)[]) {
      if (merged[k] === undefined) delete merged[k];
    }
    const next = { ...value };
    if (Object.keys(merged).length) next[active] = merged;
    else delete next[active];
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Selector de componente */}
      <div className={`grid gap-1 rounded-lg border border-[var(--border)] p-1 ${visibles.length === 3 ? "grid-cols-3" : "grid-cols-5"}`}>
        {visibles.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onActive(r.id)}
            aria-pressed={active === r.id}
            className={`relative rounded-md px-1 py-1.5 text-[0.7rem] font-semibold transition ${
              active === r.id
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
            }`}
          >
            {r.label}
            {value[r.id] && (
              <span className="absolute right-1 top-1 size-1.5 rounded-full bg-current" aria-label="modificado" />
            )}
          </button>
        ))}
      </div>
      <p className="-mt-2 text-xs leading-snug text-[var(--fg-muted)]">{meta.description}</p>

      {has("hidden") && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!s.hidden} onChange={(e) => patch({ hidden: e.target.checked || undefined })} />
          <EyeOff size={14} /> Ocultar {meta.label.toLowerCase()}
        </label>
      )}

      {!s.hidden && (
        <>
          <Group title="Colores">
            {has("bg") && <ColorRow label="Fondo" value={s.bg} onChange={(bg) => patch({ bg })} />}
            {has("fg") && <ColorRow label="Texto" value={s.fg} onChange={(fg) => patch({ fg })} />}
            {has("accent") && <ColorRow label="Acento" value={s.accent} onChange={(accent) => patch({ accent })} />}
          </Group>

          <Group title="Tipografía">
            {has("titleFont") && (
              <FontSelect label="Titulares" value={s.titleFont} onChange={(titleFont) => patch({ titleFont })} />
            )}
            {has("textFont") && (
              <FontSelect label="Texto y menús" value={s.textFont} onChange={(textFont) => patch({ textFont })} />
            )}
            {has("titleScale") && (
              <Slider label="Tamaño de titulares" k="titleScale" value={s.titleScale} def={100} onChange={(titleScale) => patch({ titleScale })} />
            )}
            {has("textScale") && (
              <Slider label="Tamaño del texto" k="textScale" value={s.textScale} def={100} onChange={(textScale) => patch({ textScale })} />
            )}
          </Group>

          <Group title="Dimensiones y disposición">
            {has("padTop") && <Slider label="Espacio superior (bajo la barra)" k="padTop" value={s.padTop} onChange={(padTop) => patch({ padTop })} />}
            {has("padY") && <Slider label="Relleno vertical" k="padY" value={s.padY} onChange={(padY) => patch({ padY })} />}
            {has("padX") && <Slider label="Relleno horizontal" k="padX" value={s.padX} onChange={(padX) => patch({ padX })} />}
            {has("radius") && <Slider label="Esquinas redondeadas" k="radius" value={s.radius} onChange={(radius) => patch({ radius })} />}
            {has("maxWidth") && <Slider label="Ancho máximo" k="maxWidth" value={s.maxWidth} def={1536} onChange={(maxWidth) => patch({ maxWidth })} />}
            {has("align") && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[var(--fg-muted)]">Alineación</span>
                <div className="flex gap-1">
                  {(
                    [
                      [undefined, "Auto"],
                      ["left", <AlignLeft key="l" size={13} />],
                      ["center", <AlignCenter key="c" size={13} />],
                      ["right", <AlignRight key="r" size={13} />],
                    ] as const
                  ).map(([v, icon]) => (
                    <button
                      key={v ?? "auto"}
                      type="button"
                      onClick={() => patch({ align: v })}
                      className={`rounded-md border px-2 py-1 text-xs transition ${
                        s.align === v
                          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]"
                          : "border-[var(--border)] hover:border-[var(--border-strong)]"
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Group>
        </>
      )}

      {value[active] && (
        <button
          type="button"
          onClick={() => {
            const next = { ...value };
            delete next[active];
            onChange(next);
          }}
          className="inline-flex items-center gap-1.5 self-start rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <RotateCcw size={12} /> Restablecer {meta.label.toLowerCase()}
        </button>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2.5 border-t border-[var(--border)] pt-3">
      <legend className="meta pr-2 !text-[0.65rem]">{title}</legend>
      {children}
    </fieldset>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-xs text-[var(--fg-muted)]">{label}</span>
      <button
        type="button"
        onClick={() => onChange(undefined)}
        className={`rounded-md border px-2 py-1 text-[0.68rem] font-semibold ${
          !value ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--border)]"
        }`}
      >
        Auto
      </button>
      <div className="flex flex-1 flex-wrap gap-1">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            aria-label={`${label} ${c}`}
            onClick={() => onChange(c)}
            style={{ background: c }}
            className={`size-5 rounded-full border ${
              value?.toLowerCase() === c ? "ring-2 ring-[var(--accent)] ring-offset-1" : "border-[var(--border-strong)]"
            }`}
          />
        ))}
      </div>
      <input
        type="color"
        value={value ?? "#ffffff"}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label}: color exacto`}
        className="size-7 shrink-0 cursor-pointer rounded border border-[var(--border)] bg-transparent p-0.5"
      />
    </div>
  );
}

function FontSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: HomeTitleFont | undefined;
  onChange: (v: HomeTitleFont | undefined) => void;
}) {
  const current = HOME_FONTS.find((f) => f.id === value);
  return (
    <label className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-xs text-[var(--fg-muted)]">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange((e.target.value || undefined) as HomeTitleFont | undefined)}
        style={current ? { fontFamily: current.cssVar } : undefined}
        className="min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] px-2 py-1.5 text-sm"
      >
        <option value="">Auto (la de la plantilla)</option>
        {HOME_FONT_GROUPS.map((g) => (
          <optgroup key={g.id} label={g.label}>
            {HOME_FONTS.filter((f) => f.group === g.id).map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function Slider({
  label,
  k,
  value,
  def,
  onChange,
}: {
  label: string;
  k: keyof typeof RANGES;
  value: number | undefined;
  /** Valor que se muestra cuando está en automático. */
  def?: number;
  onChange: (v: number | undefined) => void;
}) {
  const r = RANGES[k];
  const shown = value ?? def ?? r.min;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--fg-muted)]">{label}</span>
        <span className="flex items-center gap-2">
          <span className="tabular-nums font-semibold">{value === undefined ? "Auto" : `${value} ${r.unit}`}</span>
          {value !== undefined && (
            <button type="button" onClick={() => onChange(undefined)} className="text-[var(--fg-muted)] hover:text-[var(--accent)]" aria-label={`${label}: automático`}>
              <RotateCcw size={11} />
            </button>
          )}
        </span>
      </div>
      <input
        type="range"
        min={r.min}
        max={r.max}
        step={r.step}
        value={shown}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--accent)]"
      />
    </div>
  );
}
