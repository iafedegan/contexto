"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ALTO_GAM, GAM_RED, TAMANOS_GAM, nombreUnidadGam, prefijoGam, type UnidadGam } from "@/lib/gam";

// Tipos mínimos de Google Publisher Tag (se carga por script).
type Slot = unknown;
type Gpt = {
  cmd: Array<() => void>;
  defineSlot: (ruta: string, tamanos: number[][], id: string) => { addService: (s: unknown) => Slot } | null;
  pubads: () => {
    enableSingleRequest?: () => void;
    collapseEmptyDivs?: () => void;
    addEventListener?: (tipo: "slotRenderEnded", f: (e: { slot: Slot; isEmpty: boolean }) => void) => void;
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

/**
 * Un espacio de Google Ad Manager. Reserva su alto desde el inicio (sin saltos) y solo carga Google cuando el espacio está por entrar en
 * pantalla, así los anuncios nunca compiten con el contenido ni con el LCP. La sección (y por tanto la unidad) sale de la dirección.
 */
export function GamSlot({ unidad, className }: { unidad: UnidadGam; className?: string }) {
  const pathname = usePathname() ?? "/";
  const prefijo = prefijoGam(pathname);
  const id = `gam-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const caja = useRef<HTMLDivElement>(null);
  // Sin campaña para este espacio: se oculta entero (también el rótulo «Publicidad»).
  const [vacio, setVacio] = useState(false);

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
          if (e.slot === slot) setVacio(e.isEmpty);
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
      window.googletag?.cmd.push(() => {
        const g = window.googletag as Gpt;
        if (slot) g.destroySlots([slot]);
      });
    };
  }, [id, prefijo, unidad]);

  if (!prefijo) return null;
  return (
    <div className={className} hidden={vacio}>
      <span className="mb-1 block text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--fg-muted)]">Publicidad</span>
      <div ref={caja} id={id} className="mx-auto flex items-center justify-center" style={{ minHeight: ALTO_GAM[unidad] }} />
    </div>
  );
}
