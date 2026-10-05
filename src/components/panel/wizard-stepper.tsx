"use client";

import { Check } from "lucide-react";

/**
 * Pasos del asistente: círculos numerados unidos por una línea que se va llenando; el paso actual muestra su nombre
 * y, desde pantallas grandes, todos lo muestran. Los completados se pueden pulsar para volver.
 */
export function WizardStepper({ pasos, actual, onGo }: { pasos: readonly { key: string; label: string }[]; actual: number; onGo: (i: number) => void }) {
  return (
    <ol className="flex items-center gap-0 overflow-x-auto pb-1" aria-label="Pasos del asistente">
      {pasos.map((p, i) => {
        const hecho = i < actual;
        const es = i === actual;
        return (
          <li key={p.key} className="flex shrink-0 items-center">
            {i > 0 && <span aria-hidden className={`mx-1 h-0.5 w-3 rounded-full 2xl:mx-1.5 2xl:w-6 ${i <= actual ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`} />}
            <button
              type="button"
              onClick={() => onGo(i)}
              aria-current={es ? "step" : undefined}
              title={p.label}
              className={`group inline-flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
                es ? "bg-[var(--accent)]/10 text-[var(--fg)]" : hecho ? "text-[var(--fg)] hover:bg-[var(--surface-2)]" : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
              } ${es ? "" : "pr-1 xl:pr-2"}`}
            >
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full text-[0.7rem] font-semibold tabular-nums transition ${
                  es ? "bg-[var(--accent)] text-[var(--accent-fg,#fff)] shadow-sm" : hecho ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "border border-[var(--border-strong,var(--border))] text-[var(--fg-muted)]"
                }`}
              >
                {hecho ? <Check size={12} strokeWidth={3} /> : i + 1}
              </span>
              <span className={`${es ? "inline" : "hidden xl:inline"} whitespace-nowrap`}>{p.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
