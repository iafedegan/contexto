"use client";

import { useEffect, useRef, useState } from "react";

// Posición del panel.
type Pos = { x: number; y: number };

// Margen mínimo respecto a los bordes de la pantalla.
const MARGIN = 8;
/** Parte del panel que debe seguir visible al arrastrarlo fuera de pantalla. */
const KEEP_VISIBLE = 120;

/**
 * Panel flotante que el editor puede arrastrar a donde quiera.
 *
 * Arrastra solo desde su cabecera (`[data-drag-handle]`): si se pudiera
 * arrastrar desde cualquier punto, cada clic en un botón o deslizador movería
 * el panel. La posición se guarda por panel en `localStorage`, así que
 * sobrevive a recargas y al remontaje tras guardar.
 */
export function DraggablePanel({
  children,
  storageKey,
  side = "right",
  width = "26rem",
}: {
  children: React.ReactNode;
  storageKey: string;
  /** Esquina donde aparece la primera vez, antes de moverlo. */
  side?: "left" | "right";
  width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  // Inicializador perezoso en vez de un efecto: evita el render extra (y el
  // parpadeo del panel saltando de la esquina a su posición guardada).
  const [pos, setPos] = useState<Pos | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as Pos) : null;
    } catch {
      return null;
    }
  });

  // Mantiene el panel dentro de la pantalla.
  function clamp(x: number, y: number): Pos {
    const el = ref.current;
    const w = el?.offsetWidth ?? 380;
    const h = el?.offsetHeight ?? 300;
    return {
      x: Math.min(Math.max(x, MARGIN - (w - KEEP_VISIBLE)), window.innerWidth - KEEP_VISIBLE),
      y: Math.min(Math.max(y, MARGIN), window.innerHeight - Math.min(h, KEEP_VISIBLE)),
    };
  }

  // Si la ventana se encoge, el panel podría quedar fuera de vista.
  useEffect(() => {
    // Recoloca el panel al cambiar el tamaño de la ventana.
    function onResize() {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos(clamp(r.left, r.top));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Guarda la posición del panel.
  function persist(next: Pos) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* modo privado: el panel funciona igual, solo no recuerda la posición */
    }
  }

  // Empieza el arrastre.
  function onPointerDown(e: React.PointerEvent) {
    if (!(e.target as HTMLElement).closest("[data-drag-handle]")) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  // Mueve el panel durante el arrastre.
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setPos(clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy));
  }

  // Termina el arrastre y guarda la posición.
  function onPointerUp(e: React.PointerEvent) {
    if (!drag.current) return;
    drag.current = null;
    ref.current?.releasePointerCapture(e.pointerId);
    const r = ref.current?.getBoundingClientRect();
    if (r) persist({ x: r.left, y: r.top });
  }

  /** Doble clic en la cabecera: vuelve a su esquina. */
  function onDoubleClick(e: React.MouseEvent) {
    if (!(e.target as HTMLElement).closest("[data-drag-handle]")) return;
    setPos(null);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* ignorado */
    }
  }

  /** Con la cabecera enfocada, las flechas mueven el panel de 16 en 16 px. */
  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 48 : 16;
    const delta: Record<string, Pos> = {
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
    };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const next = clamp(r.left + d.x, r.top + d.y);
    setPos(next);
    persist(next);
  }

  const docked =
    side === "right"
      ? "inset-x-4 bottom-4 sm:inset-x-auto sm:right-6"
      : "inset-x-4 bottom-4 sm:inset-x-auto sm:left-6";

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      className={`fixed z-[60] ${pos ? "" : docked}`}
      style={
        pos
          ? { left: pos.x, top: pos.y, width: `min(${width}, calc(100vw - 2rem))` }
          : { width: `min(${width}, calc(100vw - 2rem))` }
      }
    >
      {children}
    </div>
  );
}

/** Cabecera de un panel arrastrable: es la zona por la que se agarra. */
export function DragHandle({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-drag-handle
      tabIndex={0}
      role="button"
      aria-label="Mover el panel (arrastra, o usa las flechas del teclado)"
      title="Arrastra para mover · doble clic para devolverlo a su esquina"
      className="-m-1 flex min-w-0 flex-1 cursor-grab touch-none items-start gap-2 rounded-lg p-1 active:cursor-grabbing"
    >
      <span
        aria-hidden
        className="mt-1 grid shrink-0 grid-cols-2 gap-[3px] opacity-40 transition-opacity group-hover:opacity-70"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="size-[3px] rounded-full bg-current" />
        ))}
      </span>
      {children}
    </div>
  );
}
