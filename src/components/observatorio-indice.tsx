"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Índice del Observatorio que sigue la lectura: en escritorio, una columna a la izquierda con el número y el nombre de
 * cada sección (la de ahora, resaltada y con una barra de progreso); en el celular, una barra de pestañas pegada arriba
 * que también se desplaza sola hasta la sección activa.
 */
export type ItemIndice = { id: string; etiqueta: string };

export function ObservatorioIndice({ items, titulo }: { items: ItemIndice[]; titulo: string }) {
  const [activa, setActiva] = useState(items[0]?.id ?? "");
  const [progreso, setProgreso] = useState(0);
  const barra = useRef<HTMLUListElement>(null);

  // La sección activa es la que cruza una línea a un tercio de la pantalla.
  useEffect(() => {
    const secciones = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => e !== null);
    const alMover = () => {
      const linea = window.innerHeight * 0.33;
      let actual = secciones[0]?.id ?? "";
      for (const s of secciones) if (s.getBoundingClientRect().top <= linea) actual = s.id;
      setActiva(actual);
      const ultima = secciones[secciones.length - 1];
      const fin = ultima ? ultima.getBoundingClientRect().bottom + window.scrollY : 1;
      const inicio = (secciones[0]?.getBoundingClientRect().top ?? 0) + window.scrollY;
      setProgreso(Math.min(1, Math.max(0, (window.scrollY + linea - inicio) / Math.max(1, fin - inicio))));
    };
    alMover();
    window.addEventListener("scroll", alMover, { passive: true });
    window.addEventListener("resize", alMover);
    return () => {
      window.removeEventListener("scroll", alMover);
      window.removeEventListener("resize", alMover);
    };
  }, [items]);

  // En la barra del celular, la pestaña activa se mantiene a la vista.
  useEffect(() => {
    barra.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [activa]);

  return (
    <>
      {/* Celular y tableta: barra pegada arriba. */}
      <nav aria-label={titulo} className="sticky top-0 z-30 -mx-4 border-y border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md sm:mx-0 sm:rounded-full sm:border md:top-[4.5rem] lg:hidden">
        <ul ref={barra} className="flex gap-1 overflow-x-auto px-3 py-1.5">
          {items.map((i) => (
            <li key={i.id} className="shrink-0">
              <a href={`#${i.id}`} aria-current={activa === i.id ? "true" : undefined}
                className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold transition ${activa === i.id ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--accent)]"}`}>
                {i.etiqueta}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Escritorio: columna lateral con progreso. */}
      <nav aria-label={titulo} className="sticky top-28 hidden self-start lg:block">
        <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--fg-muted)]">{titulo}</p>
        <div className="relative border-l border-[var(--border)] pl-1">
          <span aria-hidden className="absolute -left-px top-0 w-px bg-[var(--accent)] transition-[height] duration-200" style={{ height: `${progreso * 100}%` }} />
          <ul className="flex flex-col">
            {items.map((i, n) => (
              <li key={i.id}>
                <a href={`#${i.id}`} aria-current={activa === i.id ? "true" : undefined}
                  className={`group flex min-h-10 items-center gap-3 rounded-r-[var(--radius)] py-2 pl-3 pr-2 text-sm font-semibold transition ${activa === i.id ? "bg-[var(--surface-2)] text-[var(--accent)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>
                  <span className="w-5 text-xs tabular-nums opacity-60">{String(n + 1).padStart(2, "0")}</span>
                  {i.etiqueta}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </>
  );
}
