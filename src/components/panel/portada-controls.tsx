"use client";

import { useState } from "react";
import { Bold, ChevronDown, Columns2, Image as ImageIcon, Italic, Palette, Type } from "lucide-react";
import type { HomeStyle } from "@/db/schema";
import { HOME_FONTS, HOME_FONT_GROUPS, type HomeTitleFont } from "@/lib/home-fonts";
import { HOME_TEMPLATES } from "@/lib/home-layout";
import type { Layout } from "@/components/panel/portada-types";
import { cn } from "@/lib/utils";

/**
 * Controles reutilizables del editor de portada (los usan la barra lateral del
 * editor y el formulario flotante de la vista previa): botón segmentado,
 * selector de tipografía, color, plantillas y el inspector de una nota.
 */

export function SegButton({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
        active ? "bg-[var(--brand)] text-white" : "bg-[var(--paper-2)] text-[var(--ink-soft)] hover:text-[var(--fg)]"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Selector de tipografía del titular, como lista desplegable.
 *
 * No es un `<select>` nativo: Chrome no respeta `font-family` en las
 * `<option>`, y aquí lo importante es ver cada fuente dibujada con su propia
 * letra. Se despliega EN LÍNEA (no flotando) porque el panel tiene scroll
 * propio y una capa absoluta quedaría recortada por él.
 */
export function FontPicker({
  value,
  onChange,
}: {
  value: HomeTitleFont | undefined;
  onChange: (font: HomeTitleFont | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const actual = HOME_FONTS.find((f) => f.id === value);

  // Elige una tipografía.
  function pick(font: HomeTitleFont | undefined) {
    onChange(font);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        style={actual ? { fontFamily: actual.cssVar } : undefined}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] px-3 py-2 text-left text-[0.95rem] transition hover:border-[var(--accent)]"
      >
        <span className="min-w-0 truncate">
          {actual ? actual.label : "Automático · según la tarjeta"}
        </span>
        <ChevronDown
          size={14}
          aria-hidden
          className={`shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Tipografía del titular"
          className="mt-1.5 max-h-64 overflow-y-auto overflow-x-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)] p-1 shadow-lg"
        >
          <FontOption selected={!value} onSelect={() => pick(undefined)}>
            Automático · según la tarjeta
          </FontOption>

          {HOME_FONT_GROUPS.map((group) => (
            <div key={group.id}>
              <p className="meta px-2 pb-0.5 pt-2 !text-xs">{group.label}</p>
              {HOME_FONTS.filter((f) => f.group === group.id).map((f) => (
                <FontOption
                  key={f.id}
                  selected={value === f.id}
                  onSelect={() => pick(f.id)}
                  fontFamily={f.cssVar}
                >
                  {f.label}
                </FontOption>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Color del titular: muestras rápidas + cuentagotas.
 *
 * «Automático» no guarda color, para que el titular siga heredando el del tema y sus
 * estados de :hover; fijar un color lo congela en todas las plantillas.
 */
const TITLE_COLORS = [
  { label: "Tinta", value: "#141210" },
  { label: "Marfil", value: "#f6f2e8" },
  { label: "Oro", value: "#d8b558" },
  { label: "Burdeos", value: "#7b1e2b" },
  { label: "Esmeralda", value: "#2f9c62" },
  { label: "Cobre", value: "#c97b3f" },
  { label: "Zafiro", value: "#1d4ed8" },
  { label: "Violeta", value: "#8b5cf6" },
];

// Selector de color con muestras y campo hexadecimal.
export function ColorPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (color: string | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(undefined)}
        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
          !value
            ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]"
            : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-strong)]"
        }`}
      >
        Automático
      </button>

      {TITLE_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          title={c.label}
          aria-label={c.label}
          aria-pressed={value?.toLowerCase() === c.value}
          onClick={() => onChange(c.value)}
          style={{ background: c.value }}
          className={`size-7 rounded-full border-2 transition hover:scale-110 ${
            value?.toLowerCase() === c.value
              ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/40"
              : "border-[var(--border-strong)]"
          }`}
        />
      ))}

      <label
        className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-[var(--fg-muted)]"
        title="Elegir un color exacto"
      >
        <input
          type="color"
          value={value ?? "#141210"}
          onChange={(e) => onChange(e.target.value)}
          className="size-7 cursor-pointer rounded border border-[var(--border)] bg-transparent p-0.5"
          aria-label="Color personalizado del titular"
        />
        Otro
      </label>
    </div>
  );
}

// Opción de tipografía con su muestra.
function FontOption({
  children,
  selected,
  onSelect,
  fontFamily,
}: {
  children: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
  fontFamily?: string;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      style={fontFamily ? { fontFamily } : undefined}
      className={`block w-full min-w-0 truncate rounded-md px-2.5 py-1.5 text-left text-[0.95rem] transition ${
        selected
          ? "bg-[var(--accent)] text-[var(--accent-fg)]"
          : "hover:bg-[var(--surface-2)]"
      }`}
    >
      {children}
    </button>
  );
}

// Selector de la plantilla de portada.
export function TemplatePicker({
  layout,
  onPick,
  compacto = false,
}: {
  layout: Layout;
  onPick: (config: Omit<Layout, "ticker">) => void;
  /** En la barra lateral: una columna y sin descripción larga. */
  compacto?: boolean;
}) {
  const activeId = HOME_TEMPLATES.find((t) => t.id === layout.templateId)?.id;

  return (
    <div className={compacto ? "flex flex-col gap-2" : "flex flex-col gap-3"}>
      {!compacto && <p className="kicker !text-[var(--accent)]">Elige la plantilla de portada</p>}
      <div className={compacto ? "grid gap-2" : "grid gap-3 sm:grid-cols-3"}>
        {HOME_TEMPLATES.map((t) => {
          const active = t.id === activeId;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t.config)}
              className={`flex flex-col gap-2.5 rounded-lg border-2 p-3 text-left transition ${
                active
                  ? "border-[var(--accent)] bg-[var(--surface)]"
                  : "border-[var(--border)] bg-[var(--surface)]/60 hover:border-[var(--border-strong)]"
              }`}
            >
              <div data-theme={t.id} className="overflow-hidden rounded-md">
                <TemplateThumb config={t.config} />
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-sm font-bold">
                  {t.name}
                  {active && (
                    <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10.5px] font-bold uppercase text-[var(--accent-fg)]">
                      Activa
                    </span>
                  )}
                </p>
                {!compacto && (
                  <p className="mt-0.5 text-xs leading-snug text-[var(--fg-muted)]">
                    {t.description}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {!activeId && (
        <p className="text-xs text-[var(--fg-muted)]">Disposición personalizada (no coincide con ninguna plantilla). Elige una para partir de cero.</p>
      )}
    </div>
  );
}

/** Diagrama en miniatura de cómo se organiza cada plantilla. */
function TemplateThumb({ config }: { config: Omit<Layout, "ticker"> }) {
  const ink = "bg-[color-mix(in_srgb,var(--ink-faint)_40%,transparent)]";
  const brand = "bg-[color-mix(in_srgb,var(--brand)_35%,transparent)]";

  if (config.templateId === "vanguardia") {
    return (
      <div className="grid h-16 grid-cols-6 grid-rows-2 gap-1 rounded-md bg-[#0a0b0d] p-1.5">
        <div className="col-span-4 row-span-2 rounded-[0.4rem] bg-[color-mix(in_srgb,var(--brand)_45%,#1a1b20)]" />
        <div className="col-span-2 row-span-2 rounded-[0.4rem] bg-[#22c55e]/40" />
      </div>
    );
  }

  if (config.templateId === "revista") {
    return (
      <div className="flex h-16 flex-col gap-1 rounded-md bg-[var(--paper-2)] p-1.5">
        <div className={cn("relative h-9 w-full rounded-sm", ink)}>
          <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5">
            <span className="h-1 w-2.5 rounded-full bg-white/90" />
            <span className="h-1 w-1 rounded-full bg-white/50" />
            <span className="h-1 w-1 rounded-full bg-white/50" />
          </div>
        </div>
        <div className="flex flex-1 gap-1">
          {Array.from({ length: config.breveColumns }).map((_, i) => (
            <div key={i} className={cn("flex-1 rounded-sm", brand)} />
          ))}
        </div>
      </div>
    );
  }

  if (config.templateId === "compacto") {
    return (
      <div className="grid h-16 grid-cols-4 grid-rows-2 gap-1 rounded-md bg-[var(--paper-2)] p-1.5">
        <div className={cn("col-span-2 row-span-2 rounded-sm", ink)} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cn("rounded-sm", brand)} />
        ))}
      </div>
    );
  }

  const horizontal = config.breveDirection === "horizontal";
  return (
    <div className="flex h-16 gap-1 rounded-md bg-[var(--paper-2)] p-1.5">
      {horizontal ? (
        <div className="flex w-full flex-col gap-1">
          <div className={cn("h-8 w-full rounded-sm", ink)} />
          <div className="flex flex-1 gap-1">
            {Array.from({ length: config.breveColumns }).map((_, i) => (
              <div key={i} className={cn("flex-1 rounded-sm", brand)} />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className={cn("h-full w-[62%] rounded-sm", ink)} />
          <div className="flex h-full flex-1 flex-col gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={cn("flex-1 rounded-sm", brand)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}



/** Fila de deslizador con el nombre a la izquierda y el valor a la derecha (sin saltos de línea). */
function SliderRow({
  label,
  value,
  unit = "%",
  min,
  max,
  step,
  onChange,
  icon,
}: {
  label: string;
  value: number;
  unit?: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="meta flex items-center gap-1">{icon}{label}</span>
        <span className="font-semibold tabular-nums">{value} {unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${label}: ${value} ${unit}`}
        className="mt-1 w-full accent-[var(--brand)]"
      />
    </div>
  );
}

/**
 * Lo esencial de UNA nota de la portada: tamaño de la tarjeta, cómo se ve el
 * titular y la imagen. Los ajustes finos (posición en la cuadrícula, fondo,
 * forma…) van aparte, en «Más ajustes» (ver BlockStyleEditor).
 */
export function Inspector({
  style,
  showSpan,
  onChange,
  onClear,
}: {
  style: HomeStyle;
  showSpan: boolean;
  onChange: (p: Partial<HomeStyle>) => void;
  onClear: () => void;
}) {
  const s = style;
  const tamano = { sm: "S", md: "M", lg: "L" }[s.size ?? "" as "sm"] ?? "Automático";
  return (
    <div className="flex flex-col">
      {/* Una lista de ajustes cerrados: cada fila muestra su valor actual y se despliega al pulsarla. */}
      <Fila icono={<Type size={13} />} titulo="Tamaño de la tarjeta" resumen={tamano}>
        <div className="flex gap-1.5">
          <SegButton active={!s.size} onClick={() => onChange({ size: undefined })} title="Lo decide la plantilla">Automático</SegButton>
          <SegButton active={s.size === "sm"} onClick={() => onChange({ size: "sm" })} title="Pequeña">S</SegButton>
          <SegButton active={s.size === "md"} onClick={() => onChange({ size: "md" })} title="Mediana">M</SegButton>
          <SegButton active={s.size === "lg"} onClick={() => onChange({ size: "lg" })} title="Grande">L</SegButton>
        </div>
      </Fila>

      {showSpan && (
        <Fila icono={<Columns2 size={13} />} titulo="Ancho en la cuadrícula" resumen={s.span === 2 ? "2 columnas" : "1 columna"}>
          <div className="flex gap-1.5">
            <SegButton active={s.span !== 2} onClick={() => onChange({ span: undefined })}>1 columna</SegButton>
            <SegButton active={s.span === 2} onClick={() => onChange({ span: 2 })}>2 columnas</SegButton>
          </div>
        </Fila>
      )}

      <Fila titulo="Tipo de letra del titular" resumen={s.font ? "Personalizado" : "Automático"}>
        <FontPicker value={s.font} onChange={(font) => onChange({ font })} />
      </Fila>

      <Fila
        icono={<Palette size={13} />}
        titulo="Color del titular"
        resumen={s.color ? <span aria-label={s.color} className="inline-block size-3.5 rounded-full border border-[var(--border-strong)]" style={{ background: s.color }} /> : "Automático"}
      >
        <ColorPicker value={s.color} onChange={(color) => onChange({ color })} />
      </Fila>

      <Fila titulo="Negrilla y cursiva del titular" resumen={[s.bold && "Negrilla", s.italic && "Cursiva"].filter(Boolean).join(" · ") || "Ninguna"}>
        <div className="flex gap-1.5">
          <SegButton active={!!s.bold} onClick={() => onChange({ bold: !s.bold || undefined })} title="Negrilla">
            <Bold size={13} /> Negrilla
          </SegButton>
          <SegButton active={!!s.italic} onClick={() => onChange({ italic: !s.italic || undefined })} title="Cursiva">
            <Italic size={13} /> Cursiva
          </SegButton>
        </div>
      </Fila>

      <Fila titulo="Tamaño del titular" resumen={`${s.titleScale ?? 100} %`}>
        <SliderRow label="Tamaño" value={s.titleScale ?? 100} min={70} max={160} step={5} onChange={(v) => onChange({ titleScale: v === 100 ? undefined : v })} />
      </Fila>

      <Fila icono={<ImageIcon size={13} />} titulo="Tamaño de la imagen" resumen={`${s.imageScale ?? 100} %`}>
        <SliderRow label="Tamaño" value={s.imageScale ?? 100} min={40} max={100} step={5} onChange={(v) => onChange({ imageScale: v === 100 ? undefined : v })} />
      </Fila>

      <button type="button" onClick={onClear} className="mt-3 self-start text-xs font-medium text-[var(--fg-muted)] underline-offset-2 hover:text-[var(--danger)] hover:underline">
        Quitar todo el estilo de esta nota
      </button>
    </div>
  );
}

// Una fila de la lista de ajustes: título y valor actual a la vista, y el control debajo cuando se pulsa. Arranca cerrada.
function Fila({ titulo, resumen, icono, children }: { titulo: string; resumen: React.ReactNode; icono?: React.ReactNode; children: React.ReactNode }) {
  return (
    <details className="group/f border-b border-[var(--border)]">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2 text-sm font-bold">
          {icono}
          {titulo}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-[var(--fg-muted)]">
          {resumen}
          <ChevronDown size={15} aria-hidden className="transition group-open/f:rotate-180" />
        </span>
      </summary>
      <div className="pb-3 pt-1">{children}</div>
    </details>
  );
}
