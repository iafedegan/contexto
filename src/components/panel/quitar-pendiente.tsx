"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { descartarPendiente } from "@/app/panel/(app)/pendientes/actions";

/** «Quitar de mis pendientes»: pide la razón (obligatoria) antes de quitarlo. */
export function QuitarPendiente({ clave }: { clave: string }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState("");
  const [pendiente, iniciar] = useTransition();

  if (hecho) return <p role="status" className="mt-2 text-xs text-[#157a4a]">{hecho}</p>;
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="lx-link mt-2 inline-flex items-center gap-1 text-xs">
        <Trash2 size={12} aria-hidden /> Quitar de mis pendientes
      </button>
    );
  }
  return (
    <div className="mt-2 flex flex-col gap-2 text-xs">
      <label className="font-semibold" htmlFor={`motivo-${clave}`}>¿Por qué lo quitas? (obligatorio)</label>
      <textarea
        id={`motivo-${clave}`}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        rows={3}
        maxLength={600}
        autoFocus
        placeholder="Ej.: ya la cubrió otro medio, el tema perdió vigencia, no tengo las fuentes…"
        className="w-full resize-none rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
      />
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pendiente || motivo.trim().length < 10}
          onClick={() => {
            setError("");
            iniciar(async () => {
              const r = await descartarPendiente(clave, motivo);
              if (r.ok) setHecho(r.mensaje);
              else setError(r.error);
            });
          }}
          className="lx-btn !min-h-9 !px-3 text-xs disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? "Quitando…" : "Quitar"}
        </button>
        <button type="button" onClick={() => { setAbierto(false); setError(""); }} className="lx-link">Cancelar</button>
      </div>
    </div>
  );
}
