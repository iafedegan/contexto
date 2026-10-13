"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteEdition } from "./actions";

/** Borra un borrador desde la lista, con confirmación en el mismo sitio (sin ventanas del navegador). Las ediciones enviadas no se pueden borrar. */
export function BorrarEdicion({ id, asunto }: { id: string; asunto: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [pendiente, empezar] = useTransition();

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        aria-label={`Eliminar el borrador «${asunto}»`}
        title="Eliminar este borrador"
        className="grid size-8 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)] transition hover:border-[var(--danger,#b4442e)] hover:text-[var(--danger,#b4442e)]"
      >
        <Trash2 size={14} aria-hidden />
      </button>
    );
  }
  return (
    <span role="alertdialog" aria-label="Confirmar eliminación" className="flex items-center gap-1.5 rounded-full border border-[var(--danger,#b4442e)] bg-[var(--surface)] py-0.5 pl-3 pr-0.5 text-xs shadow-sm">
      <span className="font-semibold text-[var(--danger,#b4442e)]">¿Eliminar?</span>
      <button
        type="button"
        autoFocus
        disabled={pendiente}
        onClick={() =>
          empezar(async () => {
            await deleteEdition(id);
            router.refresh();
          })
        }
        className="inline-flex items-center gap-1 rounded-full bg-[var(--danger,#b4442e)] px-2.5 py-1 font-semibold text-white disabled:opacity-60"
      >
        {pendiente && <Loader2 size={12} className="animate-spin" aria-hidden />} Sí, eliminar
      </button>
      <button type="button" disabled={pendiente} onClick={() => setConfirmando(false)} className="rounded-full px-2.5 py-1 font-semibold text-[var(--fg-muted)] hover:text-[var(--fg)]">
        No
      </button>
    </span>
  );
}
