"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, ChevronDown, ChevronLeft, Copy, Download, Loader2, Sparkles } from "lucide-react";
import { BibliotecaNotas, type Nota } from "./biblioteca-notas";
import { ArmadoBoletin } from "./armado-boletin";
import { anadirNota, anadirSeccion, notasDeSeccion, slugsDeItems, type ItemEdicion, type NotaElegible } from "@/lib/newsletter/items";
import { redactarMensajeConIA } from "../ia-actions";
import { cancelarProgramacion, deleteEdition, duplicarEdicion, guardarAudiencia, previewEdition, programarEdicion, saveEdition, sendEditionChunk, sendTestEmail } from "../actions";
import { Destinatarios, nombrePais } from "./destinatarios";
import { describirAudiencia, type Audiencia } from "@/lib/newsletter/audiencia-tipos";
import { aLocalBogota, describirCuando } from "@/lib/newsletter/programacion";
import type { OpcionesAudiencia } from "@/lib/newsletter/audiencia";
import { DisenoBoletin, type DisenoEditable } from "./diseno-boletin";
import { descargarPdfBoletin } from "./pdf-boletin";

// Contenido editable de la edición.
type Content = { subject: string; preheader: string; intro: string; items: ItemEdicion[] };

// Editor de una edición del boletín: asunto, textos, notas elegidas y envío.
export function EditionEditor({ id, status, programadaPara, recipients: recipientsInicial, audiencia, opciones, progress, initial, articles, diseno, puedeDisenar }: {
  id: string; status: string; recipients: number;
  /** Cuándo sale (ISO) si la edición está programada. */
  programadaPara: string | null;
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
  // Solo un borrador se edita: programada, enviándose y enviada quedan fijas (una programada se cancela para volver a editarla).
  const locked = status !== "borrador";
  // Cuándo se programa: por defecto, mañana a las 7:00 a. m. (hora de Colombia).
  const [cuando, setCuando] = useState(() => aLocalBogota(new Date(Date.now() + 24 * 3600_000)).slice(0, 11) + "07:00");
  const [minimo] = useState(() => aLocalBogota(new Date(Date.now() + 5 * 60_000)));
  const [programando, setProgramando] = useState(false);
  const usadas = new Set(slugsDeItems(c.items));
  // Lo que hace falta de cada nota para traerla por sección o por «última hora».
  const elegibles: NotaElegible[] = articles.map((n) => ({ slug: n.slug, seccion: n.parentName ?? n.categoryName ?? "Sin sección", publishedAt: n.publishedAt, esUltimaHora: n.esUltimaHora }));
  const poner = (items: ItemEdicion[]) => setC((p) => ({ ...p, items }));

  // El contenido se guarda solo, con una pausa, mientras se edita (antes solo el botón «Guardar borrador» lo guardaba y salir de la
  // pantalla perdía el trabajo). Una edición ya programada o enviada no se toca.
  const [guardado, setGuardado] = useState<"idle" | "guardando" | "ok" | "error">("idle");
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    if (locked) return;
    const t = setTimeout(async () => {
      setGuardado("guardando");
      try {
        const r = await saveEdition(id, c);
        setGuardado(r.ok ? "ok" : "error");
      } catch {
        setGuardado("error");
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [c, id, locked]);

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
    // Una edición que ya empezó a enviarse está cerrada: solo se reanuda (guardar cambios ya no aplica).
    if (status === "borrador") {
      const s = await saveEdition(id, c);
      if (!s.ok) { setMsg(s.message); setSending(false); return; }
    }
    for (let i = 0; i < 500; i++) {
      const r = await sendEditionChunk(id);
      setProg((p) => ({ ...p, delivered: r.delivered, total: r.total }));
      if (!r.ok) { setMsg(r.message ?? "Error al enviar. Pulsa de nuevo para reanudar."); break; }
      if (r.done) { setMsg("Edición enviada."); location.reload(); return; }
    }
    setSending(false);
  }

  // Programa el envío para la hora elegida (hora de Colombia): guarda lo que hay en pantalla y deja la edición fija hasta que llegue su hora.
  async function programar() {
    setProgramando(true);
    const r = await programarEdicion(id, c, cuando);
    setMsg(r.message);
    setProgramando(false);
    if (r.ok) router.refresh();
  }
  // Quita la programación: la edición vuelve a ser un borrador editable.
  async function cancelar() {
    setProgramando(true);
    const r = await cancelarProgramacion(id);
    setMsg(r.message);
    setProgramando(false);
    router.refresh();
  }

  // Redacta con IA el saludo de la edición a partir de las notas elegidas (la persona lo lee y lo edita).
  const [redactando, setRedactando] = useState(false);
  const [avisoIa, setAvisoIa] = useState("");
  async function redactarConIa() {
    if (c.intro.trim() && !confirm("Ya hay un mensaje escrito. ¿Reemplazarlo por el que propone la IA?")) return;
    setRedactando(true);
    setAvisoIa("");
    try {
      const r = await redactarMensajeConIA(slugsDeItems(c.items));
      if (r.ok && r.texto) setC((p) => ({ ...p, intro: r.texto as string }));
      setAvisoIa(r.message);
    } catch {
      setAvisoIa("No se pudo redactar ahora. Inténtalo de nuevo.");
    } finally {
      setRedactando(false);
    }
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
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={pending} onClick={() => start(async () => { await duplicarEdicion(id); })} title="Crea un borrador nuevo con el mismo contenido, secciones y público: sirve para mandar lo mismo a otras ciudades o a otra hora." className="lx-btn-ghost !px-3 !py-1.5 text-xs">
            <Copy size={14} aria-hidden /> Duplicar
          </button>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status === "enviada" ? "bg-[#16a34a]/12 text-[#15803d]" : status === "enviando" || status === "programada" ? "bg-amber-500/15 text-amber-700" : "bg-[var(--surface-2)] text-[var(--fg-muted)]"}`}>
            {status === "enviada" ? "Enviada" : status === "enviando" ? "Enviando…" : status === "programada" ? "Programada" : "Borrador"} · {recipients} {recipients === 1 ? "destinatario" : "destinatarios"}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,21rem)_minmax(0,1fr)_minmax(0,1fr)]">
        <BibliotecaNotas notas={articles} usadas={usadas} onAgregar={(sl) => setC((p) => ({ ...p, items: anadirNota(p.items, sl) }))} onTraerSeccion={(nombre) => setC((p) => ({ ...p, items: anadirSeccion(p.items, nombre, notasDeSeccion(elegibles, nombre, p.items)) }))} bloqueada={locked} />
        <div className="flex min-w-0 flex-col gap-5">
          {/* Recorrido en pasos: qué dice, qué notas lleva, cómo se ve, a quién va y enviar. Cada paso dice qué se espera de la persona. */}
          <Paso n={1} titulo="Escribe el mensaje" resumen={c.subject.trim() || "Falta el asunto"} listo={c.subject.trim().length >= 3} ayuda="Lo primero que ve la persona al recibir el correo.">
            <label className="flex flex-col gap-1">
              {label("Asunto")}
              <input className="lx-input" value={c.subject} disabled={locked} onChange={(e) => setC({ ...c, subject: e.target.value })} maxLength={150} placeholder="Ej.: Lo más importante del sector esta semana" />
              <span className="text-xs text-[var(--fg-muted)]">Es el título del correo en la bandeja. Corto y claro.</span>
            </label>
            <label className="flex flex-col gap-1">
              {label("Resumen que se ve junto al asunto (opcional)")}
              <input className="lx-input" value={c.preheader} disabled={locked} onChange={(e) => setC({ ...c, preheader: e.target.value })} maxLength={200} placeholder="Una frase que invite a abrirlo" />
              <span className="text-xs text-[var(--fg-muted)]">Si lo dejas vacío, el correo muestra el comienzo del mensaje.</span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="flex flex-wrap items-center justify-between gap-2">
                {label("Saludo o mensaje de la redacción (opcional)")}
                <button
                  type="button"
                  onClick={redactarConIa}
                  disabled={locked || redactando || slugsDeItems(c.items).length === 0}
                  title={slugsDeItems(c.items).length === 0 ? "Elige primero las notas (paso 2)" : "Escribe un saludo con un resumen de las notas elegidas"}
                  className="lx-btn-ghost inline-flex items-center gap-1.5 !px-3 !py-1.5 text-xs"
                >
                  {redactando ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Sparkles size={13} aria-hidden />}
                  {redactando ? "Redactando…" : "Redactar con IA"}
                </button>
              </span>
              <textarea rows={4} className="lx-input" value={c.intro} disabled={locked} onChange={(e) => setC({ ...c, intro: e.target.value })} placeholder="Unas líneas antes de las noticias, o pulsa «Redactar con IA» y se escriben a partir de las notas que elegiste" />
              {avisoIa && <span role="status" className="text-xs text-[var(--accent)]">{avisoIa}</span>}
            </label>
          </Paso>

          <Paso n={2} titulo="Elige las notas" resumen={`${slugsDeItems(c.items).length} de 12 notas`} listo={slugsDeItems(c.items).length > 0} ayuda={`${slugsDeItems(c.items).length} de 12 notas. Pulsa «+» en la lista de la izquierda o arrástralas aquí; la primera es la destacada.`}>
            <ArmadoBoletin items={c.items} alCambiar={poner} notas={articles} elegibles={elegibles} bloqueado={locked} />
          </Paso>

          <Paso n={3} titulo="Cuida el diseño" opcional resumen="Ya viene con un diseño listo" ayuda="Colores, maquetación y tipografía. Cámbialo solo si quieres.">
            <DisenoBoletin valor={d} alCambiar={setD} puedeEditar={puedeDisenar} />
          </Paso>

          <Paso n={4} titulo="¿A quién va?" resumen={`${recipients} ${recipients === 1 ? "persona" : "personas"} · ${describirAudiencia(aud, (k) => opciones.ciudades.find((x) => x.clave === k)?.nombre ?? k, nombrePais)}`} listo={recipients > 0} ayuda="Todos los suscriptores confirmados, o solo un grupo (ciudad, tema, antigüedad).">
            <Destinatarios valor={aud} alCambiar={setAud} opciones={opciones} cuantos={recipients} bloqueada={status !== "borrador"} />
          </Paso>

          <Paso n={5} titulo="Revisa y envía" resumen={status === "enviada" ? "Enviada" : status === "programada" ? "Programada" : status === "enviando" ? "Enviando…" : "Borrador, sin enviar"} listo={status === "enviada"} ayuda="Prueba el correo contigo antes de mandarlo a todos.">
          {status === "enviada" ? (
            <p className="text-sm">Enviada: {prog.delivered} entregados{prog.failed ? `, ${prog.failed} fallidos` : ""}.</p>
          ) : status === "programada" && programadaPara ? (
            <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--accent)]/40 bg-[var(--accent)]/8 p-3 text-sm">
              <p className="inline-flex items-center gap-2 font-semibold"><CalendarClock size={16} aria-hidden className="text-[var(--accent)]" /> Programada para el {describirCuando(new Date(programadaPara))}</p>
              <p className="text-xs text-[var(--fg-muted)]">
                Hora de Colombia · {describirAudiencia(aud, (k) => opciones.ciudades.find((x) => x.clave === k)?.nombre ?? k, nombrePais)} ({recipients} {recipients === 1 ? "persona" : "personas"}). Sale sola a esa hora; puedes cancelarla para volver a editar.
              </p>
              <button type="button" className="lx-btn-ghost w-fit text-red-600" disabled={programando} onClick={cancelar}>{programando ? "Cancelando…" : "Cancelar programación"}</button>
            </div>
          ) : status === "enviando" ? (
            programadaPara ? (
              <p className="text-sm">Enviando… {prog.delivered}/{prog.total || recipients}. La programación termina el envío sola.</p>
            ) : (
              <button className="lx-btn" disabled={sending} onClick={send}>{sending ? `Enviando… ${prog.delivered}/${prog.total || recipients}` : "Reanudar envío"}</button>
            )
          ) : (
            <div className="flex flex-col gap-4">
              {/* Lista de revisión: qué falta antes de poder enviar. */}
              <ul className="flex flex-col gap-1.5 text-sm">
                {([
                  [c.subject.trim().length >= 3, "Tiene asunto", "Falta el asunto (paso 1)"],
                  [slugsDeItems(c.items).length > 0, "Lleva al menos una nota", "No lleva notas todavía (paso 2)"],
                  [recipients > 0, `Llega a ${recipients} ${recipients === 1 ? "persona" : "personas"}`, "No hay destinatarios: hace falta al menos un suscriptor confirmado (paso 4)"],
                ] as const).map(([ok, bien, mal]) => (
                  <li key={bien} className={`flex items-start gap-2 ${ok ? "text-[var(--fg)]" : "text-[#9a2f22]"}`}>
                    <span aria-hidden className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full text-[0.6rem] font-bold text-white ${ok ? "bg-[#16a34a]" : "bg-[#c2410c]"}`}>{ok ? "✓" : "!"}</span>
                    {ok ? bien : mal}
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--border)] p-3">
                <p className="text-sm font-medium">1. Pruébalo contigo</p>
                <div className="flex flex-wrap gap-2">
                  <input className="lx-input min-w-0 flex-1" type="email" placeholder="tu correo" value={to} onChange={(e) => setTo(e.target.value)} />
                  <button className="lx-btn-ghost" disabled={pending || sending} onClick={() => start(async () => setMsg((await sendTestEmail(c, to)).message))}>Enviar prueba</button>
                </div>
              </div>

              <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--border)] p-3">
                <p className="text-sm font-medium">2. Envíalo</p>
                <button className="lx-btn" disabled={sending || recipients === 0 || c.subject.trim().length < 3} onClick={send}>
                  {sending ? `Enviando… ${prog.delivered}/${prog.total || recipients}` : `Enviar ahora a ${recipients} ${recipients === 1 ? "persona" : "personas"}`}
                </button>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-[var(--fg-muted)]">
                    <span className="inline-flex items-center gap-1.5"><CalendarClock size={13} aria-hidden /> …o prográmalo (hora de Colombia)</span>
                    <input type="datetime-local" className="lx-input" value={cuando} min={minimo} onChange={(e) => setCuando(e.target.value)} />
                  </label>
                  <button className="lx-btn-ghost" disabled={programando || sending || recipients === 0 || !cuando} onClick={programar}>
                    {programando ? "Programando…" : "Programar"}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <button className="lx-btn-ghost !px-3 !py-1.5" disabled={pending || sending} onClick={() => start(async () => setMsg((await saveEdition(id, c)).message))}>Guardar borrador</button>
                <span role="status" aria-live="polite" className={`font-medium ${guardado === "error" ? "text-[var(--danger)]" : "text-[var(--fg-muted)]"}`}>
                  {guardado === "idle" && "Se guarda solo mientras escribes"}
                  {guardado === "guardando" && "Guardando…"}
                  {guardado === "ok" && "Guardado automáticamente ✓"}
                  {guardado === "error" && "No se pudo guardar: pulsa «Guardar borrador»"}
                </span>
                <button className="ml-auto text-red-600 underline" disabled={sending} onClick={async () => { if (confirm("¿Eliminar este borrador?")) { await deleteEdition(id); router.push("/panel/newsletter"); } }}>Eliminar borrador</button>
              </div>
            </div>
          )}
          {msg && <p className="text-sm text-[var(--accent)]" role="status">{msg}</p>}
          </Paso>
        </div>

        <div className="flex flex-col gap-2 lg:col-span-2 xl:sticky xl:top-4 xl:col-span-1 xl:self-start">
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
          <p className="-mt-1 text-right text-[0.7rem] text-[var(--fg-muted)]">Sale en páginas, como una revista. En «Destino» elige «Guardar como PDF».</p>
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

/**
 * Un paso del recorrido de la edición: plegado por defecto, con número (o ✓ cuando ya está), título, qué se espera de la persona y,
 * cerrado, el valor actual (`resumen`) para ver el estado de todo sin abrir nada.
 */
function Paso({ n, titulo, ayuda, resumen, listo, opcional, children }: { n: number; titulo: string; ayuda?: string; resumen?: string; listo?: boolean; opcional?: boolean; children: React.ReactNode }) {
  return (
    <details className="group rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] open:shadow-sm">
      <summary className="flex cursor-pointer list-none items-start gap-3 p-4">
        <span aria-hidden className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${listo ? "bg-[#16a34a] text-white" : "bg-[var(--accent)]/12 text-[var(--accent)]"}`}>{listo ? "✓" : n}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold leading-tight">{titulo}{opcional && <span className="ml-2 text-xs font-normal text-[var(--fg-muted)]">opcional</span>}</span>
          {resumen && <span className="mt-0.5 block truncate text-sm text-[var(--fg)] group-open:hidden">{resumen}</span>}
          {ayuda && <span className="mt-0.5 block text-xs leading-snug text-[var(--fg-muted)]">{ayuda}</span>}
        </span>
        <ChevronDown size={16} aria-hidden className="mt-1 shrink-0 text-[var(--fg-muted)] transition group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-4 border-t border-[var(--border)] p-4">{children}</div>
    </details>
  );
}
