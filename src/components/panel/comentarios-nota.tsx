"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { comentarNota, comentariosDeNota } from "@/app/panel/(app)/articulos/comentarios-actions";
import type { Comentario } from "@/lib/comentarios-notas";

const ROL: Record<string, string> = { redactor: "Redactor", disenador: "Diseñador", editor: "Editor", administrador: "Administrador" };
const cuando = (iso: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Bogota" }).format(new Date(iso));

/**
 * Conversación de la revisión de una nota: quien la tiene a cargo, quien la revisa y el diseñador se dejan comentarios. Al abrirla, los comentarios
 * se dan por leídos (la otra parte ve un aviso en el listado de artículos mientras no los lea).
 */
export function ComentariosNota({ articleId }: { articleId: string }) {
  const [lista, setLista] = useState<Comentario[] | null>(null);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const [enviando, enviar] = useTransition();
  const fin = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vigente = true;
    comentariosDeNota(articleId)
      .then((r) => { if (!vigente) return; if (r.ok) setLista(r.comentarios); else { setError(r.message); setLista([]); } })
      .catch(() => { if (vigente) { setError("No se pudieron cargar los comentarios."); setLista([]); } });
    return () => { vigente = false; };
  }, [articleId]);

  useEffect(() => { fin.current?.scrollIntoView({ block: "nearest" }); }, [lista?.length]);

  function comentar() {
    const t = texto.trim();
    if (!t) return;
    setError("");
    enviar(async () => {
      const r = await comentarNota(articleId, t);
      if (!r.ok) return setError(r.message);
      setLista(r.comentarios);
      setTexto("");
    });
  }

  return (
    <section aria-label="Comentarios de la nota" className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--fg)] shadow-[var(--shadow)]">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><MessageSquare size={16} aria-hidden className="text-[var(--accent)]" /> Comentarios <span className="font-normal text-[var(--fg-muted)]">({lista?.length ?? 0})</span></h2>
      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1" role="log" aria-live="polite">
        {lista === null && <p className="inline-flex items-center gap-1.5 text-xs text-[var(--fg-muted)]"><Loader2 size={12} className="animate-spin" /> Cargando…</p>}
        {lista?.length === 0 && !error && <p className="text-xs text-[var(--fg-muted)]">Todavía no hay comentarios. Escribe el primero: la otra persona verá un aviso en «Artículos».</p>}
        {lista?.map((c) => (
          <div key={c.id} className={`max-w-[92%] rounded-[var(--radius)] px-3 py-2 text-sm ${c.mio ? "self-end bg-[var(--accent)]/12" : "self-start bg-[var(--surface-2)]"}`}>
            <p className="text-[0.7rem] text-[var(--fg-muted)]"><strong className="text-[var(--fg)]">{c.mio ? "Tú" : c.autor}</strong>{c.autorRol ? ` · ${ROL[c.autorRol] ?? c.autorRol}` : ""} · {cuando(c.fecha)}</p>
            <p className="mt-0.5 whitespace-pre-line break-words">{c.texto}</p>
          </div>
        ))}
        <div ref={fin} />
      </div>
      {error && <p role="alert" className="text-xs text-[var(--danger,#b4442e)]">{error}</p>}
      <div className="flex items-end gap-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, 2000))}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); comentar(); } }}
          rows={2}
          placeholder="Deja un comentario sobre la nota… (Ctrl+Enter para enviar)"
          aria-label="Escribe un comentario"
          className="min-w-0 flex-1 resize-none rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)]"
        />
        <button type="button" onClick={comentar} disabled={enviando || !texto.trim()} className="lx-btn !px-3 disabled:opacity-50">
          {enviando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Comentar
        </button>
      </div>
    </section>
  );
}
