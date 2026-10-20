"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, X } from "lucide-react";

/**
 * Aviso de tareas nuevas en el panel: si desde la última vez que esta persona miró «Mis pendientes» le llegaron más piezas, sale un
 * aviso con enlace y el título de la pestaña lleva el número. Lo último que vio se guarda en este navegador (no en la base).
 */
export function AvisoTareas({ pendientes, usuarioId }: { pendientes: number; usuarioId: string }) {
  const pathname = usePathname();
  // Lo último que esta persona vio (null mientras no se ha leído del navegador).
  const [visto, setVisto] = useState<number | null>(null);
  const clave = `cg-pendientes-visto:${usuarioId}`;

  useEffect(() => {
    let visto = 0;
    try { visto = Number(localStorage.getItem(clave) ?? 0) || 0; } catch { /* sin almacenamiento: se avisa siempre */ }
    const enLista = pathname.startsWith("/panel/pendientes");
    // Mirar la lista, o tener menos que antes, deja la cuenta al día.
    if (enLista || pendientes < visto) {
      try { localStorage.setItem(clave, String(pendientes)); } catch { /* nada */ }
      visto = pendientes;
    }
    const id = setTimeout(() => setVisto(visto), 0);
    return () => clearTimeout(id);
  }, [pendientes, pathname, clave]);

  useEffect(() => {
    const limpio = document.title.replace(/^\(\d+\) /, "");
    document.title = pendientes > 0 ? `(${pendientes}) ${limpio}` : limpio;
  }, [pendientes, pathname]);

  const nuevas = visto === null ? 0 : Math.max(0, pendientes - visto);
  if (nuevas === 0) return null;
  const cerrar = () => {
    try { localStorage.setItem(clave, String(pendientes)); } catch { /* nada */ }
    setVisto(pendientes);
  };
  return (
    <div role="status" className="fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--accent)]/50 bg-white p-4 text-[#0b0b0b] shadow-xl">
      <BellRing size={20} aria-hidden className="mt-0.5 shrink-0 text-[var(--accent)]" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">{nuevas === 1 ? "Te llegó una tarea nueva" : `Te llegaron ${nuevas} tareas nuevas`}</p>
        <p className="text-xs text-[#4b5563]">Tienes {pendientes} {pendientes === 1 ? "pieza pendiente" : "piezas pendientes"} en el consejo de redacción.</p>
        <Link href="/panel/pendientes" onClick={cerrar} className="mt-2 inline-block font-semibold text-[var(--accent)] underline">Ver mis pendientes</Link>
      </div>
      <button type="button" onClick={cerrar} aria-label="Cerrar el aviso" className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-black/5"><X size={16} aria-hidden /></button>
    </div>
  );
}
