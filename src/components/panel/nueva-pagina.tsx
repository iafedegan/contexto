"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { crearPagina } from "@/app/panel/(app)/paginas/actions";

/** Botón «Nueva página»: pide el nombre (y, si se quiere, de qué sección cuelga), la crea y abre el constructor. */
export function NuevaPagina({ secciones, seccionId, compacto = false }: { secciones?: { id: string; name: string }[]; seccionId?: string | null; compacto?: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [seccion, setSeccion] = useState(seccionId ?? "");
  const [error, setError] = useState("");
  const [ocupado, start] = useTransition();

  function crear() {
    setError("");
    start(async () => {
      const r = await crearPagina(titulo, seccion || null);
      if (r.ok && r.id) router.push(`/panel/paginas/${r.id}`);
      else if (!r.ok) setError(r.error);
    });
  }

  if (!abierto)
    return (
      <button type="button" onClick={() => setAbierto(true)} className={`inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] font-semibold text-[var(--accent-fg)] transition hover:opacity-90 ${compacto ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"}`}>
        <Plus size={compacto ? 14 : 16} /> Nueva página
      </button>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        crear();
      }}
      className="flex w-full max-w-md flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
    >
      <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nombre de la página" className="lx-input !py-2 !text-sm" maxLength={160} />
      {secciones && (
        <select value={seccion} onChange={(e) => setSeccion(e.target.value)} className="lx-input !py-2 !text-sm" aria-label="Sección de la que cuelga">
          <option value="">Sin sección (página suelta)</option>
          {secciones.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
      {error && <p className="text-xs text-[#b91c1c]">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={ocupado || !titulo.trim()} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-semibold text-[var(--accent-fg)] disabled:opacity-50">
          {ocupado && <Loader2 size={14} className="animate-spin" />} Crear y diseñar
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="rounded-full px-3 py-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
          Cancelar
        </button>
      </div>
    </form>
  );
}
