"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { asignarNota } from "@/app/panel/(app)/asignaciones/actions";

/** Formulario para preescribir una nota y asignarla al editor elegido. */
export function AsignarNotaForm({ editores, secciones }: { editores: { id: string; nombre: string; rol: string }[]; secciones: { id: string; nombre: string }[] }) {
  const [pend, run] = useTransition();
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [v, setV] = useState({ titulo: "", resumen: "", texto: "", categoryId: "", editorId: "", mensaje: "" });
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }));
  const campo = "lx-input w-full text-sm";
  const etiqueta = "lx-kicker !text-[0.68rem] text-[var(--fg-muted)]";

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setAviso(null);
        run(async () => {
          const r = await asignarNota(v);
          setAviso({ ok: r.ok, texto: r.message });
          if (r.ok) setV({ titulo: "", resumen: "", texto: "", categoryId: "", editorId: v.editorId, mensaje: "" });
        });
      }}
    >
      <label className="flex flex-col gap-1">
        <span className={etiqueta}>Asignar a</span>
        <select value={v.editorId} onChange={(e) => set({ editorId: e.target.value })} required className={campo}>
          <option value="">Elige un editor…</option>
          {editores.map((e) => (
            <option key={e.id} value={e.id}>{e.nombre}{e.rol === "administrador" ? " (administrador)" : ""}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className={etiqueta}>Título</span>
        <input value={v.titulo} onChange={(e) => set({ titulo: e.target.value })} required minLength={5} maxLength={200} className={campo} placeholder="Titular de la nota" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Sección</span>
          <select value={v.categoryId} onChange={(e) => set({ categoryId: e.target.value })} className={campo}>
            <option value="">Sin sección todavía</option>
            {secciones.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Resumen (opcional)</span>
          <input value={v.resumen} onChange={(e) => set({ resumen: e.target.value })} maxLength={400} className={campo} placeholder="Una o dos frases" />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className={etiqueta}>La nota (o su esquema)</span>
        <textarea value={v.texto} onChange={(e) => set({ texto: e.target.value })} required minLength={20} rows={12} className={`${campo} leading-relaxed`} placeholder="Escribe el texto. Separa los párrafos con una línea en blanco." />
      </label>
      <label className="flex flex-col gap-1">
        <span className={etiqueta}>Mensaje para el editor (opcional)</span>
        <input value={v.mensaje} onChange={(e) => set({ mensaje: e.target.value })} maxLength={600} className={campo} placeholder="Qué revisar, fuentes por confirmar, para cuándo…" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pend} className="lx-btn">
          <Send size={15} /> {pend ? "Asignando…" : "Asignar al editor"}
        </button>
        {aviso && (
          <p role="status" className={`text-sm ${aviso.ok ? "text-[var(--accent)]" : "text-[var(--danger)]"}`}>{aviso.texto}</p>
        )}
      </div>
    </form>
  );
}
