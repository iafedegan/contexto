"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteEdition, previewEdition, saveEdition, sendEditionChunk, sendTestEmail } from "../actions";

// Contenido editable de la edición.
type Content = { subject: string; preheader: string; intro: string; articleSlugs: string[] };
// Nota que se puede elegir para la edición.
type Art = { slug: string; title: string; categoryName: string | null };

// Editor de una edición del boletín: asunto, textos, notas elegidas y envío.
export function EditionEditor({ id, status, recipients, progress, initial, articles }: {
  id: string; status: string; recipients: number; progress: { delivered: number; total: number; failed: number };
  initial: Content; articles: Art[];
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">{label("Asunto")}<input className="lx-input" value={c.subject} disabled={locked} onChange={(e) => setC({ ...c, subject: e.target.value })} maxLength={150} /></label>
          <label className="flex flex-col gap-1">{label("Texto de vista previa (preheader)")}<input className="lx-input" value={c.preheader} disabled={locked} onChange={(e) => setC({ ...c, preheader: e.target.value })} maxLength={200} /></label>
          <label className="flex flex-col gap-1">{label("Mensaje de la redacción")}<textarea rows={5} className="lx-input" value={c.intro} disabled={locked} onChange={(e) => setC({ ...c, intro: e.target.value })} /></label>
          <div className="flex flex-col gap-2">
            {label(`Notas (${c.articleSlugs.length}/12) — la primera es la destacada`)}
            {c.articleSlugs.map((s, i) => (
              <div key={s} className="flex items-center gap-2 rounded border border-[var(--border)] p-2 text-sm">
                <span className="flex-1 truncate">{i + 1}. {articles.find((a) => a.slug === s)?.title ?? s}</span>
                {!locked && <><button onClick={() => move(i, -1)}>↑</button><button onClick={() => move(i, 1)}>↓</button><button onClick={() => toggle(s)}>✕</button></>}
              </div>
            ))}
            {!locked && (
              <select className="lx-input" value="" onChange={(e) => e.target.value && toggle(e.target.value)}>
                <option value="">Añadir nota publicada…</option>
                {articles.filter((a) => !c.articleSlugs.includes(a.slug)).map((a) => <option key={a.slug} value={a.slug}>{a.title}</option>)}
              </select>
            )}
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

        <div className="flex flex-col gap-2">
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
