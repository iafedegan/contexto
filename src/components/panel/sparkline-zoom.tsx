"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ViewsSparkline } from "@/components/panel/views-chart";
import { AreaChart } from "@/components/panel/dash-charts";

const nf = new Intl.NumberFormat("es-CO");

/** Etiqueta «d mmm» del día `atras` días antes de hoy (hora de Colombia). */
function etiqueta(atras: number): string {
  const hoy = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
  hoy.setDate(hoy.getDate() - atras);
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(hoy);
}

/** La mini-gráfica de la tabla: al pulsarla se abre la misma serie en grande. */
export function SparklineZoom({ values, title }: { values: number[]; title: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const n = values.length;
  const labels = values.map((_, i) => (i % 2 === (n - 1) % 2 ? etiqueta(n - 1 - i) : ""));
  const total = values.reduce((s, v) => s + v, 0);
  const max = Math.max(0, ...values);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        title="Ver la gráfica en grande"
        className="cursor-zoom-in rounded-md p-1 transition hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
      >
        <ViewsSparkline values={values} />
        <span className="sr-only">Ver la gráfica en grande</span>
      </button>
      {open && createPortal(
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-[#0b1630]/60 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={id}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[var(--bg-2)] p-5 text-[var(--fg)] shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="lx-kicker text-[var(--fg-muted)]">Lecturas · últimos {n} días</p>
                <h2 id={id} className="lx-display mt-1 text-xl font-semibold leading-snug">{title}</h2>
              </div>
              <button type="button" autoFocus onClick={() => setOpen(false)} aria-label="Cerrar" className="grid size-10 shrink-0 place-items-center rounded-full border border-[var(--border)] transition hover:bg-[var(--surface-2)]">
                <X size={18} />
              </button>
            </div>
            <div className="mt-3 flex gap-6 text-sm">
              <p><span className="text-2xl font-semibold tabular-nums">{nf.format(total)}</span> <span className="text-[var(--fg-muted)]">en total</span></p>
              <p><span className="text-2xl font-semibold tabular-nums">{nf.format(max)}</span> <span className="text-[var(--fg-muted)]">máximo / día</span></p>
            </div>
            <div className="mt-4"><AreaChart labels={labels} values={values} /></div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
