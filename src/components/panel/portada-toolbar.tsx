"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  Maximize2,
  Minimize2,
  Monitor,
  MoreHorizontal,
  RotateCcw,
  Redo2,
  Smartphone,
  SlidersHorizontal,
  Tablet,
  Undo2,
  Wand2,
} from "lucide-react";
import type { ChangeLine } from "@/lib/portada-summary";
import { PublicarControles } from "@/components/panel/portada-publicar";
import type { Zoom } from "@/components/panel/preview-frame";

// Tamaño de pantalla simulado en la vista previa.
export type Viewport = "escritorio" | "tablet" | "movil";

// Propiedades de la barra de herramientas del editor.
type Props = {
  /** Qué cambia al publicar (incluye advertencias). */
  changes: ChangeLine[];
  /** Cuántos cambios hay (sin contar advertencias). */
  count: number;
  onPublish: () => Promise<{ ok: boolean; message?: string }>;
  onDiscard: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  viewport: Viewport;
  onViewport: (v: Viewport) => void;
  /** En una página de sección: botón para volver a la portada. */
  inSection: boolean;
  onBackHome: () => void;
  onResetOriginal: () => void;
  onGuide: () => void;
  /** Hay una publicación reciente que se puede deshacer. */
  canUndoPublish: boolean;
  onUndoPublish: () => void;
  /** Escala de la vista previa, marco de dispositivo y lienzo ampliado. */
  zoom: Zoom;
  onZoom: (z: Zoom) => void;
  framed: boolean;
  onFramed: (v: boolean) => void;
  ampliado: boolean;
  onAmpliado: (v: boolean) => void;
  /** Bloquea todo (p. ej. mientras se decide si retomar un borrador). */
  disabled?: boolean;
};

// Tamaños de pantalla disponibles.
const VIEWPORTS = [
  ["escritorio", Monitor, "Mac"],
  ["tablet", Tablet, "iPad"],
  ["movil", Smartphone, "iPhone"],
] as const;

/**
 * Barra del lienzo. El estado de la portada siempre a la vista — «Publicado» o
 * «Borrador · N cambios» — y UNA sola forma de publicar: el botón «Publicar
 * cambios» enseña la lista de lo que cambia y pide confirmar. Deshacer, rehacer
 * y las acciones poco frecuentes (volver al diseño original…) van aparte.
 */
export function PortadaToolbar(p: Props) {
  const [menu, setMenu] = useState(false);
  const [vista, setVista] = useState(false);
  const menuWrap = useRef<HTMLDivElement>(null);
  const vistaWrap = useRef<HTMLDivElement>(null);

  // Cerrar los desplegables al pulsar fuera o con Escape.
  useEffect(() => {
    if (!menu && !vista) return;
    // Cierra el menú al pulsar fuera.
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menu && menuWrap.current && !menuWrap.current.contains(t)) setMenu(false);
      if (vista && vistaWrap.current && !vistaWrap.current.contains(t)) setVista(false);
    };
    // Cierra el menú con la tecla Escape.
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        setVista(false);
      }
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [menu, vista]);

  const iconBtn =
    "inline-flex size-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--fg)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--fg)]";

  return (
    <div
      data-theme="panel-ui"
      data-tour="barra"
      className="sticky z-30 flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-[var(--fg)] shadow-[var(--shadow)]"
      style={{ top: "calc(var(--panel-header-h, 0px) + 0.75rem)" }}
    >
      <a
        href="#propiedades"
        className="sr-only focus:not-sr-only focus:rounded-full focus:bg-[var(--accent)] focus:px-3 focus:py-1.5 focus:text-xs focus:font-semibold focus:text-[var(--accent-fg)]"
      >
        Saltar a las opciones
      </a>
      {/* ------------------------------------------------ Estado y publicar */}
      <PublicarControles changes={p.changes} count={p.count} onPublish={p.onPublish} onDiscard={p.onDiscard} disabled={p.disabled} />

      {/* --------------------------------------------- Deshacer / rehacer */}
      <div className="flex items-center gap-1">
        <button type="button" onClick={p.onUndo} disabled={!p.canUndo || p.disabled} className={iconBtn} aria-label="Deshacer" title="Deshacer (Cmd/Ctrl + Z)">
          <Undo2 size={16} />
        </button>
        <button type="button" onClick={p.onRedo} disabled={!p.canRedo || p.disabled} className={iconBtn} aria-label="Rehacer" title="Rehacer (Mayús + Cmd/Ctrl + Z)">
          <Redo2 size={16} />
        </button>
      </div>

      {/* ------------------------------------------------ Dispositivo */}
      <div role="group" aria-label="Tamaño de pantalla de la vista previa" className="flex items-center gap-0.5 rounded-full border border-[var(--border)] p-0.5">
        {VIEWPORTS.map(([id, Icono, etiqueta]) => (
          <button
            key={id}
            type="button"
            onClick={() => p.onViewport(id)}
            aria-pressed={p.viewport === id}
            title={`Ver como en ${etiqueta}`}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${
              p.viewport === id ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--fg-muted)] hover:text-[var(--accent)]"
            }`}
          >
            <Icono size={14} /> {etiqueta}
          </button>
        ))}
      </div>

      <div ref={vistaWrap} className="relative">
        <button
          type="button"
          onClick={() => setVista((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={vista}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3.5 text-xs font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <SlidersHorizontal size={13} /> Vista
          <ChevronDown size={12} className={vista ? "rotate-180 transition-transform" : "transition-transform"} aria-hidden />
        </button>
        {vista && (
          <div role="menu" className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-72 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg)] p-3 shadow-2xl">
            <p className="meta mb-1.5">Tamaño de la página</p>
            <div role="group" aria-label="Zoom" className="grid grid-cols-3 gap-1 rounded-lg border border-[var(--border)] p-1">
              {([["ajustar", "Ajustar"], [0.75, "75 %"], [1, "100 %"]] as const).map(([z, label]) => (
                <button
                  key={String(z)}
                  type="button"
                  aria-pressed={p.zoom === z}
                  onClick={() => p.onZoom(z)}
                  className={`rounded-md px-2 py-1.5 text-xs font-semibold transition ${p.zoom === z ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs leading-snug text-[var(--fg-muted)]">«Ajustar» llena el ancho disponible. A 100 % la página se desplaza.</p>

            <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm">
              <input type="checkbox" checked={p.framed} onChange={(e) => p.onFramed(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
              <span><span className="block font-medium">Marco de dispositivo</span><span className="block text-xs text-[var(--fg-muted)]">Dibuja el Mac, iPad o iPhone alrededor (ocupa espacio).</span></span>
            </label>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => p.onAmpliado(!p.ampliado)}
        aria-pressed={p.ampliado}
        title={p.ampliado ? "Vuelve a mostrar el menú lateral" : "Oculta el menú lateral para ver la página más grande; las opciones salen con el botón «Opciones»"}
        className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition ${
          p.ampliado ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--border-strong)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        }`}
      >
        {p.ampliado ? <Minimize2 size={13} /> : <Maximize2 size={13} />} {p.ampliado ? "Reducir" : "Ampliar"}
      </button>

      {p.inSection && (
        <button
          type="button"
          onClick={p.onBackHome}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3.5 text-xs font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <ArrowLeft size={13} /> Volver a la portada
        </button>
      )}

      <button
        type="button"
        onClick={() => window.open("/panel/portada?vista=1", "_blank")}
        title="Abre la portada a tamaño real en otra pestaña; se actualiza sola mientras editas"
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3.5 text-xs font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        <ExternalLink size={13} /> Vista previa
      </button>

      {/* ----------------------------------------------------- Más acciones */}
      <div ref={menuWrap} className="relative ml-auto">
        <button
          type="button"
          onClick={() => setMenu((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menu}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 text-xs font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <MoreHorizontal size={15} /> Más
        </button>
        {menu && (
          <div role="menu" className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-72 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg)] p-1.5 shadow-2xl">
            <button type="button" role="menuitem" onClick={() => { setMenu(false); p.onGuide(); }} className="flex w-full items-start gap-2.5 rounded-[var(--radius)] px-3 py-2.5 text-left hover:bg-[var(--surface-2)]">
              <CircleHelp size={15} className="mt-0.5 shrink-0 text-[var(--accent)]" />
              <span><span className="block text-sm font-medium">Cómo funciona</span><span className="block text-xs text-[var(--fg-muted)]">Los tres pasos para editar y publicar</span></span>
            </button>
            {p.canUndoPublish && (
              <button type="button" role="menuitem" onClick={() => { setMenu(false); p.onUndoPublish(); }} className="flex w-full items-start gap-2.5 rounded-[var(--radius)] px-3 py-2.5 text-left hover:bg-[var(--surface-2)]">
                <RotateCcw size={15} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                <span><span className="block text-sm font-medium">Deshacer la última publicación</span><span className="block text-xs text-[var(--fg-muted)]">Vuelve el sitio a como estaba antes</span></span>
              </button>
            )}
            <button type="button" role="menuitem" onClick={() => { setMenu(false); p.onResetOriginal(); }} className="flex w-full items-start gap-2.5 rounded-[var(--radius)] px-3 py-2.5 text-left hover:bg-[var(--surface-2)]">
              <Wand2 size={15} className="mt-0.5 shrink-0 text-[var(--accent)]" />
              <span><span className="block text-sm font-medium">Volver al diseño original</span><span className="block text-xs text-[var(--fg-muted)]">Quita estilos y orden manual. Queda en borrador: no se publica solo.</span></span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
