"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Cabeceras altas (título grande + fila de secciones): al desplazarse solo se
 * queda pegada la fila de secciones; el título se va con la página.
 *
 * Una cabecera de ~280 px fija ocupaba un tercio de la pantalla de un
 * portátil. En vez de partir la cabecera en dos (rompería `data-region` y los
 * estilos que el editor aplica a la región), se mantiene entera y `sticky` con
 * un `top` NEGATIVO igual a lo que hay antes de la fila: la cabecera sube hasta
 * que solo queda visible esa fila y ahí se pega. No mueve nada (sticky no
 * altera el flujo), y sin JavaScript queda como estaba (pegada entera).
 *
 * Se coloca dentro de la `<header>`; `rail` es el selector de la fila que debe
 * quedar a la vista (por defecto, el primer `<nav>` de la cabecera).
 */
export function StickyRail({ rail = "nav" }: { rail?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const header = ref.current?.closest("header");
    if (!header) return;
    // Mide el espacio disponible para fijar la columna.
    const medir = () => {
      const fila = header.querySelector<HTMLElement>(rail);
      // Cabecera oculta (display:none en móvil) o sin fila: nada que medir.
      if (!fila || header.offsetParent === null) return;
      const antes = fila.getBoundingClientRect().top - header.getBoundingClientRect().top;
      header.style.setProperty("--stick-top", `${-Math.max(0, Math.round(antes))}px`);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(header);
    // Las fuentes web cambian la altura del título al terminar de cargar.
    document.fonts?.ready.then(medir).catch(() => {});
    return () => ro.disconnect();
  }, [rail]);

  return <span ref={ref} hidden aria-hidden />;
}
