"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { BibliotecaExplorador } from "@/components/panel/biblioteca-explorador";
import type { ActivoInfo } from "@/app/panel/(app)/biblioteca/actions";

/** Ventana para elegir una imagen ya guardada en la biblioteca (solo ve las carpetas que le asignaron a la persona). */
export function SelectorBiblioteca({ onElegir, onCerrar }: { onElegir: (a: ActivoInfo) => void; onCerrar: () => void }) {
  useEffect(() => {
    const cerrar = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [onCerrar]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Elegir una imagen de la biblioteca" className="fixed inset-0 z-[80] grid place-items-center bg-black/55 p-3 sm:p-6" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="flex max-h-[92dvh] w-full max-w-6xl flex-col rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">Biblioteca de imágenes</h2>
            <p className="text-xs text-[var(--fg-muted)]">Elige una imagen para esta nota. Aquí ves las carpetas que te asignaron.</p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onCerrar} className="grid size-9 place-items-center rounded-full hover:bg-[var(--surface-2)]"><X size={18} aria-hidden /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <BibliotecaExplorador modo="selector" onElegir={onElegir} />
        </div>
      </div>
    </div>
  );
}
