"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { GAM_RED, TAMANOS_GAM, nombreUnidadGam, prefijoGam, type UnidadGam } from "@/lib/gam";

// Tipos mínimos de Google Publisher Tag (se carga por script).
type Slot = unknown;
type Gpt = {
  cmd: Array<() => void>;
  defineSlot: (ruta: string, tamanos: number[][], id: string) => { addService: (s: unknown) => Slot } | null;
  pubads: () => {
    enableSingleRequest?: () => void;
    collapseEmptyDivs?: () => void;
    addEventListener?: (tipo: "slotRenderEnded", f: (e: { slot: Slot; isEmpty: boolean; size: number[] | string | null }) => void) => void;
  };
  enableServices: () => void;
  display: (id: string) => void;
  destroySlots: (s?: Slot[]) => boolean;
};
declare global {
  interface Window {
    googletag?: Partial<Gpt> & { cmd: Array<() => void> };
    __gptCargado?: boolean;
    __gptServicios?: boolean;
  }
}

// Carga gpt.js una sola vez (async, sin bloquear nada).
function cargarGpt() {
  window.googletag = window.googletag ?? { cmd: [] };
  if (window.__gptCargado) return;
  window.__gptCargado = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://securepubads.g.doubleclick.net/tag/js/gpt.js";
  document.head.appendChild(s);
}

// Espacios de un mismo grupo (la barra lateral): se coordinan para que, si llega un anuncio grande, no se apilen más de dos.
const GRANDE = 500;
type Registro = { alto: number; el: HTMLElement };
const grupos = new Map<string, Map<string, Registro>>();
const oyentes = new Set<() => void>();
function registrar(grupo: string, id: string, alto: number, el: HTMLElement) {
  if (!grupos.has(grupo)) grupos.set(grupo, new Map());
  grupos.get(grupo)!.set(id, { alto, el });
  oyentes.forEach((f) => f());
}
function quitar(grupo: string, id: string) {
  grupos.get(grupo)?.delete(id);
  oyentes.forEach((f) => f());
}
/** Con un anuncio grande en el grupo se queda UN grande y UN pequeño (los primeros en la página); los demás se ocultan. */
function sobra(grupo: string | undefined, id: string): boolean {
  const m = grupo ? grupos.get(grupo) : undefined;
  const yo = m?.get(id);
  if (!m || !yo || yo.alto <= 0) return false;
  const conAnuncio = [...m.entries()].filter(([, v]) => v.alto > 0);
  if (!conAnuncio.some(([, v]) => v.alto >= GRANDE)) return false;
  const delMismoTamano = conAnuncio
    .filter(([, v]) => (v.alto >= GRANDE) === (yo.alto >= GRANDE))
    .sort((a, b) => (a[1].el.compareDocumentPosition(b[1].el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  return delMismoTamano[0][0] !== id;
}

/**
 * Un espacio de Google Ad Manager. Reserva su alto desde el inicio (sin saltos) y solo carga Google cuando el espacio está por entrar en
 * pantalla, así los anuncios nunca compiten con el contenido ni con el LCP. La sección (y por tanto la unidad) sale de la dirección.
 */
// Con `completo`, el anuncio se amplía (sin deformarlo ni recortarlo) hasta ocupar el ancho disponible, pero sin pasar de este alto en px
// (un 728×90 llenando 1.400 px medía ~175 de alto): si no llega al ancho completo, queda centrado.
const ESCALA_MAX = 2.2;
const ALTO_MAX_COMPLETO = 120;

export function GamSlot({ unidad, className, grupo, completo = false }: { unidad: UnidadGam; className?: string; grupo?: string; completo?: boolean }) {
  const pathname = usePathname() ?? "/";
  const prefijo = prefijoGam(pathname);
  const id = `gam-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const caja = useRef<HTMLDivElement>(null);
  const horizontal = unidad === "b5" || unidad === "b6";
  // Alto del anuncio que Google pintó. Mientras no llegue (o si no hay campaña) el espacio no ocupa nada ni muestra el rótulo:
  // nunca queda una franja vacía con «Publicidad».
  const [altoReal, setAltoReal] = useState<number | null>(null);
  // Tamaño (ancho) del anuncio pintado y escala para ocupar todo el ancho disponible (solo con `completo`).
  const [anchoReal, setAnchoReal] = useState<number | null>(null);
  const [escala, setEscala] = useState(1);
  const fuera = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = fuera.current;
    if (!completo || !anchoReal || !altoReal || !el) return;
    const calcular = () => setEscala(Math.min(ESCALA_MAX, ALTO_MAX_COMPLETO / altoReal, Math.max(0.3, el.clientWidth / anchoReal)));
    calcular();
    const ro = new ResizeObserver(calcular);
    ro.observe(el);
    return () => ro.disconnect();
  }, [completo, anchoReal, altoReal]);
  // Se vuelve a dibujar cuando otro espacio del grupo cambia (llegó un anuncio grande).
  const [, avisar] = useState(0);
  useEffect(() => {
    const f = () => avisar((n) => n + 1);
    oyentes.add(f);
    return () => {
      oyentes.delete(f);
    };
  }, []);

  useEffect(() => {
    const el = caja.current;
    if (!el || !prefijo) return;
    let slot: Slot | null = null;
    const mostrar = () => {
      cargarGpt();
      window.googletag!.cmd.push(() => {
        const g = window.googletag as Gpt;
        slot = g.defineSlot(`/${GAM_RED}/${nombreUnidadGam(prefijo, unidad)}`, TAMANOS_GAM[unidad], id)?.addService(g.pubads()) ?? null;
        g.pubads().addEventListener?.("slotRenderEnded", (e) => {
          if (e.slot !== slot) return;
          const alto = !e.isEmpty && Array.isArray(e.size) && typeof e.size[1] === "number" && e.size[1] > 1 ? e.size[1] : null;
          setAltoReal(alto);
          setAnchoReal(alto && typeof e.size?.[0] === "number" ? e.size[0] : null);
          if (grupo) registrar(grupo, id, alto ?? 0, el);
        });
        if (!window.__gptServicios) {
          g.pubads().enableSingleRequest?.();
          // Como en el sitio anterior: si Ad Manager no tiene campaña para el espacio, se pliega en vez de dejar el hueco.
          g.pubads().collapseEmptyDivs?.();
          g.enableServices();
          window.__gptServicios = true;
        }
        g.display(id);
      });
    };
    const io = new IntersectionObserver(
      (e) => {
        if (e.some((x) => x.isIntersecting)) {
          io.disconnect();
          mostrar();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (grupo) quitar(grupo, id);
      window.googletag?.cmd.push(() => {
        const g = window.googletag as Gpt;
        if (slot) g.destroySlots([slot]);
      });
    };
  }, [id, prefijo, unidad, grupo]);

  if (!prefijo) return null;
  return (
    // Sin anuncio pintado, el contenedor no suma márgenes ni alto (las clases de margen solo se aplican con anuncio).
    <div className={altoReal ? cn(className, horizontal && "py-1") : "w-full"} hidden={sobra(grupo, id)}>
      {/* Rótulo arriba y el anuncio debajo. Los banners horizontales van pegados a la derecha, con el rótulo también a la derecha y casi sin aire. */}
      {altoReal && <span className={cn("block text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--fg-muted)]", horizontal ? (completo ? "mb-1 text-center" : "mb-1 text-right") : "mb-1")}>Publicidad</span>}
      {/* 1 px mientras espera: el observador necesita un elemento en la página para saber cuándo pedir el anuncio. */}
      <div ref={fuera} className={completo ? "flex w-full justify-center overflow-hidden" : undefined} style={completo && altoReal ? { height: altoReal * escala } : undefined}>
        {/* Con `completo`, una envoltura del tamaño ya ampliado centra el anuncio escalado (la escala no cambia el espacio que ocupa). */}
        <div className={completo && anchoReal ? "flex-none overflow-hidden" : "w-full"} style={completo && anchoReal && altoReal ? { width: anchoReal * escala, height: altoReal * escala } : undefined}>
          <div
            ref={caja}
            id={id}
            className={cn("flex items-start [&_iframe]:rounded-lg", completo ? undefined : horizontal ? "justify-end" : "mx-auto justify-center")}
            style={completo && anchoReal ? { minHeight: altoReal ?? 1, width: anchoReal, transform: `scale(${escala})`, transformOrigin: "top left" } : { minHeight: altoReal ?? 1 }}
          />
        </div>
      </div>
    </div>
  );
}
