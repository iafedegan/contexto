"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { vectorizarAhora } from "@/app/panel/(app)/configuracion/actions";

/** Vectoriza una tanda de notas sin vector y muestra cuántas hizo, cuántas faltan o el error exacto del proveedor. */
export function VectorizarAhora() {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ ok: boolean; message: string; pendientes: number } | null>(null);
  return (
    <div className="rounded-xl border border-[var(--border)] p-4 lg:col-span-2">
      <h3 className="text-sm font-semibold">Vectorización de las notas</h3>
      <p className="mt-1 text-xs leading-relaxed text-[var(--fg-muted)]">
        Guarda en la base el «significado» de cada nota para que el asistente la encuentre aunque no use las mismas palabras. Cada pulsación procesa una tanda (~45 s).
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setRes(await vectorizarAhora()))}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
      >
        <Sparkles size={14} /> {pending ? "Vectorizando…" : "Vectorizar ahora"}
      </button>
      {res && (
        <p role="status" className={`mt-3 text-xs ${res.ok ? "text-emerald-600" : "text-red-600"}`}>
          {res.message}
          {res.pendientes >= 0 ? ` Faltan ${res.pendientes.toLocaleString("es-CO")} notas.` : ""}
        </p>
      )}
    </div>
  );
}
