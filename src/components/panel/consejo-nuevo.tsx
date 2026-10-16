"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2 } from "lucide-react";
import { crearPlan } from "@/app/panel/(app)/consejo/actions";

/** Crea un consejo para la semana de la fecha elegida (por defecto, el lunes que viene). */
export function ConsejoNuevo({ proximoLunes }: { proximoLunes: string }) {
  const router = useRouter();
  const [fecha, setFecha] = useState(proximoLunes);
  const [err, setErr] = useState("");
  const [pend, run] = useTransition();
  return (
    <div className="lx-card flex flex-col gap-3 p-5">
      <p className="lx-kicker text-[var(--accent)]">Nuevo consejo</p>
      <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Semana que quieres planear (elige cualquier día de esa semana)</span>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full max-w-xs rounded-[var(--radius)] border border-[var(--border-strong)] bg-white px-3 py-2 text-sm text-[#0b0b0b]" /></label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={pend || !fecha} onClick={() => run(async () => { const r = await crearPlan({ fecha }); if (r.ok) router.push(`/panel/consejo/${r.id}`); else setErr(r.message); })} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-fg,#fff)] disabled:opacity-50">
          {pend ? <Loader2 size={16} className="animate-spin" /> : <CalendarPlus size={16} />} Crear el consejo
        </button>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      </div>
    </div>
  );
}
