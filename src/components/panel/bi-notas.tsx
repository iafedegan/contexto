"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDown } from "lucide-react";
import { duracion, parte } from "@/lib/lectores-formato";
import type { NotaTop } from "@/lib/lectores-consulta";
import { nfCO } from "@/lib/format";

/** Tabla de notas con orden por columna: no solo cuáles se leen más, sino cuáles se terminan y cuáles retienen. */
type Col = "lecturas" | "visitantes" | "scroll" | "segundos" | "completas";
const COLUMNAS: { id: Col; t: string }[] = [
  { id: "lecturas", t: "Lecturas" },
  { id: "visitantes", t: "Lectores" },
  { id: "scroll", t: "% leído" },
  { id: "segundos", t: "Tiempo" },
  { id: "completas", t: "Terminan" },
];

export function TablaNotas({ notas, total }: { notas: NotaTop[]; total: number }) {
  const [orden, setOrden] = useState<Col>("lecturas");
  const valor = (n: NotaTop, c: Col) => (c === "completas" ? parte(n.completas, n.lecturas) : n[c]);
  const lista = [...notas].sort((a, b) => valor(b, orden) - valor(a, orden));
  if (!lista.length) return <p className="text-sm text-[var(--fg-muted)]">Sin lecturas en este periodo.</p>;
  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <caption className="sr-only">Notas más leídas, con lectores, porcentaje leído, tiempo y porcentaje que las termina</caption>
        <thead>
          <tr className="border-b border-[var(--border-strong)] text-left text-xs text-[var(--fg-muted)]">
            <th scope="col" className="py-2 pr-3 font-semibold">Nota</th>
            {COLUMNAS.map((c) => (
              <th key={c.id} scope="col" aria-sort={orden === c.id ? "descending" : "none"} className="px-2 py-2 text-right font-semibold">
                <button type="button" onClick={() => setOrden(c.id)} className={`inline-flex min-h-8 items-center gap-1 rounded px-1 transition hover:text-[var(--fg)] ${orden === c.id ? "text-[var(--accent)]" : ""}`}>
                  {c.t} {orden === c.id && <ArrowDown size={12} aria-hidden />}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lista.map((n) => (
            <tr key={n.slug} className="border-b border-[var(--border)] align-middle">
              <th scope="row" className="max-w-[22rem] py-2.5 pr-3 text-left font-medium">
                <Link href={`/articulo/${n.slug}`} target="_blank" className="line-clamp-2 leading-snug hover:text-[var(--accent)]">{n.titulo}</Link>
                {n.categoria && <span className="mt-0.5 inline-block text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">{n.categoria}</span>}
              </th>
              <td className="px-2 text-right tabular-nums"><strong>{nfCO.format(n.lecturas)}</strong><span className="block text-[0.68rem] text-[var(--fg-muted)]">{parte(n.lecturas, total).toLocaleString("es-CO", { maximumFractionDigits: 0 })} %</span></td>
              <td className="px-2 text-right tabular-nums">{nfCO.format(n.visitantes)}</td>
              <td className="px-2"><div className="ml-auto flex w-24 flex-col items-end gap-1"><span className="tabular-nums">{Math.round(n.scroll)} %</span><span className="block h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]"><span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${n.scroll}%` }} /></span></div></td>
              <td className="px-2 text-right tabular-nums">{duracion(n.segundos)}</td>
              <td className="px-2 text-right tabular-nums"><span className={parte(n.completas, n.lecturas) >= 40 ? "font-bold text-[#157a4a]" : ""}>{parte(n.completas, n.lecturas).toLocaleString("es-CO", { maximumFractionDigits: 0 })} %</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
