"use client";

import { useState, type ReactNode } from "react";

// Subpestañas dentro de una sección: todas quedan montadas (con `hidden`) para no perder lo que se esté escribiendo al cambiar.
export function SubTabs({ tabs }: { tabs: { id: string; label: string; contenido: ReactNode }[] }) {
  const [activa, setActiva] = useState(tabs[0]?.id);
  return (
    <div>
      <div role="tablist" className="mb-5 flex flex-wrap gap-1.5 border-b border-[var(--border)] pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activa === t.id}
            onClick={() => setActiva(t.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${activa === t.id ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={activa !== t.id}>
          {t.contenido}
        </div>
      ))}
    </div>
  );
}
