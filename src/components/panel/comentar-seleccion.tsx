"use client";

import { useEffect, useState } from "react";
import { MessageSquarePlus } from "lucide-react";

/** Evento con el que el botón avisa al panel de comentarios que hay un fragmento seleccionado para comentar. */
export const EVENTO_COMENTAR = "comentar-seleccion";

/**
 * Botón flotante «Comentar» que aparece junto a un texto seleccionado dentro de una zona marcada con `data-comentable` (la hoja del asistente o
 * la vista previa de la nota). Al pulsarlo, avisa con un evento al panel de comentarios, que lo cita en el comentario nuevo. No guarda nada por sí mismo.
 */
export function ComentarSeleccion() {
  const [sel, setSel] = useState<{ texto: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const alCambiar = () => {
      const s = window.getSelection();
      if (!s || s.isCollapsed || !s.rangeCount) return setSel(null);
      const nodo = s.anchorNode instanceof Element ? s.anchorNode : s.anchorNode?.parentElement;
      // Solo dentro de lo comentable (no en los campos de formulario, ni en el propio panel de comentarios).
      if (!nodo?.closest("[data-comentable]") || nodo.closest("[data-sin-comentar]")) return setSel(null);
      const texto = s.toString().replace(/\s+/g, " ").trim();
      if (texto.length < 3) return setSel(null);
      const r = s.getRangeAt(0).getBoundingClientRect();
      if (!r.width && !r.height) return setSel(null);
      setSel({ texto, x: Math.min(window.innerWidth - 150, Math.max(8, r.left + r.width / 2 - 65)), y: Math.max(8, r.top - 42) });
    };
    document.addEventListener("selectionchange", alCambiar);
    return () => document.removeEventListener("selectionchange", alCambiar);
  }, []);

  if (!sel) return null;
  return (
    <button
      type="button"
      // No le quita la selección al texto al pulsarlo.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        window.dispatchEvent(new CustomEvent(EVENTO_COMENTAR, { detail: { texto: sel.texto } }));
        setSel(null);
      }}
      style={{ position: "fixed", left: sel.x, top: sel.y, zIndex: 90 }}
      className="inline-flex items-center gap-1.5 rounded-full bg-[#1b1b1b] px-3 py-1.5 text-xs font-semibold text-white shadow-lg transition hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <MessageSquarePlus size={14} aria-hidden /> Comentar selección
    </button>
  );
}
