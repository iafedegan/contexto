"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Alto de la ventana, para decidir cuántas filas caben sin que la página se desplace. */
export function useAltoVentana(): number {
  const [alto, setAlto] = useState(900);
  useEffect(() => {
    const medir = () => setAlto(window.innerHeight);
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);
  return alto;
}

/** Alto fijo (px) del asistente que no es contenido del paso: pasos, márgenes, título del paso, relleno de la tarjeta y barra de navegación. */
const CROMO_ASISTENTE = 332;

/**
 * Cuántas filas de `altoFila` px caben en una lista de un paso, dado el alto de la ventana y los `fijo` px de controles
 * propios del paso (buscador, filtros, navegador del carrusel…). Nunca baja de `min` ni sube de `max`.
 */
export function filasListas(alto: number, fijo: number, altoFila: number, min = 2, max = 14): number {
  return Math.max(min, Math.min(max, Math.floor((alto - CROMO_ASISTENTE - fijo) / altoFila)));
}

/**
 * Carrusel por páginas: en vez de una lista larga que obliga a desplazarse, muestra `filas` × `columnas` elementos y
 * se cambia de página con flechas, puntos, teclado (← →) o deslizando el dedo. Las columnas salen del ancho
 * disponible (`anchoMinimo` por elemento), así que en el celular son una sola.
 *
 * Todas las páginas comparten la misma altura (la de la más alta): el contenedor no salta al cambiar de página.
 */
export function Carrusel<T>({
  items,
  render,
  filas = 1,
  anchoMinimo = 260,
  maxColumnas = 3,
  etiqueta,
  paginaInicial = 0,
  separacion = "gap-2.5",
  className = "",
}: {
  items: T[];
  render: (item: T, indice: number) => React.ReactNode;
  filas?: number;
  anchoMinimo?: number;
  maxColumnas?: number;
  /** Nombre accesible del carrusel (qué se está recorriendo). */
  etiqueta: string;
  paginaInicial?: number;
  /** Clase de `gap` entre elementos (por defecto 10 px; las listas de filas apretadas usan `gap-0.5`). */
  separacion?: string;
  className?: string;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [columnas, setColumnas] = useState(1);
  const [pagina, setPagina] = useState(paginaInicial);
  const inicioToque = useRef<number | null>(null);

  // Columnas según el ancho real del contenedor (no de la ventana).
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setColumnas(Math.max(1, Math.min(maxColumnas, Math.floor((el.clientWidth + 12) / (anchoMinimo + 12)))));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [anchoMinimo, maxColumnas]);

  const porPagina = Math.max(1, columnas * filas);
  const paginas = Math.max(1, Math.ceil(items.length / porPagina));
  // Si cambia la cantidad por página o la lista, no se queda en una página que ya no existe.
  const actual = Math.min(pagina, paginas - 1);
  const ir = useCallback((p: number) => setPagina(Math.max(0, Math.min(paginas - 1, p))), [paginas]);

  const desde = actual * porPagina + 1;
  const hasta = Math.min(items.length, (actual + 1) * porPagina);

  return (
    <div
      role="group"
      aria-roledescription="carrusel"
      aria-label={etiqueta}
      className={`flex min-w-0 flex-col gap-2.5 ${className}`}
      onKeyDown={(e) => {
        if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        if (e.key === "ArrowRight") ir(actual + 1);
        if (e.key === "ArrowLeft") ir(actual - 1);
      }}
    >
      <div
        ref={caja}
        className="overflow-hidden"
        onTouchStart={(e) => (inicioToque.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          const x0 = inicioToque.current;
          inicioToque.current = null;
          if (x0 === null) return;
          const dx = e.changedTouches[0].clientX - x0;
          if (Math.abs(dx) > 50) ir(actual + (dx < 0 ? 1 : -1));
        }}
      >
        <div
          className="grid grid-flow-col auto-cols-[100%] transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${actual * 100}%)` }}
        >
          {Array.from({ length: paginas }, (_, p) => (
            <ul
              key={p}
              aria-label={`Página ${p + 1} de ${paginas}`}
              // Las páginas ocultas no reciben foco ni las lee un lector de pantalla.
              inert={p !== actual}
              aria-hidden={p !== actual}
              className={`grid content-start ${separacion}`}
              style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}
            >
              {items.slice(p * porPagina, (p + 1) * porPagina).map((item, k) => (
                <li key={k} className="flex min-w-0">
                  <div className="flex w-full min-w-0 flex-col">{render(item, p * porPagina + k)}</div>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>

      {paginas > 1 && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs tabular-nums text-[var(--fg-muted)]" aria-live="polite">
            {desde === hasta ? desde : `${desde}–${hasta}`} de {items.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => ir(actual - 1)}
              disabled={actual === 0}
              aria-label="Página anterior"
              className="grid size-8 place-items-center rounded-full border border-[var(--border)] bg-[var(--bg-2)] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} aria-hidden />
            </button>
            <div className="flex items-center gap-1.5" role="presentation">
              {Array.from({ length: paginas }, (_, p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => ir(p)}
                  aria-label={`Ir a la página ${p + 1}`}
                  aria-current={p === actual ? "true" : undefined}
                  className={`h-2 rounded-full transition-all ${p === actual ? "w-5 bg-[var(--accent)]" : "w-2 bg-[var(--border-strong,var(--border))] hover:bg-[var(--accent)]/60"}`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => ir(actual + 1)}
              disabled={actual === paginas - 1}
              aria-label="Página siguiente"
              className="grid size-8 place-items-center rounded-full border border-[var(--border)] bg-[var(--bg-2)] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
