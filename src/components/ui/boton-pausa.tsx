"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";

/**
 * Botón para detener o reanudar lo que se mueve solo (carruseles, cintillo). WCAG 2.2.2 pide que todo lo que se mueve
 * más de 5 segundos se pueda pausar, y pasar el puntero no basta porque quien usa teclado o lector de pantalla no lo hace.
 */
export function BotonPausa({ detenido, onCambio, className = "" }: { detenido: boolean; onCambio: (detenido: boolean) => void; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={detenido}
      aria-label={detenido ? "Reanudar el movimiento" : "Detener el movimiento"}
      title={detenido ? "Reanudar" : "Detener"}
      onClick={() => onCambio(!detenido)}
      className={`grid size-8 shrink-0 place-items-center rounded-full bg-black/55 text-white transition hover:bg-black/75 ${className}`}
    >
      {detenido ? <Play size={14} aria-hidden /> : <Pause size={14} aria-hidden />}
    </button>
  );
}

/** Para animaciones de CSS (el cintillo): marca el contenedor `[data-pausable]` más cercano; globals.css detiene sus animaciones. */
export function BotonPausaCss({ className = "" }: { className?: string }) {
  const [detenido, setDetenido] = useState(false);
  // Safari no enfoca el botón al hacer clic: el contenedor se busca desde el propio envoltorio, no desde el foco.
  return (
    <span
      className="contents"
      onClickCapture={(e) => {
        const d = !detenido;
        (e.currentTarget as HTMLElement).closest("[data-pausable]")?.toggleAttribute("data-pausado", d);
      }}
    >
      <BotonPausa detenido={detenido} className={className} onCambio={setDetenido} />
    </span>
  );
}
