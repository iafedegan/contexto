"use client";

import { useRef } from "react";
import { Mic, Square } from "lucide-react";
import { useVoz } from "@/components/voz-asistente";

/**
 * Dictado por voz para un campo de texto del asistente de redacción. Usa el reconocimiento del propio navegador (Chrome, Edge,
 * Safari): sin claves ni costo, y el sitio solo recibe el texto. Mientras se habla, lo que se va entendiendo se añade al final de
 * lo que ya estaba escrito (no lo pisa); se pulsa de nuevo para parar. Si el navegador no lo admite, no se pinta nada.
 *
 * Va dentro de un contenedor `relative` y se coloca con `className` (p. ej. `absolute bottom-2 right-2`).
 */
export function BotonVoz({
  valor,
  alCambiar,
  etiqueta = "Dictar con la voz",
  className = "",
}: {
  valor: string;
  alCambiar: (texto: string) => void;
  etiqueta?: string;
  className?: string;
}) {
  const voz = useVoz("es-CO", true);
  // Lo que había escrito al empezar a dictar: lo dictado se suma después de esto.
  const previo = useRef("");
  if (!voz.soportaDictado) return null;

  function alternar() {
    if (voz.escuchando) {
      voz.parar();
      return;
    }
    previo.current = valor.trimEnd();
    voz.escuchar(
      (t) => alCambiar(previo.current ? `${previo.current} ${t}` : t),
      () => {},
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={alternar}
        aria-pressed={voz.escuchando}
        aria-label={voz.escuchando ? "Dejar de escuchar" : etiqueta}
        title={voz.escuchando ? "Escuchando… pulsa para parar" : etiqueta}
        className={`inline-grid size-9 shrink-0 place-items-center rounded-full border transition ${
          voz.escuchando
            ? "animate-pulse border-[var(--danger)] bg-[var(--danger)] text-white"
            : "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--fg-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        } ${className}`}
      >
        {voz.escuchando ? <Square size={14} aria-hidden /> : <Mic size={16} aria-hidden />}
      </button>
      {voz.aviso && (
        <span role="alert" className="absolute -bottom-5 right-0 text-xs text-[var(--danger)]">
          {voz.aviso}
        </span>
      )}
    </>
  );
}
