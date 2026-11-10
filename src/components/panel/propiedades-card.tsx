"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, MousePointerClick, X } from "lucide-react";
import type { HomeStyle, SectionElId, SectionElStyle } from "@/db/schema";
import { PIEZAS_CABECERA, PiezaCabeceraEditor } from "@/components/panel/pieza-cabecera-editor";
import { BlockStyleEditor, type ZoneBundle } from "@/components/panel/block-style-editor";
import { Inspector } from "@/components/panel/portada-controls";
import type { Layout } from "@/components/panel/portada-types";
import { RegionEditor } from "@/components/panel/region-editor";
import { MenuNavbarEditor } from "@/components/panel/menu-navbar-editor";
import type { MenuNavbar } from "@/lib/menu-navbar";
import type { Pantalla } from "@/lib/pantallas";
import { TextosCabeceraEditor } from "@/components/panel/textos-cabecera-editor";
import type { TextosCabecera } from "@/lib/textos-cabecera";
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
  pantalla = "pc",
  onRegions,
  onTextos,
  onMenu,
  pieza = null,
  onPieza,
  onSectionEls,
  secciones,
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
  /** Pantalla que se edita. */
  pantalla?: Pantalla;
  onRegions: (next: RegionStyles) => void;
  /** Cambia el título, subtítulo o fecha de la cabecera (`undefined` = los del sitio). */
  onTextos: (next: TextosCabecera | undefined) => void;
  /** Cambia el menú de la barra (`undefined` = el original). */
  onMenu: (next: MenuNavbar | undefined) => void;
  /** Pieza de la cabecera elegida (nombre, logo, fecha…); `null` = toda la cabecera. */
  pieza?: SectionElId | null;
  onPieza?: (p: SectionElId | null) => void;
  /** Cambia el estilo de las piezas sueltas (de la pantalla que se edita). */
  onSectionEls?: (next: Partial<Record<SectionElId, SectionElStyle>>) => void;
  /** Secciones principales del sitio, para elegir cuáles se muestran en la barra. */
  secciones: { slug: string; name: string }[];
  /** La nota elegida: su posición (-1 si no está en la lista), título y estilo actual. */
  nota: { index: number; title: string; style: HomeStyle; enLienzo?: boolean } | null;
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
            {/* Cabecera: primero se elige QUÉ pieza (o toda la cabecera) y después se ve todo lo que se le puede hacer a esa pieza. */}
            {region === "navbar" && onPieza && (
              <div>
                <p className="mb-1.5 text-[0.95rem] font-extrabold text-[#0b0b0b]">¿Qué quieres cambiar?</p>
                <div className="flex flex-wrap gap-1.5">
                  {[{ id: null, label: "Toda la cabecera", hint: "Fondo, colores generales y medidas" }, ...PIEZAS_CABECERA].map((x) => {
                    const on = pieza === x.id;
                    const tocada = x.id ? !!layout.sectionEls?.[x.id] : false;
                    return (
                      <button
                        key={x.id ?? "toda"}
                        type="button"
                        title={x.hint}
                        aria-pressed={on}
                        onClick={() => onPieza(x.id)}
                        className={`relative rounded-full border px-3 py-1 text-xs font-semibold transition ${on ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--border)] bg-white hover:border-[var(--accent)]"}`}
                      >
                        {x.label}
                        {tocada && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[#c9a227]" aria-label="modificado" />}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-[var(--fg-muted)]">También puedes hacer clic en la pieza dentro de la página.</p>
              </div>
            )}
            {region === "navbar" && pieza && onSectionEls ? (
              <>
                <PiezaCabeceraEditor
                  key={pieza}
                  el={pieza}
                  style={layout.sectionEls?.[pieza] ?? {}}
                  onChange={(st) => {
                    const next = { ...(layout.sectionEls ?? {}) };
                    if (st) next[pieza] = st;
                    else delete next[pieza];
                    onSectionEls(next);
                  }}
                />
                {/* Lo que no es de aspecto pero sí de esa pieza: el texto que dice o qué enlaces muestra. */}
                {(pieza === "h-nombre" || pieza === "h-lema" || pieza === "h-fecha") && <TextosCabeceraEditor value={layout.textos} onChange={onTextos} />}
                {pieza === "h-menu" && <MenuNavbarEditor value={layout.menuNav} onChange={onMenu} secciones={secciones} conAspecto={pantalla === "pc"} />}
                {pieza === "h-cintillo" && <p className="text-xs leading-snug text-[var(--fg-muted)]">Qué titulares lleva y a qué velocidad corre se ajusta en el bloque «Cintillo de titulares», más abajo.</p>}
              </>
            ) : (
              <>
                {/* Lo de cada pieza (textos, menú, tipografía) vive en su pieza: aquí solo lo de toda la cabecera, sin repetir. */}
                <RegionEditor value={layout.regions ?? {}} active={region} onActive={onRegion} onChange={onRegions} only={PARTES} />
              </>
            )}
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
  nota: { index: number; title: string; style: HomeStyle; enLienzo?: boolean };
  layout: Layout;
  onRegions: (next: RegionStyles) => void;
  onChange: (p: Partial<HomeStyle>) => void;
  onClear: () => void;
  zone: ZoneBundle;
}) {
  const [alcance, setAlcance] = useState<"nota" | "todas">("nota");
  // Dos pestañas, para no mezclar: «Edición» (dónde está la nota y qué tamaño tiene) y «Estilo» (letras, colores, fondo y forma).
  const [pestana, setPestana] = useState<"edicion" | "estilo">("edicion");
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
        {nota.enLienzo === false && (
          <p className="mt-2 rounded-[var(--radius)] bg-[var(--surface-2)] p-2 text-xs leading-snug text-[var(--fg-muted)]">
            Esta plantilla no muestra esta nota como un bloque propio en esta página: sus ajustes se guardan, pero aquí no se verán.
          </p>
        )}
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
          <div role="tablist" aria-label="Qué quieres cambiar de esta nota" className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--surface-2)] p-1">
            {(
              [
                ["edicion", "Edición", "Dónde está y qué tamaño tiene"],
                ["estilo", "Estilo", "Letras, colores y forma"],
              ] as const
            ).map(([id, nombre, ayuda]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={pestana === id}
                onClick={() => setPestana(id)}
                className={`flex flex-col items-center rounded-lg px-2 py-2 text-center transition ${pestana === id ? "bg-white text-[var(--fg)] shadow-sm" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}
              >
                <span className="text-sm font-bold">{nombre}</span>
                <span className="text-[11px] leading-tight">{ayuda}</span>
              </button>
            ))}
          </div>
          {pestana === "edicion" ? (
            <BlockStyleEditor bare parte="edicion" title={title} style={style} onChange={onChange} onClear={onClear} zone={zone} />
          ) : (
          <>
          <Inspector style={style} showSpan={index >= 6 && layout.templateId !== "gremial"} showTextPos={index === 0 && layout.templateId === "esmeralda"} showSize={["esmeralda", "revista"].includes(layout.templateId)} showImage={["esmeralda", "revista"].includes(layout.templateId) || (layout.templateId === "clasico" && (index < 2 || index >= 6))} onChange={onChange} onClear={onClear} />
          <details className="group rounded-[var(--radius)] border border-[var(--border)]">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-semibold">
              Más estilos de esta nota
              <span className="ml-auto text-xs font-normal text-[var(--fg-muted)]">fondo, texto, forma…</span>
            </summary>
            <div className="border-t border-[var(--border)] p-3">
              <BlockStyleEditor bare parte="estilo" title={title} style={style} onChange={onChange} onClear={onClear} />
            </div>
          </details>
          </>
          )}
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
