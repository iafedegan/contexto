"use client";

import { Printer } from "lucide-react";

/** Abre el diálogo de impresión del navegador (desde ahí también se guarda en PDF). */
export function BotonImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="lx-btn print:hidden">
      <Printer size={15} aria-hidden /> Imprimir o guardar PDF
    </button>
  );
}
