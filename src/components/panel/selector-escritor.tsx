"use client";

import Link from "next/link";
import { PenLine } from "lucide-react";

export type EscritorOpcion = { id: string; nombre: string; tipo: "redaccion" | "externo"; conDiagnostico: boolean };

/**
 * Elige con el estilo de QUÉ escritor redacta la IA. Muestra primero a quien tiene diagnóstico y avisa si el elegido aún no lo tiene (en ese
 * caso la IA usa el estilo neutro de la casa). `yoId` es la persona con sesión: su opción se llama «Yo».
 */
export function SelectorEscritor({ valor, onChange, escritores, yoId, deshabilitado }: { valor: string; onChange: (id: string) => void; escritores: EscritorOpcion[]; yoId: string; deshabilitado?: boolean }) {
  const elegido = escritores.find((e) => e.id === (valor || yoId));
  const orden = [...escritores].sort((a, b) => Number(b.conDiagnostico) - Number(a.conDiagnostico) || a.nombre.localeCompare(b.nombre));
  const nombre = (e: EscritorOpcion) => `${e.nombre}${e.id === yoId ? " (yo)" : ""}${e.tipo === "externo" ? " · externo" : ""}${e.conDiagnostico ? "" : " · sin estilo aprendido"}`;
  return (
    <div className="flex max-w-xl flex-col gap-1.5 text-sm">
      <label className="flex flex-col gap-1">
        <span className="lx-kicker flex items-center gap-1.5 text-[var(--fg-muted)]"><PenLine size={13} aria-hidden /> Escritor: la IA escribe con su estilo</span>
        <select value={valor || yoId} disabled={deshabilitado} onChange={(e) => onChange(e.target.value === yoId ? "" : e.target.value)} className="w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-white px-3 py-2 text-sm text-[#0b0b0b]">
          {orden.map((e) => <option key={e.id} value={e.id}>{nombre(e)}</option>)}
        </select>
      </label>
      {elegido && !elegido.conDiagnostico ? (
        <span className="text-xs text-amber-700">{elegido.nombre} todavía no tiene un estilo aprendido: la IA escribirá con el estilo neutro de la casa. Entrénalo con sus notas en <Link href="/panel/configuracion#estilo" className="underline">Configuración → Estilos de escritura</Link>.</span>
      ) : (
        <span className="text-xs text-[var(--fg-muted)]">Cada nota se redacta imitando su tono, ritmo y vocabulario (nunca sus hechos), sin cambiar las reglas de veracidad y de fuentes.{elegido && elegido.id !== yoId ? " La nota sale firmada por esa persona si tiene cuenta en el panel." : ""}</span>
      )}
    </div>
  );
}
