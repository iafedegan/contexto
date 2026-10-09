"use client";

import { useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, ChevronDown, EyeOff, RotateCcw } from "lucide-react";
import { GradientEditor } from "@/components/panel/gradient-editor";
import { HOME_FONT_GROUPS, HOME_FONTS, type HomeTitleFont } from "@/lib/home-fonts";
import {
  RANGES,
  REGIONS,
  type RegionColors,
  type RegionId,
  type RegionStyle,
  type RegionStyles,
} from "@/lib/home-regions";

// Colores de muestra.
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
  hideTabs = false,
}: {
  value: RegionStyles;
  active: RegionId;
  onActive: (id: RegionId) => void;
  onChange: (next: RegionStyles) => void;
  /** Limita los componentes editables (p. ej. en las secciones no hay Hero ni Tarjetas). */
  only?: RegionId[];
  /** Oculta el selector de componente (cuando solo hay uno que editar). */
  hideTabs?: boolean;
}) {
  const visibles = REGIONS.filter((r) => !only || only.includes(r.id));
  const meta = REGIONS.find((r) => r.id === active)!;
  const s: RegionStyle = value[active] ?? {};
  // Indica si la región admite un ajuste.
  const has = (k: keyof RegionStyle) => meta.controls.includes(k);

  // Para qué modo del sitio se editan los colores: los dos, solo el claro o solo el oscuro.
  const [modo, setModo] = useState<"ambos" | "claro" | "oscuro">("ambos");
  const colores: RegionColors = modo === "ambos" ? s : (s[modo] ?? {});
  // Cambia un color: en «los dos modos» va al estilo base; en un modo concreto, solo a ese modo.
  function patchColor(p: Partial<RegionColors>) {
    if (modo === "ambos") return patch(p);
    const merged: RegionColors = { ...(s[modo] ?? {}), ...p };
    for (const k of Object.keys(merged) as (keyof RegionColors)[]) if (merged[k] === undefined) delete merged[k];
    patch({ [modo]: Object.keys(merged).length ? merged : undefined });
  }

  // Cambia el estilo de la región.
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
      {!hideTabs && (<div className={`grid gap-1 rounded-lg border border-[var(--border)] p-1 ${visibles.length === 3 ? "grid-cols-3" : visibles.length === 2 ? "grid-cols-2" : "grid-cols-5"}`}>
        {visibles.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onActive(r.id)}
            aria-pressed={active === r.id}
            className={`relative rounded-md px-1 py-1.5 text-[0.72rem] font-semibold transition ${
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
      </div>)}
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
            {/* El sitio tiene modo claro y modo oscuro: los colores pueden ser los mismos en ambos o distintos en cada uno. */}
            <div role="group" aria-label="Modo al que se aplican los colores" className="grid grid-cols-3 gap-1 rounded-lg border border-[var(--border)] p-1">
              {(
                [
                  ["ambos", "Los dos"],
                  ["claro", "Claro"],
                  ["oscuro", "Oscuro"],
                ] as const
              ).map(([id, etiqueta]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={modo === id}
                  onClick={() => setModo(id)}
                  className={`relative rounded-md px-1 py-1.5 text-[0.72rem] font-semibold transition ${modo === id ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"}`}
                >
                  {etiqueta}
                  {id !== "ambos" && s[id] && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-current" aria-label="con colores propios" />}
                </button>
              ))}
            </div>
            <p className="-mt-1 text-[11px] leading-snug text-[var(--fg-muted)]">
              {modo === "ambos"
                ? "Estos colores valen para el modo claro y el oscuro (salvo donde elijas colores propios de un modo)."
                : `Solo para quien ve el sitio en modo ${modo}: el otro modo no cambia. Para verlo en el lienzo, cambia de modo con el botón ☀ de la cabecera.`}
            </p>
            {has("bg") && <ColorRow label="Fondo" value={colores.bg} onChange={(bg) => patchColor({ bg })} />}
            {has("bgGradient") && <GradientEditor label="Degradado de fondo" value={colores.bgGradient} onChange={(bgGradient) => patchColor({ bgGradient })} />}
            {has("fg") && <ColorRow label="Texto" value={colores.fg} onChange={(fg) => patchColor({ fg })} />}
            {has("accent") && <ColorRow label="Acento" value={colores.accent} onChange={(accent) => patchColor({ accent })} />}
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
                      [undefined, "Automático", "Auto"],
                      ["left", "A la izquierda", <AlignLeft key="l" size={13} />],
                      ["center", "Centrado", <AlignCenter key="c" size={13} />],
                      ["right", "A la derecha", <AlignRight key="r" size={13} />],
                    ] as const
                  ).map(([v, nombre, icon]) => (
                    <button
                      key={v ?? "auto"}
                      type="button"
                      title={nombre}
                      aria-label={nombre}
                      aria-pressed={s.align === v}
                      onClick={() => patch({ align: v })}
                      className={`rounded-md border px-2 py-1 text-xs transition ${
                        s.align === v
                          ? v === undefined
                            ? "border-[var(--accent)] bg-transparent text-[var(--accent)]"
                            : "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]"
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

// Grupo de ajustes con título: se despliega al pulsarlo y arranca cerrado, para que el panel no sea una lista interminable.
export function Group({ title, children, abierto = false }: { title: string; children: React.ReactNode; abierto?: boolean }) {
  return (
    <details open={abierto} className="group/g border-t border-[var(--border)] pt-2">
      <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 rounded-md py-1 text-[0.95rem] font-extrabold tracking-normal text-[#0b0b0b] marker:hidden [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown size={16} aria-hidden className="shrink-0 text-[var(--fg-muted)] transition group-open/g:rotate-180" />
      </summary>
      <div className="flex flex-col gap-2.5 pb-1 pt-2.5">{children}</div>
    </details>
  );
}

// Fila de ajuste de color.
export function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-[var(--fg-muted)]">{label}</span>
      {/* Una sola fila ordenada: «sin color» (automático), las muestras y el selector de color exacto. */}
      <div role="group" aria-label={label} className="grid grid-cols-10 items-center justify-items-center gap-1">
        <button
          type="button"
          title="Automático (el de la plantilla)"
          aria-label={`${label}: automático`}
          aria-pressed={!value}
          onClick={() => onChange(undefined)}
          className={`relative size-6 overflow-hidden rounded-full border bg-white transition hover:scale-110 ${!value ? "ring-2 ring-[var(--accent)] ring-offset-1" : "border-[var(--border-strong)]"}`}
        >
          <span aria-hidden className="absolute left-1/2 top-[-20%] h-[140%] w-px -translate-x-1/2 rotate-45 bg-[#c0392b]" />
        </button>
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            aria-label={`${label} ${c}`}
            aria-pressed={value?.toLowerCase() === c}
            onClick={() => onChange(c)}
            style={{ background: c }}
            className={`size-6 rounded-full border transition hover:scale-110 ${value?.toLowerCase() === c ? "ring-2 ring-[var(--accent)] ring-offset-1" : "border-[var(--border-strong)]"}`}
          />
        ))}
        <label title="Elegir un color exacto" className="relative size-6 cursor-pointer overflow-hidden rounded-full border border-[var(--border-strong)] transition hover:scale-110" style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }}>
          <input type="color" value={value ?? "#ffffff"} onChange={(e) => onChange(e.target.value)} aria-label={`${label}: color exacto`} className="absolute inset-0 size-full cursor-pointer opacity-0" />
        </label>
      </div>
    </div>
  );
}

// Selector de tipografía.
export function FontSelect({
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

// Deslizador de un ajuste numérico.
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
          <span className="tabular-nums font-semibold">{value === undefined ? "Automático" : `${value} ${r.unit}`}</span>
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
