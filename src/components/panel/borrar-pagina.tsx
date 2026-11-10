"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { borrarPagina } from "@/app/panel/(app)/paginas/actions";
import { confirmar } from "@/components/panel/confirmar";

/** Botón de papelera de una fila de la lista de páginas: pide confirmación y la borra. */
export function BorrarPagina({ id, titulo }: { id: string; titulo: string }) {
  const router = useRouter();
  const [ocupado, start] = useTransition();
  return (
    <button
      type="button"
      disabled={ocupado}
      aria-label={`Borrar la página ${titulo}`}
      title="Borrar página"
      onClick={async () => {
        if (!(await confirmar(`¿Borrar la página «${titulo}»? No se puede deshacer.`))) return;
        start(async () => {
          await borrarPagina(id);
          router.refresh();
        });
      }}
      className="grid size-9 shrink-0 place-items-center rounded-lg text-[#b91c1c] transition hover:bg-[#b91c1c]/10 disabled:opacity-50"
    >
      {ocupado ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
    </button>
  );
}
