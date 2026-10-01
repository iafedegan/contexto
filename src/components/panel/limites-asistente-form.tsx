"use client";

import { useState, useTransition } from "react";
import { saveAssistantLimits } from "@/app/panel/(app)/configuracion/actions";

/** Presupuesto mensual y tope por sesión del asistente público. */
export function LimitesAsistenteForm({ presupuesto, tope }: { presupuesto: number; tope: number }) {
  const [p, setP] = useState(String(presupuesto));
  const [t, setT] = useState(String(tope));
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="mt-4 flex flex-wrap items-end gap-4 rounded-[var(--radius)] border border-[var(--border)] p-4">
      <label className="flex flex-col gap-1 text-sm">
        Presupuesto mensual (US$)
        <input className="lx-input py-1.5" style={{ width: "9rem" }} inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Tope por sesión (consultas)
        <input className="lx-input py-1.5" style={{ width: "9rem" }} inputMode="numeric" value={t} onChange={(e) => setT(e.target.value)} />
      </label>
      <button
        type="button"
        className="lx-btn"
        disabled={pending}
        onClick={() => start(async () => setMsg((await saveAssistantLimits(Number(p.replace(",", ".")), Number(t))).message))}
      >
        Guardar límites
      </button>
      {msg && <span className="text-xs text-[var(--accent)]" role="status">{msg}</span>}
      <p className="basis-full text-xs text-[var(--fg-muted)]">
        Al llegar al presupuesto del mes, el asistente pasa a modo búsqueda (sin generar texto) hasta el mes siguiente.
        Es solo para el asistente público del sitio; la cuota de cada persona se ajusta en Personas y roles.
      </p>
    </div>
  );
}
