"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Download, FileText, Loader2, Palette } from "lucide-react";
import { BibliotecaNotas, type Nota } from "./biblioteca-notas";
import { ArmadoBoletin } from "./armado-boletin";
import { anadirNota, anadirSeccion, notasDeSeccion, slugsDeItems, type ItemEdicion, type NotaElegible } from "@/lib/newsletter/items";
import { deleteEdition, guardarAudiencia, previewEdition, saveEdition, sendEditionChunk, sendTestEmail } from "../actions";
import { Destinatarios, nombrePais } from "./destinatarios";
import { describirAudiencia, type Audiencia } from "@/lib/newsletter/audiencia-tipos";
import type { OpcionesAudiencia } from "@/lib/newsletter/audiencia";
import { DisenoBoletin, type DisenoEditable } from "./diseno-boletin";
import { descargarPdfBoletin } from "./pdf-boletin";

// Contenido editable de la edición.
type Content = { subject: string; preheader: string; intro: string; items: ItemEdicion[] };

// Editor de una edición del boletín: asunto, textos, notas elegidas y envío.
export function EditionEditor({ id, status, recipients: recipientsInicial, audiencia, opciones, progress, initial, articles, diseno, puedeDisenar }: {
  id: string; status: string; recipients: number;
  /** A quién va y qué filtros se pueden elegir. */
  audiencia: Audiencia; opciones: OpcionesAudiencia; progress: { delivered: number; total: number; failed: number };
  initial: Content; articles: Nota[];
  /** Diseño guardado del correo y si esta persona puede cambiarlo. */
  diseno: DisenoEditable; puedeDisenar: boolean;
}) {
  const router = useRouter();
  const [c, setC] = useState(initial);
  const [html, setHtml] = useState("");
  // Diseño del correo (se previsualiza al instante; se guarda aparte) y pestaña activa del panel central.
  const [d, setD] = useState(diseno);
  const [panel, setPanel] = useState<"contenido" | "diseno">("contenido");
  // Descarga del PDF: mientras se genera y, si falla, el aviso.
  const [creandoPdf, setCreandoPdf] = useState(false);
  const [errorPdf, setErrorPdf] = useState("");
  const [mobile, setMobile] = useState(false);
  const [msg, setMsg] = useState("");
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  // Público de la edición: cada cambio se guarda (con una pausa) y devuelve cuántas personas la recibirían.
  const [aud, setAud] = useState(audiencia);
  const [cuantos, setCuantos] = useState(recipientsInicial);
  const primeraAud = useRef(true);
  useEffect(() => {
    if (primeraAud.current) { primeraAud.current = false; return; }
    const t = setTimeout(async () => {
      const r = await guardarAudiencia(id, aud);
      setCuantos(r.n);
      if (!r.ok) setMsg(r.message);
    }, 500);
    return () => clearTimeout(t);
  }, [aud, id]);
  const recipients = cuantos;
  const [prog, setProg] = useState(progress);
  const [pending, start] = useTransition();
  const locked = status === "enviada";
  const usadas = new Set(slugsDeItems(c.items));
  // Lo que hace falta de cada nota para traerla por sección o por «última hora».
  const elegibles: NotaElegible[] = articles.map((n) => ({ slug: n.slug, seccion: n.parentName ?? n.categoryName ?? "Sin sección", publishedAt: n.publishedAt, esUltimaHora: n.esUltimaHora }));
  const poner = (items: ItemEdicion[]) => setC((p) => ({ ...p, items }));

  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await previewEdition(c, { design: d, acento: d.acento });
      if (r.ok && r.html) setHtml(r.html);
    }, 400);
    return () => clearTimeout(t);
  }, [c, d]);

  // Envía la edición a los suscriptores por tandas, tras pedir confirmación.
  async function send() {
    const quien = describirAudiencia(aud, (k) => opciones.ciudades.find((x) => x.clave === k)?.nombre ?? k, nombrePais);
    if (!confirm(`¿Enviar «${c.subject}» a ${recipients} ${recipients === 1 ? "suscriptor" : "suscriptores"} (${quien})? No se puede deshacer.`)) return;
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

  // Descarga el boletín (tal como se ve en la vista previa, con el diseño actual) como PDF.
  async function descargarPdf() {
    if (!html) return;
    setErrorPdf("");
    setCreandoPdf(true);
    try {
      const nombre = (c.subject.trim() || "boletin").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "boletin";
      await descargarPdfBoletin(html, nombre);
    } catch (e) {
      console.error("PDF del boletín:", e);
      setErrorPdf("No se pudo crear el PDF. Inténtalo de nuevo.");
    } finally {
      setCreandoPdf(false);
    }
  }

  // Etiqueta de un campo del formulario.
  const label = (t: string) => <span className="text-sm font-medium">{t}</span>;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/panel/newsletter" aria-label="Volver al Newsletter" className="grid size-9 shrink-0 place-items-center rounded-full border border-[var(--border)] text-[var(--fg-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"><ChevronLeft size={18} /></Link>
          <div className="min-w-0">
            <p className="lx-kicker text-[var(--accent)]">Newsletter · edición</p>
            <h1 className="lx-display truncate text-xl font-semibold tracking-tight">{c.subject.trim() || "Edición sin asunto"}</h1>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status === "enviada" ? "bg-[#16a34a]/12 text-[#15803d]" : status === "enviando" ? "bg-amber-500/15 text-amber-700" : "bg-[var(--surface-2)] text-[var(--fg-muted)]"}`}>
          {status === "enviada" ? "Enviada" : status === "enviando" ? "Enviando…" : "Borrador"} · {recipients} {recipients === 1 ? "destinatario" : "destinatarios"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,21rem)_minmax(0,1fr)_minmax(0,1fr)]">
        <BibliotecaNotas notas={articles} usadas={usadas} onAgregar={(sl) => setC((p) => ({ ...p, items: anadirNota(p.items, sl) }))} onTraerSeccion={(nombre) => setC((p) => ({ ...p, items: anadirSeccion(p.items, nombre, notasDeSeccion(elegibles, nombre, p.items)) }))} bloqueada={locked} />
        <div className="flex flex-col gap-4">
          <div role="tablist" aria-label="Qué editar" className="flex gap-1 rounded-full bg-[var(--surface-2)] p-1 text-sm font-semibold">
            {([["contenido", "Contenido", FileText], ["diseno", "Diseño", Palette]] as const).map(([k, t, Icono]) => (
              <button key={k} type="button" role="tab" aria-selected={panel === k} onClick={() => setPanel(k)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 transition ${panel === k ? "bg-[var(--surface)] text-[var(--accent)] shadow-sm" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>
                <Icono size={14} aria-hidden /> {t}
              </button>
            ))}
          </div>
          {panel === "diseno" && <DisenoBoletin valor={d} alCambiar={setD} puedeEditar={puedeDisenar} />}
          <div className={panel === "contenido" ? "flex flex-col gap-4" : "hidden"}>
          <label className="flex flex-col gap-1">{label("Asunto")}<input className="lx-input" value={c.subject} disabled={locked} onChange={(e) => setC({ ...c, subject: e.target.value })} maxLength={150} /></label>
          <label className="flex flex-col gap-1">{label("Texto de vista previa (preheader)")}<input className="lx-input" value={c.preheader} disabled={locked} onChange={(e) => setC({ ...c, preheader: e.target.value })} maxLength={200} /></label>
          <label className="flex flex-col gap-1">{label("Mensaje de la redacción")}<textarea rows={5} className="lx-input" value={c.intro} disabled={locked} onChange={(e) => setC({ ...c, intro: e.target.value })} /></label>
          <ArmadoBoletin items={c.items} alCambiar={poner} notas={articles} elegibles={elegibles} bloqueado={locked} />

          <Destinatarios valor={aud} alCambiar={setAud} opciones={opciones} cuantos={recipients} bloqueada={status !== "borrador"} />

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
                {sending ? `Enviando… ${prog.delivered}/${prog.total || recipients}` : status === "enviando" ? "Reanudar envío" : `Enviar a ${recipients} ${recipients === 1 ? "suscriptor" : "suscriptores"}`}
              </button>
            </div>
          )}
          {msg && <p className="text-sm text-[var(--accent)]" role="status">{msg}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:col-span-2 xl:col-span-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="tablist" aria-label="Tamaño de la vista previa" className="flex w-fit gap-1 rounded-full bg-[var(--surface-2)] p-1 text-sm font-semibold">
            {([[false, "Escritorio"], [true, "Móvil"]] as const).map(([m, t]) => (
              <button key={t} type="button" role="tab" aria-selected={mobile === m} onClick={() => setMobile(m)}
                className={`rounded-full px-3 py-1 transition ${mobile === m ? "bg-[var(--surface)] text-[var(--accent)] shadow-sm" : "text-[var(--fg-muted)]"}`}>{t}</button>
            ))}
          </div>
          <button type="button" onClick={descargarPdf} disabled={creandoPdf || !html} className="lx-btn-ghost !px-3 !py-1.5 text-xs" title="Abre el cuadro de impresión con el boletín tal como se ve aquí: elige «Guardar como PDF» como destino. El PDF sale con texto y enlaces que se pueden pulsar.">
            {creandoPdf ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Download size={14} aria-hidden />} {creandoPdf ? "Preparando…" : "Descargar PDF"}
          </button>
          </div>
          <p className="-mt-1 text-right text-[0.7rem] text-[var(--fg-muted)]">Se abre el cuadro de impresión: en «Destino» elige «Guardar como PDF».</p>
          {errorPdf && <p role="alert" className="text-xs text-[var(--danger)]">{errorPdf}</p>}
          <VistaPrevia html={html} ancho={mobile ? 390 : 680} />
        </div>
      </div>
    </div>
  );
}

/**
 * Vista previa del correo a su tamaño real y reducida para que quepa: si se dibujara en el ancho de la columna (menos de 620 px) los
 * clientes verían la versión de móvil también en «Escritorio» y todas las maquetaciones parecerían iguales. El alto sigue al contenido.
 */
function VistaPrevia({ html, ancho }: { html: string; ancho: number }) {
  const caja = useRef<HTMLDivElement>(null);
  const marco = useRef<HTMLIFrameElement>(null);
  const [disponible, setDisponible] = useState(0);
  const [alto, setAlto] = useState(900);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setDisponible(el.clientWidth);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const escala = disponible ? Math.min(1, disponible / ancho) : 1;
  // Al cargar el contenido se mide su alto real (el iframe es del mismo origen y sin scripts, así que se puede leer).
  const medirAlto = () => {
    const h = marco.current?.contentDocument?.documentElement?.scrollHeight;
    if (h) setAlto(h);
  };

  return (
    <div ref={caja} className="max-h-[78vh] overflow-y-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)]">
      <div className="relative mx-auto" style={{ width: ancho * escala, height: alto * escala }}>
        <iframe
          ref={marco}
          title="Vista previa del correo"
          srcDoc={html}
          sandbox="allow-same-origin"
          onLoad={medirAlto}
          scrolling="no"
          className="absolute left-0 top-0 border-0 bg-white"
          style={{ width: ancho, height: alto, transform: `scale(${escala})`, transformOrigin: "top left" }}
        />
      </div>
    </div>
  );
}
