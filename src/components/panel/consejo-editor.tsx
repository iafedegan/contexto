"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, CalendarRange, Check, ChevronRight, Clock, Loader2, Plus, Rocket, Sparkles, Trash2, X } from "lucide-react";
import { activarPlan, aprobar, armarPauta, cambiarEstadoPlan, guardarCasilla, guardarPlan, proponerTemas, quitarCasilla, redactarAhora } from "@/app/panel/(app)/consejo/actions";
import { ESTADOS_CASILLA, notasPorSemana, sanearConfig, sumarDias, type Aprobacion, type ConfigConsejo, type EstadoCasilla, type EstadoPlan, type TemaConsejo } from "@/lib/consejo/plan";

export type CasillaVista = { id: string; publishAt: string; sectionSlug: string; topic: string; angle: string; brief: string; priority: number; approval: Aprobacion; status: EstadoCasilla; articleId: string | null; error: string | null };
type Seccion = { slug: string; name: string };

const DIAS = [[1, "Lun"], [2, "Mar"], [3, "Mié"], [4, "Jue"], [5, "Vie"], [6, "Sáb"], [7, "Dom"]] as const;
const COLOR: Record<EstadoCasilla, string> = {
  planificada: "border-[var(--border-strong)]", redactando: "border-amber-500", revision: "border-[var(--accent)] bg-[var(--accent)]/10",
  programada: "border-emerald-600 bg-emerald-600/10", publicada: "border-emerald-700 bg-emerald-700/20", fallida: "border-red-600 bg-red-600/10", omitida: "opacity-40 border-[var(--border)]",
};
const campo = "w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-white px-3 py-2 text-sm text-[#0b0b0b] placeholder:text-[var(--fg-muted)]";
const boton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition disabled:opacity-50";
const primario = `${boton} bg-[var(--accent)] text-[var(--accent-fg,#fff)] hover:opacity-90`;
const secundario = `${boton} border border-[var(--border-strong)] hover:border-[var(--accent)] hover:text-[var(--accent)]`;

// Día «AAAA-MM-DD» y hora «HH:MM» de un instante, en hora de Colombia.
const diaDe = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date(iso));
const horaDe = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
const nombreDia = (fecha: string) => new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", timeZone: "America/Bogota" }).format(new Date(`${fecha}T12:00:00-05:00`));

/**
 * Consejo de redacción: configura la semana, junta los temas (a mano o con IA), arma la pauta con IA y la muestra en un calendario con
 * horas. Cada casilla dice si sale con aprobación previa o sola; activar el plan hace que la IA redacte cada pieza a su tiempo.
 */
export function ConsejoEditor({ plan, casillas, secciones, puedePublicar }: { plan: { id: string; title: string; weekStart: string; status: EstadoPlan; config: ConfigConsejo; temas: TemaConsejo[] }; casillas: CasillaVista[]; secciones: Seccion[]; puedePublicar: boolean }) {
  const router = useRouter();
  const [pend, run] = useTransition();
  const [cfg, setCfg] = useState<ConfigConsejo>(plan.config);
  const [titulo, setTitulo] = useState(plan.title);
  const [temas, setTemas] = useState<TemaConsejo[]>(plan.temas);
  const [nuevoTema, setNuevoTema] = useState("");
  const [enfoque, setEnfoque] = useState("");
  const [nuevaHora, setNuevaHora] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const nombre = (slug: string) => secciones.find((s) => s.slug === slug)?.name ?? slug;
  const sel = casillas.find((c) => c.id === selId) ?? null;
  const editable = plan.status !== "cerrado";

  const hacer = (fn: () => Promise<{ ok: boolean; message?: string }>, despues?: () => void) =>
    run(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, texto: r.message ?? (r.ok ? "Listo." : "No se pudo.") });
      if (r.ok) { despues?.(); router.refresh(); }
    });
  const guardar = () => guardarPlan(plan.id, { titulo, config: sanearConfig(cfg), temas });
  const nSemana = useMemo(() => notasPorSemana(cfg), [cfg]);

  // Calendario: columnas = días del plan, filas = horas (las configuradas y las que traigan las casillas).
  const fechas = [...new Set([...cfg.dias.map((d) => sumarDias(plan.weekStart, d - 1)), ...casillas.map((c) => diaDe(c.publishAt))])].sort();
  const horas = [...new Set([...cfg.horas, ...casillas.map((c) => horaDe(c.publishAt))])].sort();
  const activas = casillas.filter((c) => c.status !== "omitida");
  const porRevisar = casillas.filter((c) => c.status === "revision");
  const cuota = (slug: string) => cfg.cuotas.find((q) => q.seccion === slug);
  const ponerCuota = (slug: string, porDia: number, aprobacion?: Aprobacion) =>
    setCfg((c) => ({ ...c, cuotas: [...c.cuotas.filter((q) => q.seccion !== slug), ...(porDia > 0 ? [{ seccion: slug, porDia, ...(aprobacion ? { aprobacion } : {}) }] : [])] }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/panel/consejo" className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--accent)]">← Consejos de redacción</Link>
        <div className="flex flex-wrap items-center gap-3">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={!editable} aria-label="Nombre del consejo" className="lx-display min-w-0 flex-1 bg-transparent text-2xl font-semibold tracking-tight outline-none focus:underline sm:text-3xl" />
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${plan.status === "activo" ? "border-emerald-600 text-emerald-600" : "border-[var(--border-strong)] text-[var(--fg-muted)]"}`}>{plan.status === "activo" ? "Activo" : plan.status === "cerrado" ? "Cerrado" : "Borrador"}</span>
        </div>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">Semana del {nombreDia(plan.weekStart)} al {nombreDia(sumarDias(plan.weekStart, 6))}. La IA propone y redacta; <strong>nada sale sin que un editor lo haya autorizado</strong>.</p>
      </div>

      {msg && <p role="status" className={`rounded-[var(--radius)] border px-4 py-2.5 text-sm ${msg.ok ? "border-emerald-600/50 bg-emerald-600/10" : "border-red-600/50 bg-red-600/10"}`}>{msg.texto}</p>}

      {/* 1 · La semana */}
      <section className="lx-card flex flex-col gap-5 p-5 sm:p-6">
        <h2 className="lx-display text-xl font-semibold"><span className="mr-2 text-[var(--accent)]">1</span>La semana</h2>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div>
              <p className="lx-kicker mb-2 text-[var(--fg-muted)]">Días que se publican</p>
              <div className="flex flex-wrap gap-1.5">
                {DIAS.map(([n, l]) => (
                  <button key={n} type="button" disabled={!editable} aria-pressed={cfg.dias.includes(n)} onClick={() => setCfg((c) => ({ ...c, dias: c.dias.includes(n) ? c.dias.filter((d) => d !== n) : [...c.dias, n].sort() }))} className={`min-h-10 min-w-12 rounded-full border px-3 text-sm font-medium ${cfg.dias.includes(n) ? "border-transparent bg-[var(--accent)] text-[var(--accent-fg,#fff)]" : "border-[var(--border-strong)] text-[var(--fg-muted)]"}`}>{l}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="lx-kicker mb-2 text-[var(--fg-muted)]">Horas de publicación (hora de Colombia)</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {cfg.horas.map((h) => (
                  <span key={h} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-[var(--border-strong)] pl-3 pr-1 text-sm tabular-nums">
                    <Clock size={13} aria-hidden /> {h}
                    <button type="button" aria-label={`Quitar ${h}`} disabled={!editable || cfg.horas.length <= 1} onClick={() => setCfg((c) => ({ ...c, horas: c.horas.filter((x) => x !== h) }))} className="grid size-7 place-items-center rounded-full hover:bg-[var(--surface-2)]"><X size={13} /></button>
                  </span>
                ))}
                <input type="time" value={nuevaHora} onChange={(e) => setNuevaHora(e.target.value)} disabled={!editable} aria-label="Nueva hora" className="min-h-9 rounded-full border border-[var(--border-strong)] bg-white px-3 text-sm text-[#0b0b0b]" />
                <button type="button" disabled={!editable || !nuevaHora} onClick={() => { setCfg((c) => ({ ...c, horas: [...new Set([...c.horas, nuevaHora])].sort() })); setNuevaHora(""); }} className={secundario}><Plus size={14} /> Añadir</button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm"><span className="lx-kicker text-[var(--fg-muted)]">Aprobación por defecto</span>
                <select value={cfg.aprobacion} disabled={!editable} onChange={(e) => setCfg((c) => ({ ...c, aprobacion: e.target.value as Aprobacion }))} className={campo}>
                  <option value="manual">Con aprobación previa de un editor</option>
                  <option value="auto" disabled={!puedePublicar}>Publicar automáticamente{puedePublicar ? "" : " (requiere poder publicar)"}</option>
                </select></label>
              <label className="flex flex-col gap-1 text-sm"><span className="lx-kicker text-[var(--fg-muted)]">Redactar con antelación de (h)</span>
                <input type="number" min={1} max={48} value={cfg.antelacionHoras} disabled={!editable} onChange={(e) => setCfg((c) => ({ ...c, antelacionHoras: Number(e.target.value) }))} className={campo} /></label>
            </div>
          </div>
          <div>
            <p className="lx-kicker mb-2 text-[var(--fg-muted)]">Notas por día y sección</p>
            <div className="flex flex-col divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)]">
              {secciones.map((s) => {
                const q = cuota(s.slug);
                return (
                  <div key={s.slug} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <span className={`min-w-0 flex-1 text-sm ${q ? "font-semibold" : "text-[var(--fg-muted)]"}`}>{s.name}</span>
                    <div className="flex items-center gap-1" role="group" aria-label={`Notas por día en ${s.name}`}>
                      <button type="button" disabled={!editable || !q} onClick={() => ponerCuota(s.slug, (q?.porDia ?? 0) - 1, q?.aprobacion)} className="grid size-9 place-items-center rounded-full border border-[var(--border-strong)]" aria-label="Menos">−</button>
                      <span className="w-6 text-center text-sm tabular-nums">{q?.porDia ?? 0}</span>
                      <button type="button" disabled={!editable || (q?.porDia ?? 0) >= 6} onClick={() => ponerCuota(s.slug, (q?.porDia ?? 0) + 1, q?.aprobacion)} className="grid size-9 place-items-center rounded-full border border-[var(--border-strong)]" aria-label="Más">+</button>
                    </div>
                    {q && (
                      <select value={q.aprobacion ?? cfg.aprobacion} disabled={!editable} onChange={(e) => ponerCuota(s.slug, q.porDia, e.target.value as Aprobacion)} aria-label={`Aprobación en ${s.name}`} className="rounded-[var(--radius)] border border-[var(--border-strong)] bg-white px-2 py-1.5 text-xs text-[#0b0b0b]">
                        <option value="manual">Con aprobación</option>
                        <option value="auto" disabled={!puedePublicar}>Automática</option>
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-sm text-[var(--fg-muted)]">Son <strong>{nSemana}</strong> notas en la semana.</p>
          </div>
        </div>
        <div><button type="button" disabled={pend || !editable} onClick={() => hacer(guardar)} className={secundario}>{pend ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Guardar la semana</button></div>
      </section>

      {/* 2 · Temas */}
      <section className="lx-card flex flex-col gap-4 p-5 sm:p-6">
        <h2 className="lx-display text-xl font-semibold"><span className="mr-2 text-[var(--accent)]">2</span>Temas del consejo</h2>
        <p className="text-sm text-[var(--fg-muted)]">Pon los temas que quieres cubrir esta semana o pide a la IA que busque la agenda del sector (con fuentes). Si no pones ninguno, la IA completa la pauta sola.</p>
        <div className="flex flex-wrap gap-2">
          <input value={nuevoTema} disabled={!editable} onChange={(e) => setNuevoTema(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && nuevoTema.trim().length >= 4) { setTemas((t) => [...t, { id: crypto.randomUUID(), texto: nuevoTema.trim(), prioridad: 2, origen: "manual" }]); setNuevoTema(""); } }} placeholder="Un tema, p. ej. «Vacunación contra la aftosa en el Caribe»" className={`${campo} min-w-0 flex-1`} />
          <button type="button" disabled={!editable || nuevoTema.trim().length < 4} onClick={() => { setTemas((t) => [...t, { id: crypto.randomUUID(), texto: nuevoTema.trim(), prioridad: 2, origen: "manual" }]); setNuevoTema(""); }} className={secundario}><Plus size={15} /> Añadir</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input value={enfoque} disabled={!editable} onChange={(e) => setEnfoque(e.target.value)} placeholder="Enfoque opcional para la IA (p. ej. «más sanidad animal y exportaciones»)" className={`${campo} min-w-0 flex-1`} />
          <button type="button" disabled={pend || !editable} onClick={() => hacer(async () => { await guardar(); const r = await proponerTemas(plan.id, enfoque); if (r.ok) setTemas(r.temas); return r; })} className={primario}>{pend ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Proponer temas con IA</button>
        </div>
        {temas.length > 0 && (
          <ul className="flex flex-col divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)]">
            {temas.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                {t.origen === "ia" && <Bot size={15} aria-label="Propuesto por la IA" className="shrink-0 text-[var(--accent)]" />}
                <div className="min-w-0 flex-1"><p className="text-sm font-medium">{t.texto}</p>{t.angulo && <p className="text-xs text-[var(--fg-muted)]">{t.angulo}</p>}</div>
                <select value={t.seccion ?? ""} disabled={!editable} onChange={(e) => setTemas((l) => l.map((x) => (x.id === t.id ? { ...x, seccion: e.target.value || undefined } : x)))} aria-label="Sección del tema" className="rounded-[var(--radius)] border border-[var(--border-strong)] bg-white px-2 py-1.5 text-xs text-[#0b0b0b]">
                  <option value="">Cualquier sección</option>
                  {secciones.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
                </select>
                <select value={t.prioridad} disabled={!editable} onChange={(e) => setTemas((l) => l.map((x) => (x.id === t.id ? { ...x, prioridad: Number(e.target.value) as 1 | 2 | 3 } : x)))} aria-label="Prioridad" className="rounded-[var(--radius)] border border-[var(--border-strong)] bg-white px-2 py-1.5 text-xs text-[#0b0b0b]">
                  <option value={1}>Prioritario</option><option value={2}>Normal</option><option value={3}>De apoyo</option>
                </select>
                <button type="button" aria-label="Quitar tema" disabled={!editable} onClick={() => setTemas((l) => l.filter((x) => x.id !== t.id))} className="grid size-9 place-items-center rounded-full hover:bg-[var(--surface-2)]"><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 3 · Pauta y calendario */}
      <section className="lx-card flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="lx-display flex-1 text-xl font-semibold"><span className="mr-2 text-[var(--accent)]">3</span>Pauta y calendario</h2>
          <button type="button" disabled={pend || !editable} onClick={() => hacer(async () => { await guardar(); return armarPauta(plan.id, enfoque); })} className={primario}>{pend ? <Loader2 size={15} className="animate-spin" /> : <CalendarRange size={15} />} {activas.length ? "Rearmar la pauta con IA" : "Armar la pauta con IA"}</button>
        </div>
        {activas.length === 0 ? (
          <p className="rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] p-6 text-center text-sm text-[var(--fg-muted)]">Todavía no hay pauta. Define la semana y pulsa «Armar la pauta con IA»: la IA reparte los temas por día, hora y sección.</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[44rem] border-separate border-spacing-1 text-left text-xs">
                <thead><tr><th className="w-14" />{fechas.map((f) => <th key={f} className="lx-kicker px-1 pb-1 text-[var(--fg-muted)]">{nombreDia(f)}</th>)}</tr></thead>
                <tbody>
                  {horas.map((h) => (
                    <tr key={h}>
                      <td className="align-top pr-1 pt-2 tabular-nums text-[var(--fg-muted)]">{h}</td>
                      {fechas.map((f) => (
                        <td key={f} className="align-top">
                          {casillas.filter((c) => c.status !== "omitida" && diaDe(c.publishAt) === f && horaDe(c.publishAt) === h).map((c) => <Chip key={c.id} c={c} nombre={nombre(c.sectionSlug)} activa={c.id === selId} onClick={() => setSelId(c.id === selId ? null : c.id)} />)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-4 md:hidden">
              {fechas.map((f) => {
                const delDia = activas.filter((c) => diaDe(c.publishAt) === f).sort((a, b) => a.publishAt.localeCompare(b.publishAt));
                return delDia.length ? (
                  <div key={f}><p className="lx-kicker mb-1 text-[var(--fg-muted)]">{nombreDia(f)}</p>
                    <div className="flex flex-col gap-1">{delDia.map((c) => <Chip key={c.id} c={c} nombre={nombre(c.sectionSlug)} hora activa={c.id === selId} onClick={() => setSelId(c.id === selId ? null : c.id)} />)}</div></div>
                ) : null;
              })}
            </div>
            <p className="text-xs text-[var(--fg-muted)]">{activas.length} piezas · {activas.filter((c) => c.approval === "auto").length} automáticas · toca una pieza para editarla.</p>
          </>
        )}

        {sel && <PanelCasilla key={sel.id} c={sel} secciones={secciones} puedePublicar={puedePublicar} onClose={() => setSelId(null)} onGuardar={(d) => hacer(() => guardarCasilla(sel.id, d))} onQuitar={() => hacer(() => quitarCasilla(sel.id), () => setSelId(null))} onAprobar={() => hacer(() => aprobar(sel.id))} pend={pend} />}
      </section>

      {porRevisar.length > 0 && (
        <section className="lx-card flex flex-col gap-3 p-5 sm:p-6">
          <h2 className="lx-display text-xl font-semibold">Esperando tu aprobación ({porRevisar.length})</h2>
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {porRevisar.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{c.topic}</p><p className="text-xs text-[var(--fg-muted)]">{nombre(c.sectionSlug)} · sale {nombreDia(diaDe(c.publishAt))} {horaDe(c.publishAt)}{c.error ? ` · ${c.error}` : ""}</p></div>
                {c.articleId && <Link href={`/panel/articulos/${c.articleId}?modo=ia&paso=vista`} className={secundario}>Revisar la nota <ChevronRight size={14} /></Link>}
                <button type="button" disabled={pend || !puedePublicar} title={puedePublicar ? "" : "Tu cuenta no puede publicar"} onClick={() => hacer(() => aprobar(c.id))} className={primario}><Check size={15} /> Aprobar y programar</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 4 · Activar */}
      <section className="lx-card flex flex-col gap-3 p-5 sm:p-6">
        <h2 className="lx-display text-xl font-semibold"><span className="mr-2 text-[var(--accent)]">4</span>Poner en marcha</h2>
        <p className="text-sm leading-relaxed text-[var(--fg-muted)]">Al activar el plan, la IA redacta cada pieza <strong>{cfg.antelacionHoras} h antes de su hora</strong> con la misma tubería verificada del asistente (sin inventar cifras ni citas) y con tu estilo de escritura. Las piezas «con aprobación» quedan en revisión hasta que un editor las apruebe; las «automáticas» solo se programan si la nota pasa el control de calidad (300 palabras como mínimo, con fuentes y sin marcadores); si no lo pasa, esperan tu aprobación.</p>
        <div className="flex flex-wrap gap-2">
          {plan.status !== "activo" && editable && <button type="button" disabled={pend || activas.length === 0} onClick={() => hacer(async () => { await guardar(); return activarPlan(plan.id); })} className={primario}><Rocket size={15} /> Activar el plan</button>}
          {plan.status === "activo" && <>
            <button type="button" disabled={pend} onClick={() => hacer(() => redactarAhora(plan.id))} className={primario}>{pend ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Redactar lo que toque ahora</button>
            <button type="button" disabled={pend} onClick={() => hacer(() => cambiarEstadoPlan(plan.id, "borrador"))} className={secundario}>Pausar</button>
          </>}
          {editable && <button type="button" disabled={pend} onClick={() => hacer(() => cambiarEstadoPlan(plan.id, "cerrado"))} className={secundario}>Cerrar el consejo</button>}
        </div>
      </section>
    </div>
  );
}

// Una pieza en el calendario.
function Chip({ c, nombre, activa, onClick, hora }: { c: CasillaVista; nombre: string; activa: boolean; onClick: () => void; hora?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activa} className={`flex w-full flex-col gap-0.5 rounded-[var(--radius)] border px-2 py-1.5 text-left transition hover:border-[var(--accent)] ${COLOR[c.status]} ${activa ? "ring-2 ring-[var(--accent)]" : ""}`}>
      <span className="flex items-center justify-between gap-1 text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--fg-muted)]"><span className="truncate">{hora ? `${horaDe(c.publishAt)} · ` : ""}{nombre}</span><span className="shrink-0">{c.approval === "auto" ? "⚡ auto" : "✋"}</span></span>
      <span className="line-clamp-2 text-xs font-medium leading-snug">{c.topic || "Sin tema"}</span>
      <span className="text-[0.68rem] text-[var(--fg-muted)]">{ESTADOS_CASILLA[c.status]}{c.priority === 1 ? " · prioritaria" : ""}</span>
    </button>
  );
}

// Edición de una pieza.
function PanelCasilla({ c, secciones, puedePublicar, onClose, onGuardar, onQuitar, onAprobar, pend }: { c: CasillaVista; secciones: Seccion[]; puedePublicar: boolean; onClose: () => void; onGuardar: (d: { topic: string; angle: string; brief: string; sectionSlug: string; publishAt: string; priority: number; approval: Aprobacion }) => void; onQuitar: () => void; onAprobar: () => void; pend: boolean }) {
  const [d, setD] = useState({ topic: c.topic, angle: c.angle, brief: c.brief, sectionSlug: c.sectionSlug, fecha: diaDe(c.publishAt), hora: horaDe(c.publishAt), priority: c.priority, approval: c.approval });
  const editable = c.status === "planificada" || c.status === "fallida";
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--accent)] bg-[var(--bg-2)] p-4">
      <div className="flex items-center justify-between"><p className="lx-kicker text-[var(--accent)]">Pieza · {ESTADOS_CASILLA[c.status]}</p><button type="button" onClick={onClose} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full hover:bg-[var(--surface-2)]"><X size={16} /></button></div>
      {c.error && <p className="rounded-[var(--radius)] border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs">{c.error}</p>}
      <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Tema (titular tentativo)</span><input value={d.topic} disabled={!editable} onChange={(e) => setD({ ...d, topic: e.target.value })} className={campo} /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Enfoque</span><input value={d.angle} disabled={!editable} onChange={(e) => setD({ ...d, angle: e.target.value })} className={campo} /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Encargo para la IA (qué contar y qué datos y fuentes confirmar)</span><textarea rows={4} value={d.brief} disabled={!editable} onChange={(e) => setD({ ...d, brief: e.target.value })} className={campo} /></label>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Sección</span><select value={d.sectionSlug} disabled={!editable} onChange={(e) => setD({ ...d, sectionSlug: e.target.value })} className={campo}>{secciones.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Día</span><input type="date" value={d.fecha} disabled={!editable} onChange={(e) => setD({ ...d, fecha: e.target.value })} className={campo} /></label>
        <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Hora</span><input type="time" value={d.hora} disabled={!editable} onChange={(e) => setD({ ...d, hora: e.target.value })} className={campo} /></label>
        <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Prioridad</span><select value={d.priority} disabled={!editable} onChange={(e) => setD({ ...d, priority: Number(e.target.value) })} className={campo}><option value={1}>Alta</option><option value={2}>Normal</option><option value={3}>De apoyo</option></select></label>
      </div>
      <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Cómo sale</span>
        <select value={d.approval} disabled={!editable} onChange={(e) => setD({ ...d, approval: e.target.value as Aprobacion })} className={campo}>
          <option value="manual">Con aprobación previa de un editor</option>
          <option value="auto" disabled={!puedePublicar}>Publicar automáticamente a su hora (si pasa el control de calidad)</option>
        </select></label>
      <div className="flex flex-wrap gap-2">
        {editable && <button type="button" disabled={pend} onClick={() => onGuardar({ topic: d.topic, angle: d.angle, brief: d.brief, sectionSlug: d.sectionSlug, publishAt: `${d.fecha}T${d.hora}:00-05:00`, priority: d.priority, approval: d.approval })} className={primario}><Check size={15} /> Guardar la pieza</button>}
        {editable && <button type="button" disabled={pend} onClick={onQuitar} className={secundario}><Trash2 size={15} /> Quitar</button>}
        {c.status === "revision" && <button type="button" disabled={pend || !puedePublicar} onClick={onAprobar} className={primario}><Check size={15} /> Aprobar y programar</button>}
        {c.articleId && <Link href={`/panel/articulos/${c.articleId}?modo=ia&paso=vista`} className={secundario}>Abrir la nota <ChevronRight size={14} /></Link>}
      </div>
    </div>
  );
}
