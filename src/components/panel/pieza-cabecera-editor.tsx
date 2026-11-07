"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { EVENTO_MODO_LIENZO } from "@/lib/home-regions";
import type { SectionElId, SectionElStyle } from "@/db/schema";
import { EL_RANGES, SECTION_ELS } from "@/lib/section-els";
import { ColorRow, FontSelect } from "@/components/panel/region-editor";
import { GradientEditor } from "@/components/panel/gradient-editor";

/** Piezas de la cabecera, en el orden en que se ven de arriba abajo. */
export const PIEZAS_CABECERA = SECTION_ELS.filter((x) => x.group === "cabecera");

/**
 * Todo lo que se le puede hacer a UNA pieza de la cabecera (el nombre, el logo, la fecha…), junto y en orden:
 * color → tamaño → letra → mayúsculas y espaciado. Así quien edita no tiene que buscar el color en un sitio y el tamaño en otro.
 */
export function PiezaCabeceraEditor({
  el,
  style,
  onChange,
}: {
  el: SectionElId;
  style: SectionElStyle;
  onChange: (next: SectionElStyle | undefined) => void;
}) {
  const meta = SECTION_ELS.find((x) => x.id === el)!;
  const esLogo = el === "h-logo";
  const rango = esLogo ? EL_RANGES.logo : EL_RANGES.size;

  // Para qué modo se edita: los dos, solo el claro o solo el oscuro (como los colores de cada parte).
  const [modo, setModo] = useState<"ambos" | "claro" | "oscuro">("ambos");
  // Mientras se edita un modo suelto, el lienzo se ve en ese modo.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(EVENTO_MODO_LIENZO, { detail: modo }));
    return () => {
      window.dispatchEvent(new CustomEvent(EVENTO_MODO_LIENZO, { detail: "ambos" }));
    };
  }, [modo]);
  const { claro, oscuro, ...base } = style;
  // Lo que se ve y se edita ahora.
  const actual: SectionElStyle = modo === "ambos" ? base : ((modo === "claro" ? claro : oscuro) ?? {});

  const limpio = (o: Record<string, unknown>) => {
    for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
    return Object.keys(o).length ? o : undefined;
  };
  function patch(p: Partial<SectionElStyle>) {
    const next: Record<string, unknown> = modo === "ambos" ? { ...base, ...p, claro, oscuro } : { ...base, claro, oscuro, [modo]: limpio({ ...actual, ...p }) };
    onChange(limpio(next) as SectionElStyle | undefined);
  }

  const seccion = "flex flex-col gap-2 border-t border-[var(--border)] pt-3";
  const titulo = "text-[0.8rem] font-extrabold text-[#0b0b0b]";
  const opcion = (activa: boolean) =>
    `flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition ${activa ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--border)] bg-white hover:border-[var(--border-strong)]"}`;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-[0.95rem] font-extrabold text-[#0b0b0b]">{meta.label}</p>
        <p className="text-xs leading-snug text-[var(--fg-muted)]">{meta.hint}</p>
      </div>

      {/* Modo: lo mismo para claro y oscuro, o distinto en cada uno. */}
      <div role="group" aria-label="Modo al que se aplica" className="grid grid-cols-3 gap-1 rounded-lg border border-[var(--border)] p-1">
        {(
          [
            ["ambos", "Los dos modos"],
            ["claro", "Solo claro"],
            ["oscuro", "Solo oscuro"],
          ] as const
        ).map(([id, etiqueta]) => (
          <button key={id} type="button" aria-pressed={modo === id} onClick={() => setModo(id)} className={`relative rounded-md px-1 py-1.5 text-[0.72rem] font-semibold transition ${modo === id ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"}`}>
            {etiqueta}
            {id !== "ambos" && style[id] && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-current" aria-label="con ajustes propios" />}
          </button>
        ))}
      </div>
      {modo !== "ambos" && <p className="-mt-1 text-[11px] leading-snug text-[var(--fg-muted)]">Solo para quien ve el sitio en modo {modo}; lo demás sale de «Los dos modos». El lienzo se muestra en modo {modo} mientras editas.</p>}

      {/* 1. Color */}
      <div className={seccion}>
        <p className={titulo}>Color</p>
        {!actual.gradient && <ColorRow label={esLogo ? "Color del logo" : "Color del texto"} value={actual.color} onChange={(color) => patch({ color })} />}
        {meta.gradient && <GradientEditor label="Usar degradado" value={actual.gradient} onChange={(gradient) => patch({ gradient })} />}
        {!actual.color && !actual.gradient && (
          <p className="text-[11px] leading-snug text-[var(--fg-muted)]">
            {esLogo ? "Sin color propio, el logo toma el de «Títulos» (Toda la cabecera › Colores)." : "Sin color propio, toma el de la cabecera (Toda la cabecera › Colores)."}
          </p>
        )}
      </div>

      {/* 2. Tamaño */}
      <div className={seccion}>
        <div className="flex items-center justify-between">
          <p className={titulo}>{esLogo ? "Alto" : "Tamaño"}</p>
          <span className="flex items-center gap-2 text-xs font-semibold tabular-nums">
            {actual.size === undefined ? "Automático" : `${actual.size} px`}
            {actual.size !== undefined && (
              <button type="button" onClick={() => patch({ size: undefined })} aria-label="Tamaño automático" className="text-[var(--fg-muted)] hover:text-[var(--accent)]">
                <RotateCcw size={12} />
              </button>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Más pequeño" onClick={() => patch({ size: Math.max(rango.min, (actual.size ?? (esLogo ? 56 : 16)) - (esLogo ? 4 : 1)) })} className="grid size-8 place-items-center rounded-md border border-[var(--border)] bg-white text-sm font-bold hover:border-[var(--accent)]">−</button>
          <input
            type="range"
            min={rango.min}
            max={esLogo ? rango.max : 120}
            value={actual.size ?? (esLogo ? 56 : 16)}
            onChange={(e) => patch({ size: Number(e.target.value) })}
            aria-label={esLogo ? "Alto del logo en píxeles" : "Tamaño de la letra en píxeles"}
            className="min-w-0 flex-1 accent-[var(--accent)]"
          />
          <button type="button" aria-label="Más grande" onClick={() => patch({ size: Math.min(rango.max, (actual.size ?? (esLogo ? 56 : 16)) + (esLogo ? 4 : 1)) })} className="grid size-8 place-items-center rounded-md border border-[var(--border)] bg-white text-sm font-bold hover:border-[var(--accent)]">+</button>
        </div>
        {!esLogo && <p className="text-[11px] leading-snug text-[var(--fg-muted)]">En el celular los tamaños grandes se reducen solos para que quepan.</p>}
      </div>

      {!esLogo && (
        <>
          {/* 3. Letra */}
          <div className={seccion}>
            <p className={titulo}>Letra</p>
            <FontSelect label="Tipo de letra" value={actual.font} onChange={(font) => patch({ font })} />
            <span className="text-xs text-[var(--fg-muted)]">Grosor</span>
            <div className="flex gap-1">
              {(
                [
                  [undefined, "Auto"],
                  [300, "Fina"],
                  [400, "Normal"],
                  [700, "Negrita"],
                  [900, "Gruesa"],
                ] as const
              ).map(([w, nombre]) => (
                <button key={nombre} type="button" aria-pressed={actual.weight === w} onClick={() => patch({ weight: w })} className={opcion(actual.weight === w)}>
                  {nombre}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Mayúsculas y espaciado */}
          <div className={seccion}>
            <p className={titulo}>Mayúsculas y espaciado</p>
            <div className="flex gap-1">
              {(
                [
                  [undefined, "Auto"],
                  [true, "MAYÚSCULAS"],
                  [false, "Normal"],
                ] as const
              ).map(([u, nombre]) => (
                <button key={nombre} type="button" aria-pressed={actual.upper === u} onClick={() => patch({ upper: u })} className={opcion(actual.upper === u)}>
                  {nombre}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--fg-muted)]">Espacio entre letras</span>
              <span className="font-semibold tabular-nums">{actual.tracking === undefined ? "Automático" : `${actual.tracking} px`}</span>
            </div>
            <input
              type="range"
              min={EL_RANGES.tracking.min}
              max={EL_RANGES.tracking.max}
              step={0.5}
              value={actual.tracking ?? 0}
              onChange={(e) => patch({ tracking: Number(e.target.value) })}
              aria-label="Espacio entre letras en píxeles"
              className="w-full accent-[var(--accent)]"
            />
          </div>
        </>
      )}

      {Object.keys(style).length > 0 && (
        <button type="button" onClick={() => onChange(undefined)} className="inline-flex items-center gap-1.5 self-start rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)]">
          <RotateCcw size={12} /> Restablecer {meta.label.toLowerCase()}
        </button>
      )}
    </div>
  );
}
