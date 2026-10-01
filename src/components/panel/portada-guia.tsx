"use client";

import { MousePointerClick, Rocket, SlidersHorizontal, X } from "lucide-react";

/** «Cómo funciona»: los tres pasos del editor, para quien lo abre por primera vez. */
export function PortadaGuia({ onClose }: { onClose: () => void }) {
  const pasos = [
    { Icon: MousePointerClick, t: "Elige qué cambiar", d: "Haz clic en una parte de la página: la cabecera, una nota, el pie… Pasa el ratón por encima para ver qué es." },
    { Icon: SlidersHorizontal, t: "Ajústalo aquí", d: "Los controles de lo que elegiste aparecen en «Propiedades», arriba de este menú." },
    { Icon: Rocket, t: "Publica cuando estés listo", d: "Todo queda en borrador. El sitio no cambia hasta que pulses «Publicar cambios»." },
  ];
  return (
    <section aria-label="Cómo funciona el editor" className="rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-2)] p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold">Cómo funciona</p>
        <button type="button" onClick={onClose} aria-label="Cerrar la guía" className="rounded-full p-1 text-[var(--fg-muted)] hover:text-[var(--fg)]">
          <X size={14} />
        </button>
      </div>
      <ol className="mt-3 flex flex-col gap-3">
        {pasos.map(({ Icon, t, d }, i) => (
          <li key={t} className="flex items-start gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--accent-fg)]">{i + 1}</span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-semibold"><Icon size={14} className="text-[var(--accent)]" /> {t}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-[var(--fg-muted)]">{d}</span>
            </span>
          </li>
        ))}
      </ol>
      <button type="button" onClick={onClose} className="mt-3 inline-flex h-8 items-center rounded-full bg-[var(--accent)] px-4 text-xs font-semibold text-[var(--accent-fg)]">
        Entendido
      </button>
    </section>
  );
}
