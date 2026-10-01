"use client";

import { useState, useTransition } from "react";
import { setAiQuota } from "@/app/panel/(app)/configuracion/actions";

/** Cuota mensual de IA predeterminada para todas las personas (USD). Vacío = sin tope. */
export function CuotaIaPredeterminada({ valor }: { valor: number | null }) {
  const [txt, setTxt] = useState(valor === null ? "" : String(valor));
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  function guardar() {
    const t = txt.trim().replace(",", ".");
    const usd = t === "" ? null : Number(t);
    start(async () => setMsg((await setAiQuota(null, usd)).message));
  }

  return (
    <div className="mb-5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)]/40 p-4">
      <p className="text-sm font-semibold">Cuota mensual de IA por persona</p>
      <p className="mt-1 text-xs text-[var(--fg-muted)]">
        Tope de gasto en dólares que cada persona puede usar al mes en las herramientas de IA (borradores, títulos,
        gráficas). Vacío = sin tope. Puedes dar una cuota distinta a alguien desde su botón <strong>Permisos</strong>.
        El costo es una estimación por tokens y se renueva el primer día de cada mes.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm">US$</span>
        <input
          type="text"
          inputMode="decimal"
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          placeholder="sin tope"
          className="lx-input py-1.5 text-sm" style={{ width: "8rem" }}
        />
        <button type="button" className="lx-btn" disabled={pending} onClick={guardar}>Guardar</button>
        {msg && <span className="text-xs text-[var(--accent)]" role="status">{msg}</span>}
      </div>
    </div>
  );
}
