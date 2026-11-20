"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Loader2, Pencil, Plus, Power, Search, Trash2, X } from "lucide-react";
import { activarComentarista, borrarComentarista, crearComentarista, editarComentarista } from "@/app/panel/(app)/comentaristas/actions";

export type FilaComentarista = { id: string; nombre: string; bio: string; notas: number; cuenta: string | null; cuentaActiva: boolean | null; activo: boolean };

const campo = "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]";

/** Lista de firmas (comentaristas y autores del sitio) con búsqueda, alta, edición, activar o inactivar y borrado. */
export function ComentaristasLista({ filas }: { filas: FilaComentarista[] }) {
  const [q, setQ] = useState("");
  const [ver, setVer] = useState<"todos" | "activos" | "inactivos">("todos");
  const [editando, setEditando] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [bio, setBio] = useState("");
  const [nuevo, setNuevo] = useState("");
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, empezar] = useTransition();

  const lista = useMemo(() => {
    const t = q.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    return filas.filter((f) => (ver === "todos" || (ver === "activos") === f.activo) && (!t || f.nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(t)));
  }, [filas, q, ver]);

  const correr = (accion: () => Promise<{ ok: boolean; message?: string }>, alTerminar?: () => void) =>
    empezar(async () => {
      const r = await accion();
      setAviso(r.message ? { ok: r.ok, texto: r.message } : r.ok ? null : { ok: false, texto: "No se pudo." });
      if (r.ok) alTerminar?.();
    });

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => { e.preventDefault(); correr(() => crearComentarista(nuevo), () => setNuevo("")); }}
      >
        <label className="flex min-w-60 flex-1 flex-col gap-1 text-sm font-medium">Agregar un comentarista
          <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Nombre y apellido" className={campo} />
        </label>
        <button disabled={ocupado || nuevo.trim().length < 2} className="lx-btn disabled:opacity-50"><Plus size={15} aria-hidden /> Agregar</button>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search size={15} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre" aria-label="Buscar por nombre" className={`${campo} pl-9`} />
        </div>
        <div role="group" aria-label="Estado" className="inline-flex overflow-hidden rounded-[var(--radius)] border border-[var(--border)] text-sm">
          {(["todos", "activos", "inactivos"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={ver === v} onClick={() => setVer(v)} className={`px-3 py-2 font-medium capitalize ${ver === v ? "bg-[var(--accent)] text-[var(--accent-fg,#fff)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>{v}</button>
          ))}
        </div>
        <p className="text-sm text-[var(--fg-muted)]">{lista.length} de {filas.length}</p>
      </div>

      {aviso && <p role={aviso.ok ? "status" : "alert"} className={`rounded-[var(--radius)] px-3 py-2 text-sm ${aviso.ok ? "bg-[var(--surface-2)] text-[#157a4a]" : "bg-[#b4232a]/10 text-[#b4232a]"}`}>{aviso.texto}</p>}

      <ul className="flex flex-col gap-2">
        {lista.map((f) => (
          <li key={f.id} className={`rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3 ${f.activo ? "" : "opacity-70"}`}>
            {editando === f.id ? (
              <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); correr(() => editarComentarista(f.id, nombre, bio), () => setEditando(null)); }}>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre" className={campo} autoFocus />
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} placeholder="Biografía corta (opcional)" aria-label="Biografía" className={`${campo} resize-y`} />
                <div className="flex gap-2">
                  <button disabled={ocupado} className="lx-btn disabled:opacity-60">{ocupado ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Check size={15} aria-hidden />} Guardar</button>
                  <button type="button" onClick={() => setEditando(null)} className="inline-flex items-center gap-1 px-3 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"><X size={14} aria-hidden /> Cancelar</button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {f.nombre}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${f.activo ? "bg-[#157a4a]/12 text-[#0f5a37]" : "bg-black/8 text-[var(--fg-muted)]"}`}>{f.activo ? "Activo" : "Inactivo"}</span>
                    {f.cuenta && <span className="rounded-full bg-[var(--accent)]/12 px-2 py-0.5 text-xs font-semibold text-[var(--accent)]">Registrado en la plataforma{f.cuentaActiva === false ? " · cuenta inactiva" : ""}</span>}
                  </p>
                  <p className="text-xs text-[var(--fg-muted)]">{f.notas} nota{f.notas === 1 ? "" : "s"}{f.cuenta ? ` · ${f.cuenta}` : ""}{f.bio ? ` · ${f.bio.slice(0, 90)}${f.bio.length > 90 ? "…" : ""}` : ""}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => { setEditando(f.id); setNombre(f.nombre); setBio(f.bio); setAviso(null); }} className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium hover:border-[var(--accent)]"><Pencil size={13} aria-hidden /> Editar</button>
                  <button type="button" disabled={ocupado} onClick={() => correr(() => activarComentarista(f.id, !f.activo))} className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium hover:border-[var(--accent)] disabled:opacity-60"><Power size={13} aria-hidden /> {f.activo ? "Inactivar" : "Activar"}</button>
                  <button type="button" disabled={ocupado} onClick={() => { if (window.confirm(`¿Borrar a «${f.nombre}»? No se puede deshacer.`)) correr(() => borrarComentarista(f.id)); }} className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[#b4232a] hover:border-[#b4232a] disabled:opacity-60"><Trash2 size={13} aria-hidden /> Borrar</button>
                </div>
              </div>
            )}
          </li>
        ))}
        {!lista.length && <li className="rounded-[var(--radius)] border border-dashed border-[var(--border)] px-3 py-6 text-center text-sm text-[var(--fg-muted)]">No hay nadie con ese filtro.</li>}
      </ul>
    </div>
  );
}
