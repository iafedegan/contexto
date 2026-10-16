"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, PenLine, Plus, Trash2, UserRound, UserRoundPlus } from "lucide-react";
import { crearEscritor, estadoEstilo, quitarEscritor } from "@/app/panel/(app)/configuracion/estilo-actions";
import { EstiloEscritura } from "@/components/panel/estilo-escritura";
import type { Escritor } from "@/lib/ai/estilo";
import type { EstiloVista } from "@/lib/ai/estilo-tipos";

const nf = new Intl.NumberFormat("es-CO");

/**
 * Estilos de escritura de TODOS los escritores (solo administradores): la gente de la redacción y los escritores externos que se
 * registren (columnistas, firmas invitadas, un referente). A cada uno se le cargan notas por enlace, texto o archivo y la IA saca el
 * diagnóstico de su tono. Luego se elige a quién imita la IA en el consejo de redacción.
 */
export function EstilosEscritores({ escritores: inicial, miId, miEstilo }: { escritores: Escritor[]; miId: string; miEstilo: EstiloVista }) {
  const [lista, setLista] = useState(inicial);
  const [seleccion, setSeleccion] = useState(miId);
  const [estado, setEstado] = useState<EstiloVista>(miEstilo);
  const [nuevo, setNuevo] = useState("");
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pend, run] = useTransition();
  const actual = lista.find((e) => e.id === seleccion);

  const elegir = (id: string) => {
    if (id === seleccion) return;
    setAviso(null);
    setSeleccion(id);
    run(async () => {
      try { setEstado(await estadoEstilo(id === miId ? undefined : id)); } catch { setAviso({ ok: false, texto: "No se pudo abrir ese escritor." }); }
    });
  };
  // Cuando cambia el estilo del escritor abierto (muestras, diagnóstico), se actualiza su resumen en la lista.
  const alCambiar = (e: EstiloVista) => {
    setLista((l) => l.map((x) => (x.id === seleccion ? { ...x, muestras: e.fuentes.length, palabras: e.fuentes.reduce((t, f) => t + f.palabras, 0), conDiagnostico: !!e.diagnostico, activo: e.activo, generadoEn: e.diagnostico?.generadoEn ?? null, tono: e.diagnostico?.tono.slice(0, 3) ?? [] } : x)));
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
      {/* Lista de escritores */}
      <aside className="flex flex-col gap-3">
        <p className="text-xs leading-relaxed text-[var(--fg-muted)]">Elige un escritor para ver y entrenar su estilo. La IA puede escribir con el de cualquiera de ellos en el consejo de redacción.</p>
        <ul className="flex max-h-[34rem] flex-col gap-1.5 overflow-y-auto pr-1">
          {lista.map((e) => {
            const on = e.id === seleccion;
            return (
              <li key={e.id}>
                <button type="button" onClick={() => elegir(e.id)} aria-pressed={on} className={`flex w-full flex-col gap-1 rounded-[var(--radius)] border p-3 text-left transition ${on ? "border-[var(--accent)] bg-[var(--accent)]/8" : "border-[var(--border)] hover:border-[var(--accent)]"}`}>
                  <span className="flex items-center gap-2">
                    <span className="shrink-0 text-[var(--accent)]">{e.tipo === "externo" ? <UserRoundPlus size={15} /> : <UserRound size={15} />}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{e.nombre}{e.id === miId ? " (yo)" : ""}</span>
                    <span className="shrink-0 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">{e.tipo === "externo" ? "Externo" : e.rol}</span>
                  </span>
                  {e.conDiagnostico ? (
                    <span className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--fg-muted)]"><Check size={13} className="text-emerald-600" /> Diagnóstico · {e.muestras} notas · {nf.format(e.palabras)} palabras{!e.activo ? " · apagado" : ""}</span>
                  ) : (
                    <span className="text-xs text-[var(--fg-muted)]">{e.muestras > 0 ? `${e.muestras} notas cargadas, sin diagnóstico` : "Sin muestras todavía"}</span>
                  )}
                  {e.tono.length > 0 && <span className="flex flex-wrap gap-1">{e.tono.map((t) => <span key={t} className="rounded-full bg-[var(--accent)]/12 px-2 py-0.5 text-[0.65rem] font-semibold text-[var(--accent)]">{t}</span>)}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] p-3">
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]" htmlFor="nuevo-escritor">Añadir un escritor externo</label>
          <input id="nuevo-escritor" value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Nombre, p. ej. «Columnista invitado»" className="lx-input text-sm" />
          <button type="button" disabled={pend || nuevo.trim().length < 3} className="lx-btn" onClick={() => run(async () => {
            const r = await crearEscritor(nuevo);
            setAviso({ ok: r.ok, texto: r.message });
            if (r.ok && r.escritores && r.id) { setLista(r.escritores); setNuevo(""); setSeleccion(r.id); setEstado(await estadoEstilo(r.id)); }
          })}><Plus size={15} /> Añadir escritor</button>
        </div>
      </aside>

      {/* Estilo del escritor elegido */}
      <section className="min-w-0 rounded-[var(--radius-lg)] border border-[var(--border)] p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <PenLine size={16} className="text-[var(--accent)]" aria-hidden />
          <h3 className="lx-display flex-1 text-xl font-semibold">{actual?.nombre ?? "Escritor"}{seleccion === miId ? " (yo)" : ""}</h3>
          {pend && <Loader2 size={16} className="animate-spin text-[var(--fg-muted)]" aria-label="Cargando" />}
          {actual?.tipo === "externo" && (
            <button type="button" disabled={pend} onClick={() => { if (!window.confirm(`¿Quitar a ${actual.nombre} y todo lo que la IA aprendió de él o ella?`)) return; run(async () => { const r = await quitarEscritor(actual.id); setAviso({ ok: r.ok, texto: r.message }); if (r.ok && r.escritores) { setLista(r.escritores); setSeleccion(miId); setEstado(await estadoEstilo()); } }); }} className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--fg-muted)] underline-offset-2 hover:text-[var(--danger)] hover:underline"><Trash2 size={13} /> Quitar escritor</button>
          )}
        </div>
        {aviso && <p role="status" className={`mb-3 rounded-[var(--radius)] border px-3 py-2 text-sm ${aviso.ok ? "border-[var(--accent-2)]/40 text-[var(--accent-2)]" : "border-[var(--danger)]/40 text-[var(--danger)]"}`}>{aviso.texto}</p>}
        <EstiloEscritura key={seleccion} inicial={estado} escritorId={seleccion === miId ? undefined : seleccion} nombre={actual?.nombre} onCambio={alCambiar} />
      </section>
    </div>
  );
}

