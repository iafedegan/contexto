"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GripVertical, Inbox, X, ArrowUp, ArrowDown } from "lucide-react";
import { BibliotecaNotas, MIME_NOTA, type Nota } from "./biblioteca-notas";
import { deleteEdition, previewEdition, saveEdition, sendEditionChunk, sendTestEmail } from "../actions";

// Contenido editable de la edición.
type Content = { subject: string; preheader: string; intro: string; articleSlugs: string[] };

// Editor de una edición del boletín: asunto, textos, notas elegidas y envío.
export function EditionEditor({ id, status, recipients, progress, initial, articles }: {
  id: string; status: string; recipients: number; progress: { delivered: number; total: number; failed: number };
  initial: Content; articles: Nota[];
}) {
  const router = useRouter();
  const [c, setC] = useState(initial);
  const [html, setHtml] = useState("");
  const [mobile, setMobile] = useState(false);
  const [msg, setMsg] = useState("");
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const [prog, setProg] = useState(progress);
  const [pending, start] = useTransition();
  const locked = status === "enviada";
  // Posición de la línea de inserción mientras se arrastra, y nota que se está moviendo dentro del boletín.
  const [sobre, setSobre] = useState<number | null>(null);
  const [moviendo, setMoviendo] = useState<string | null>(null);
  const usadas = new Set(c.articleSlugs);

  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await previewEdition(c);
      if (r.ok && r.html) setHtml(r.html);
    }, 500);
    return () => clearTimeout(t);
  }, [c]);

  // Marca o desmarca una nota de la edición.
  const toggle = (slug: string) =>
    setC((p) => ({ ...p, articleSlugs: p.articleSlugs.includes(slug) ? p.articleSlugs.filter((s) => s !== slug) : [...p.articleSlugs, slug].slice(0, 12) }));
  // Sube o baja una nota en el orden de la edición.
  const move = (i: number, d: number) =>
    setC((p) => {
      const a = [...p.articleSlugs]; const j = i + d;
      if (j < 0 || j >= a.length) return p;
      [a[i], a[j]] = [a[j], a[i]];
      return { ...p, articleSlugs: a };
    });

  // Pone una nota en una posición (al soltar): si ya estaba, la mueve; si es nueva, la inserta.
  const colocar = (slug: string, pos: number) =>
    setC((p) => {
      const sin = p.articleSlugs.filter((x) => x !== slug);
      const antes = p.articleSlugs.indexOf(slug);
      const i = Math.max(0, Math.min(sin.length, antes >= 0 && antes < pos ? pos - 1 : pos));
      return { ...p, articleSlugs: [...sin.slice(0, i), slug, ...sin.slice(i)].slice(0, 12) };
    });
  const soltar = (e: React.DragEvent, pos: number) => {
    e.preventDefault();
    const slug = e.dataTransfer.getData(MIME_NOTA);
    setSobre(null); setMoviendo(null);
    if (slug && !locked) colocar(slug, pos);
  };

  // Envía la edición a los suscriptores por tandas, tras pedir confirmación.
  async function send() {
    if (!confirm(`¿Enviar «${c.subject}» a ${recipients} suscriptores? No se puede deshacer.`)) return;
    setSending(true);
    const s = await saveEdition(id, c);
    if (!s.ok) { setMsg(s.message); setSending(false); return; }
    for (let i = 0; i < 500; i++) {
      const r = await sendEditionChunk(id);
      setProg((p) => ({ ...p, delivered: r.delivered, total: r.total }));
      if (!r.ok) { setMsg(r.message ?? "Error al enviar. Pulsa de nuevo para reanudar."); break; }
      if (r.done) { setMsg("Edición enviada."); location.reload(); return; }
    }
    setSending(false);
  }

  // Etiqueta de un campo del formulario.
  const label = (t: string) => <span className="text-sm font-medium">{t}</span>;
  return (
    <div className="flex flex-col gap-4">
      <Link href="/panel/newsletter" className="text-sm text-[var(--fg-muted)] underline">← Newsletter</Link>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,21rem)_minmax(0,1fr)_minmax(0,1fr)]">
        <BibliotecaNotas notas={articles} usadas={usadas} onAgregar={(sl) => toggle(sl)} bloqueada={locked} />
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">{label("Asunto")}<input className="lx-input" value={c.subject} disabled={locked} onChange={(e) => setC({ ...c, subject: e.target.value })} maxLength={150} /></label>
          <label className="flex flex-col gap-1">{label("Texto de vista previa (preheader)")}<input className="lx-input" value={c.preheader} disabled={locked} onChange={(e) => setC({ ...c, preheader: e.target.value })} maxLength={200} /></label>
          <label className="flex flex-col gap-1">{label("Mensaje de la redacción")}<textarea rows={5} className="lx-input" value={c.intro} disabled={locked} onChange={(e) => setC({ ...c, intro: e.target.value })} /></label>
          <div className="flex flex-col gap-2">
            {label(`Armado del boletín (${c.articleSlugs.length}/12) — la primera es la destacada`)}
            <ol
              aria-label="Notas del boletín, en orden"
              onDragOver={(e) => { if (!locked) { e.preventDefault(); setSobre((v) => v ?? c.articleSlugs.length); } }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSobre(null); }}
              onDrop={(e) => soltar(e, sobre ?? c.articleSlugs.length)}
              className={`flex min-h-40 flex-col gap-1.5 rounded-[var(--radius-lg)] border-2 border-dashed p-2 transition ${sobre !== null ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border-strong)]"}`}
            >
              {c.articleSlugs.length === 0 && (
                <li className="grid flex-1 place-items-center gap-1 py-8 text-center text-sm text-[var(--fg-muted)]"><Inbox size={22} aria-hidden /> Arrastra aquí las notas<span className="text-xs">o pulsa «+» en la lista de la izquierda</span></li>
              )}
              {c.articleSlugs.map((sl, k) => {
                const a = articles.find((x) => x.slug === sl);
                return (
                  <li key={sl}
                    onDragOver={(e) => { if (locked) return; e.preventDefault(); e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setSobre(e.clientY < r.top + r.height / 2 ? k : k + 1); }}
                    onDrop={(e) => { e.stopPropagation(); soltar(e, sobre ?? k); }}
                    className="relative">
                    {sobre === k && <span aria-hidden className="absolute -top-1 left-0 right-0 h-0.5 rounded bg-[var(--accent)]" />}
                    <div draggable={!locked}
                      onDragStart={(e) => { e.dataTransfer.setData(MIME_NOTA, sl); e.dataTransfer.effectAllowed = "move"; setMoviendo(sl); }}
                      onDragEnd={() => { setMoviendo(null); setSobre(null); }}
                      className={`flex items-center gap-2 rounded-[var(--radius)] border bg-[var(--surface)] p-2 text-sm ${moviendo === sl ? "opacity-40" : ""} ${k === 0 ? "border-[var(--accent)]" : "border-[var(--border)]"} ${locked ? "" : "cursor-grab active:cursor-grabbing"}`}>
                      {!locked && <GripVertical size={16} aria-hidden className="shrink-0 text-[var(--fg-muted)]" />}
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-xs font-bold tabular-nums">{k + 1}</span>
                      <span className="min-w-0 flex-1"><span className="line-clamp-2 font-medium leading-snug">{a?.title ?? sl}</span><span className="text-xs text-[var(--fg-muted)]">{k === 0 ? "Destacada · " : ""}{a?.parentName ? `${a.parentName} › ` : ""}{a?.categoryName ?? ""}</span></span>
                      {!locked && (
                        <span className="flex shrink-0 items-center">
                          <button type="button" aria-label="Subir" disabled={k === 0} onClick={() => move(k, -1)} className="grid size-8 place-items-center rounded-full hover:bg-[var(--surface-2)] disabled:opacity-30"><ArrowUp size={15} aria-hidden /></button>
                          <button type="button" aria-label="Bajar" disabled={k === c.articleSlugs.length - 1} onClick={() => move(k, 1)} className="grid size-8 place-items-center rounded-full hover:bg-[var(--surface-2)] disabled:opacity-30"><ArrowDown size={15} aria-hidden /></button>
                          <button type="button" aria-label="Quitar del boletín" onClick={() => toggle(sl)} className="grid size-8 place-items-center rounded-full hover:bg-[#b4232a]/10 hover:text-[#b4232a]"><X size={15} aria-hidden /></button>
                        </span>
                      )}
                    </div>
                    {sobre === k + 1 && k === c.articleSlugs.length - 1 && <span aria-hidden className="absolute -bottom-1 left-0 right-0 h-0.5 rounded bg-[var(--accent)]" />}
                  </li>
                );
              })}
            </ol>
          </div>

          {locked ? (
            <p className="text-sm">Enviada: {prog.delivered} entregados{prog.failed ? `, ${prog.failed} fallidos` : ""}.</p>
          ) : (
            <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4">
              <div className="flex flex-wrap gap-2">
                <button className="lx-btn-ghost" disabled={pending || sending} onClick={() => start(async () => setMsg((await saveEdition(id, c)).message))}>Guardar borrador</button>
                <button className="lx-btn-ghost text-red-600" disabled={sending} onClick={async () => { if (confirm("¿Eliminar este borrador?")) { await deleteEdition(id); router.push("/panel/newsletter"); } }}>Eliminar</button>
              </div>
              <div className="flex gap-2">
                <input className="lx-input flex-1" type="email" placeholder="correo para la prueba" value={to} onChange={(e) => setTo(e.target.value)} />
                <button className="lx-btn-ghost" disabled={pending || sending} onClick={() => start(async () => setMsg((await sendTestEmail(c, to)).message))}>Enviar prueba</button>
              </div>
              <button className="lx-btn" disabled={sending || recipients === 0} onClick={send}>
                {sending ? `Enviando… ${prog.delivered}/${prog.total || recipients}` : status === "enviando" ? "Reanudar envío" : `Enviar a ${recipients} suscriptores`}
              </button>
            </div>
          )}
          {msg && <p className="text-sm text-[var(--accent)]" role="status">{msg}</p>}
        </div>

        <div className="flex flex-col gap-2 lg:col-span-2 xl:col-span-1">
          <div className="flex gap-2 text-sm">
            <button className={mobile ? "text-[var(--fg-muted)]" : "font-semibold"} onClick={() => setMobile(false)}>Escritorio</button>
            <button className={mobile ? "font-semibold" : "text-[var(--fg-muted)]"} onClick={() => setMobile(true)}>Móvil</button>
          </div>
          <iframe title="Vista previa del correo" srcDoc={html} sandbox="" className="mx-auto h-[720px] rounded border border-[var(--border)] bg-white" style={{ width: mobile ? 390 : "100%" }} />
        </div>
      </div>
    </div>
  );
}
