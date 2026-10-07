"use client";

import { useState } from "react";
import { compacto } from "@/lib/graficas";
import { PALETA } from "@/components/observatorio-serie";
import type { Hato } from "@/lib/observatorio-fedegan";

/** Donas del reparto de predios y de animales por orientación del hato (lechería, doble propósito, cría, ceba…). */
function Dona({ h }: { h: Hato }) {
  const [sobre, setSobre] = useState<number | null>(null);
  const total = h.partes.reduce((t, p) => t + p.valor, 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  // Dónde empieza cada arco: la suma de los anteriores.
  const inicios = h.partes.map((_, i) => h.partes.slice(0, i).reduce((t, p) => t + (p.valor / total) * C, 0));
  const activa = sobre !== null ? h.partes[sobre] : null;
  return (
    <figure className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <svg viewBox="0 0 140 140" className="size-40 shrink-0" role="img" aria-label={`${h.titulo} ${h.periodo}`}>
        <g transform="rotate(-90 70 70)">
          {h.partes.map((p, i) => {
            const largo = (p.valor / total) * C;
            return <circle key={p.nombre} cx="70" cy="70" r={R} fill="none" stroke={PALETA[i % PALETA.length]} strokeWidth={sobre === i ? 22 : 18} strokeDasharray={`${Math.max(0, largo - 1.5)} ${C}`} strokeDashoffset={-inicios[i]} onPointerEnter={() => setSobre(i)} onPointerLeave={() => setSobre(null)} className="cursor-pointer transition-[stroke-width]" />;
          })}
        </g>
        <text x="70" y="66" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--fg)" className="tabular-nums">{activa ? `${((activa.valor / total) * 100).toFixed(0)} %` : compacto(total)}</text>
        <text x="70" y="84" textAnchor="middle" fontSize="9" fill="var(--fg-muted)">{activa ? activa.nombre : h.periodo}</text>
      </svg>
      <figcaption className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{h.titulo}</p>
        <ul className="mt-2 flex flex-col gap-1">
          {h.partes.map((p, i) => (
            <li key={p.nombre} onPointerEnter={() => setSobre(i)} onPointerLeave={() => setSobre(null)} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2"><span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: PALETA[i % PALETA.length] }} /><span className="truncate">{p.nombre}</span></span>
              <span className="tabular-nums text-xs text-[var(--fg-muted)]">{compacto(p.valor)} · {((p.valor / total) * 100).toFixed(0)} %</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

// Las dos donas lado a lado (una debajo de la otra en el celular).
export function ObservatorioHato({ hato }: { hato: Hato[] }) {
  return (
    <div className="grid gap-6 rounded-[var(--radius-lg)] border border-[var(--border)] bg-gradient-to-b from-[var(--surface-2)] to-[var(--surface)] p-4 sm:p-6 lg:grid-cols-2">
      {hato.map((h) => <Dona key={h.clave} h={h} />)}
    </div>
  );
}
