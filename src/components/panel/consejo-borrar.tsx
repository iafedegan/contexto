"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { borrarPlan } from "@/app/panel/(app)/consejo/actions";

/** Botón para borrar un consejo (con confirmación). `volverA` lleva a la lista cuando se borra desde dentro del consejo. */
export function ConsejoBorrar({ id, titulo, piezas, activo, volverA, etiqueta }: { id: string; titulo: string; piezas: number; activo: boolean; volverA?: string; etiqueta?: boolean }) {
  const router = useRouter();
  const [pend, run] = useTransition();
  return (
    <button
      type="button"
      disabled={pend}
      aria-label={`Borrar ${titulo}`}
      title="Borrar el consejo"
      onClick={() => {
        const aviso = `¿Borrar «${titulo}»?\n\nSe borran sus ${piezas} piezas planificadas.${activo ? " Está ACTIVO: dejará de redactar." : ""} Las notas que ya se redactaron se conservan en Artículos (las ya programadas siguen programadas).`;
        if (!window.confirm(aviso)) return;
        run(async () => {
          const r = await borrarPlan(id);
          if (!r.ok) return void window.alert(r.message);
          if (volverA) router.push(volverA);
          else router.refresh();
        });
      }}
      className={etiqueta ? "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-red-600/60 px-5 text-sm font-semibold text-red-600 transition hover:bg-red-600/10 disabled:opacity-50" : "grid size-11 shrink-0 place-items-center rounded-full text-[var(--fg-muted)] transition hover:bg-red-600/10 hover:text-red-600 disabled:opacity-50"}
    >
      {pend ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
      {etiqueta && "Borrar el consejo"}
    </button>
  );
}
