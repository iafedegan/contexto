"use client";

import type { SectionFiltersPos } from "@/db/schema";

const OPTIONS: { id: SectionFiltersPos; label: string; hint: string }[] = [
  { id: "cabecera", label: "Junto al título", hint: "A la derecha del título (como viene en cada plantilla)" },
  { id: "izquierda", label: "Debajo · izquierda", hint: "Bajo el título, alineados a la izquierda" },
  { id: "centro", label: "Debajo · centro", hint: "Bajo el título, centrados" },
  { id: "derecha", label: "Debajo · derecha", hint: "Bajo el título, alineados a la derecha" },
  { id: "barra", label: "Barra sobre la lista", hint: "En una barra a todo el ancho, justo encima de las notas" },
  { id: "oculto", label: "Ocultar", hint: "No mostrar filtros en las secciones" },
];

/** Dónde van los filtros de fecha y subsección en las páginas de sección. */
export function SectionFiltersPicker({ value, onChange }: { value: SectionFiltersPos; onChange: (v: SectionFiltersPos) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">Posición de los filtros</p>
      <div className="grid grid-cols-2 gap-1.5">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            title={o.hint}
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
            className={`rounded-[var(--radius)] border px-2.5 py-2 text-left text-xs font-semibold transition ${
              value === o.id ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--border)] bg-white hover:border-[var(--accent)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[0.7rem] text-[var(--fg-muted)]">{OPTIONS.find((o) => o.id === value)?.hint}</p>
    </div>
  );
}
