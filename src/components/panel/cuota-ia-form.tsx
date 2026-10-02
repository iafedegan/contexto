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

const usd = (n: number) => `US$ ${n.toFixed(n < 10 ? 2 : 0)}`;

/** Consumo de IA del mes frente al tope: barra, lo gastado y cuánto falta para agotarlo. */
export function CuotaBarra({ gasto, tope, compacta = false }: { gasto: number; tope: number | null; compacta?: boolean }) {
  if (tope === null) {
    return (
      <p className="text-xs text-[var(--fg-muted)]">
        IA este mes: <strong className="text-[var(--fg)]">{usd(gasto)}</strong> · sin tope
      </p>
    );
  }
  const falta = Math.max(0, tope - gasto);
  const pct = tope > 0 ? Math.min(100, (gasto / tope) * 100) : 100;
  const color = pct >= 90 ? "#c0392b" : pct >= 70 ? "#d9780f" : "var(--accent)";
  return (
    <div className={compacta ? "mt-1.5 max-w-[16rem]" : "mt-1 max-w-md"}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="Consumo de IA del mes"
        className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]"
      >
        <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.max(pct, gasto > 0 ? 3 : 0)}%`, background: color }} />
      </div>
      <p className="mt-1 text-xs text-[var(--fg-muted)]">
        <strong className="text-[var(--fg)]">{usd(gasto)}</strong> de {usd(tope)} · {falta > 0 ? <>te quedan <strong className="text-[var(--fg)]">{usd(falta)}</strong> ({Math.round(100 - pct)} %)</> : <strong style={{ color }}>cuota agotada</strong>}
      </p>
    </div>
  );
}
