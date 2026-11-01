"use client";

import { Copy, Monitor, Smartphone, Tablet } from "lucide-react";
import { PANTALLAS, type Pantalla } from "@/lib/pantallas";

const ICONO = { pc: Monitor, tablet: Tablet, movil: Smartphone };

/**
 * Qué pantalla se está editando: lo visual solo cambia en ella; el contenido es común a las tres.
 * En el editor la elige la barra de herramientas; en la vista previa manda el ancho de la ventana.
 */
export function PantallaEditada({ pantalla, onCopiar, porVentana = false }: { pantalla: Pantalla; onCopiar: () => void; porVentana?: boolean }) {
  const Icono = ICONO[pantalla];
  const nombre = PANTALLAS.find((p) => p.id === pantalla)?.nombre ?? "";
  return (
    <section aria-label="Pantalla que se está editando" data-pantalla-editada={pantalla} className="rounded-[var(--radius)] border border-[var(--accent)] bg-[var(--surface-2)] px-3 py-2.5">
      <p className="flex items-center gap-2 text-sm font-bold">
        <Icono size={15} className="shrink-0 text-[var(--accent)]" /> Editando: {nombre}
      </p>
      <p className="mt-1 text-xs leading-snug text-[var(--fg-muted)]">
        Colores, letras, medidas y estilo de cada nota cambian solo aquí. Plantilla, notas, textos y cintillo son comunes a las tres pantallas.
        {porVentana ? " Cambia el ancho de la ventana para editar otra pantalla." : ""}
      </p>
      <button type="button" onClick={onCopiar} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:underline">
        <Copy size={12} /> Copiar a las otras pantallas
      </button>
    </section>
  );
}
