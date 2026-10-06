"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, MousePointerClick, X } from "lucide-react";
import type { HomeStyle } from "@/db/schema";
import { BlockStyleEditor, type ZoneBundle } from "@/components/panel/block-style-editor";
import { Inspector } from "@/components/panel/portada-controls";
import type { Layout } from "@/components/panel/portada-types";
import { RegionEditor } from "@/components/panel/region-editor";
import { REGIONS, type RegionId, type RegionStyles } from "@/lib/home-regions";

/** Qué se está editando: una nota concreta o una parte entera de la plantilla. */
export type Foco = "nota" | "parte" | null;

// Partes de la plantilla que se pueden editar.
const PARTES: RegionId[] = ["navbar", "hero", "cards", "body", "footer"];
// Etiqueta de una parte.
const parteLabel = (id: RegionId) => REGIONS.find((r) => r.id === id)?.label ?? id;

/**
 * «Propiedades»: el panel de lo que está elegido en la página. Es lo primero de
 * la barra lateral y SIEMPRE visible — antes los controles estaban dentro de un
 * bloque cerrado y, al pulsar una nota, parecía que no pasaba nada.
 *
 *  - Sin elegir nada: explica qué hacer y deja elegir una parte.
 *  - Una parte (cabecera, tarjetas, cuerpo, pie…): sus colores, tipografía y medidas.
 *  - Una nota: «Solo esta nota» (lo esencial y, en «Más ajustes», lo fino) o
 *    «Todas las tarjetas» — el alcance del cambio queda a la vista.
 */
export function PropiedadesCard({
  foco,
  onFoco,
  region,
  onRegion,
  layout,
  onRegions,
  nota,
  onNotaChange,
  onNotaClear,
  zone,
  onClose,
  flash,
}: {
  foco: Foco;
  onFoco: (f: Foco) => void;
  region: RegionId;
  onRegion: (r: RegionId) => void;
  layout: Layout;
  onRegions: (next: RegionStyles) => void;
  /** La nota elegida: su posición (-1 si no está en la lista), título y estilo actual. */
  nota: { index: number; title: string; style: HomeStyle } | null;
  onNotaChange: (p: Partial<HomeStyle>) => void;
  onNotaClear: () => void;
  zone: ZoneBundle;
  onClose: () => void;
  /** Cambia cada vez que el usuario elige algo en la página: el panel se muestra y destella. */
  flash: number;
}) {
  const root = useRef<HTMLElement>(null);

  // Al elegir algo en la página, el panel aparece a la vista y destella un instante.
  useEffect(() => {
    const el = root.current;
    if (!el || flash === 0) return;
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    el.classList.remove("cg-flash");
    void el.offsetWidth; // reinicia la animación
    el.classList.add("cg-flash");
    const id = setTimeout(() => el.classList.remove("cg-flash"), 1000);
    return () => clearTimeout(id);
  }, [flash]);

  const activo = foco !== null && (foco === "parte" || nota !== null);

  return (
    <section
      ref={root}
      id="propiedades"
      tabIndex={-1}
      aria-label="Propiedades de lo elegido"
      data-tour="propiedades"
      className={`rounded-[var(--radius-lg)] border-2 bg-[var(--bg)] shadow-[var(--shadow)] outline-none ${
        activo ? "border-[var(--accent)]" : "border-[var(--border)]"
      }`}
    >
      <header className="flex items-center gap-2 px-4 py-3">
        <MousePointerClick size={14} className="shrink-0 text-[var(--accent)]" />
        <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">Propiedades</h2>
        {activo && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Dejar de editar esto"
            title="Dejar de editar esto"
            className="ml-auto rounded-full p-1.5 text-[var(--fg-muted)] transition hover:text-[var(--accent)]"
          >
            <X size={14} />
          </button>
        )}
      </header>

      <div className="border-t border-[var(--border)] p-4">
        {!activo ? (
          <div>
            <p className="text-sm font-semibold">Elige qué quieres cambiar</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--fg-muted)]">
              Haz clic en la página o elige una parte:
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {PARTES.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onRegion(id);
                    onFoco("parte");
                  }}
                  className="rounded-full border border-[var(--border-strong)] px-3.5 py-1.5 text-xs font-semibold transition hover:border-[var(--accent)] hover:bg-[var(--surface-2)]"
                >
                  {parteLabel(id)}
                </button>
              ))}
            </div>
          </div>
        ) : foco === "nota" && nota ? (
          <NotaPanel key={`${nota.index}:${nota.title}`} nota={nota} layout={layout} onRegions={onRegions} onChange={onNotaChange} onClear={onNotaClear} zone={zone} />
        ) : (
          <div className="flex flex-col gap-3">
            <p className="flex flex-wrap items-center gap-1 text-xs text-[var(--fg-muted)]">
              Portada <ChevronRight size={12} aria-hidden /> <span className="font-semibold text-[var(--fg)]">{parteLabel(region)}</span>
            </p>
            <RegionEditor value={layout.regions ?? {}} active={region} onActive={onRegion} onChange={onRegions} only={PARTES} />
            {region === "cards" && nota && (
              <button type="button" onClick={() => onFoco("nota")} className="self-start text-xs font-semibold text-[var(--accent)] hover:underline">
                ← Editar solo {nota.index >= 0 ? `la nota ${nota.index + 1}` : "la nota elegida"}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// Panel de propiedades de una nota seleccionada.
function NotaPanel({
  nota,
  layout,
  onRegions,
  onChange,
  onClear,
  zone,
}: {
  nota: { index: number; title: string; style: HomeStyle };
  layout: Layout;
  onRegions: (next: RegionStyles) => void;
  onChange: (p: Partial<HomeStyle>) => void;
  onClear: () => void;
  zone: ZoneBundle;
}) {
  const [alcance, setAlcance] = useState<"nota" | "todas">("nota");
  const { title, style, index } = nota;
  const etiqueta = index >= 0 ? `Nota ${index + 1}` : "Nota";
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="flex flex-wrap items-center gap-1 text-xs text-[var(--fg-muted)]">
          Portada <ChevronRight size={12} aria-hidden /> Tarjetas <ChevronRight size={12} aria-hidden />
          <span className="font-semibold text-[var(--fg)]">{etiqueta}</span>
        </p>
        <p className="mt-1 line-clamp-2 text-sm font-bold leading-snug">{title}</p>
      </div>

      <div role="group" aria-label="Alcance del cambio" className="grid grid-cols-2 gap-1 rounded-lg border border-[var(--border)] p-1">
        {(
          [
            ["nota", "Solo esta nota"],
            ["todas", "Todas las tarjetas"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={alcance === id}
            onClick={() => setAlcance(id)}
            className={`rounded-md px-2 py-1.5 text-xs font-semibold transition ${
              alcance === id ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {alcance === "nota" ? (
        <>
          <Inspector style={style} showSpan={index >= 6} onChange={onChange} onClear={onClear} />
          <details className="group rounded-[var(--radius)] border border-[var(--border)]">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-semibold">
              Más ajustes de esta nota
              <span className="ml-auto text-xs font-normal text-[var(--fg-muted)]">posición, fondo, forma…</span>
            </summary>
            <div className="border-t border-[var(--border)] p-3">
              <BlockStyleEditor bare title={title} style={style} onChange={onChange} onClear={onClear} zone={zone} />
            </div>
          </details>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="rounded-[var(--radius)] bg-[var(--surface-2)] p-3 text-xs leading-relaxed text-[var(--fg-muted)]">
            Estos ajustes valen para <strong>todas</strong> las tarjetas de la portada, no solo para la nota elegida.
          </p>
          <RegionEditor value={layout.regions ?? {}} active="cards" onActive={() => {}} onChange={onRegions} only={["cards"]} hideTabs />
        </div>
      )}
    </div>
  );
}
