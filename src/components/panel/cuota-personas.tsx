"use client";

import { useState, useTransition } from "react";
import { setAiQuota } from "@/app/panel/(app)/configuracion/actions";
import { CuotaBarra } from "@/components/panel/cuota-ia-form";

type Fila = { id: string; name: string; email: string; propia: number | null; efectiva: number | null; gasto: number };

/** Cuota de IA de cada persona: lo gastado este mes y su tope propio (vacío = usa la predeterminada). */
export function CuotaPersonas({ filas }: { filas: Fila[] }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
      {filas.map((f) => (
        <FilaCuota key={f.id + f.propia} f={f} />
      ))}
    </div>
  );
}

// Una persona: nombre, barra de consumo y campo del tope propio.
function FilaCuota({ f }: { f: Fila }) {
  const [txt, setTxt] = useState(f.propia == null ? "" : String(f.propia));
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 last:border-0">
      <div className="min-w-[14rem]">
        <p className="text-sm font-medium">{f.name}</p>
        <p className="text-xs text-[var(--fg-muted)]">{f.email}</p>
        <CuotaBarra gasto={f.gasto} tope={f.efectiva} compacta />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">US$</span>
        <input type="text" inputMode="decimal" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="predeterminada" className="lx-input py-1.5 text-sm" style={{ width: "9rem" }} />
        <button
          type="button"
          disabled={pending}
          className="rounded-full border border-[var(--border-strong)] px-3 py-1 text-xs font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          onClick={() => {
            const t = txt.trim().replace(",", ".");
            start(async () => setMsg((await setAiQuota(f.id, t === "" ? null : Number(t))).message));
          }}
        >
          Guardar
        </button>
        {msg && <span className="text-xs text-[var(--accent)]" role="status">{msg}</span>}
      </div>
    </div>
  );
}
