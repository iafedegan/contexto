"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BellRing, X } from "lucide-react";
import { marcarPendientesVistos } from "@/app/panel/(app)/pendientes/actions";

/**
 * Aviso de tareas nuevas del consejo de redacción. Las «nuevas» las cuenta el servidor (piezas asignadas que la persona aún no abrió), así que el aviso
 * sale en cualquier navegador y no se pierde al cambiar de equipo. Se apaga al abrir «Mis pendientes» o al cerrarlo. El título de la pestaña lleva el número.
 */
export function AvisoTareas({ pendientes, nuevas }: { pendientes: number; nuevas: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const [, run] = useTransition();
  // Con cuántas nuevas se cerró el aviso: solo reaparece si llegan más.
  const [cerradoCon, setCerradoCon] = useState(0);

  useEffect(() => {
    const limpio = document.title.replace(/^\(\d+\) /, "");
    document.title = pendientes > 0 ? `(${pendientes}) ${limpio}` : limpio;
  }, [pendientes, pathname]);

  if (nuevas <= cerradoCon || pathname.startsWith("/panel/pendientes")) return null;
  const cerrar = () => {
    setCerradoCon(nuevas);
    run(async () => { await marcarPendientesVistos(); router.refresh(); });
  };
  return (
    <div role="status" className="fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--accent)]/50 bg-white p-4 text-[#0b0b0b] shadow-xl">
      <BellRing size={20} aria-hidden className="mt-0.5 shrink-0 text-[var(--accent)]" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">{nuevas === 1 ? "Te llegó una tarea nueva" : `Te llegaron ${nuevas} tareas nuevas`}</p>
        <p className="text-xs text-[#4b5563]">Tienes {pendientes} {pendientes === 1 ? "pieza pendiente" : "piezas pendientes"} en el consejo de redacción.</p>
        <Link href="/panel/pendientes" className="mt-2 inline-block font-semibold text-[var(--accent)] underline">Ver mis pendientes</Link>
      </div>
      <button type="button" onClick={cerrar} aria-label="Cerrar el aviso" className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-black/5"><X size={16} aria-hidden /></button>
    </div>
  );
}
