"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bot, Check, ChevronRight, Clock, Loader2, Plus, Rocket, Sparkles, Trash2, X } from "lucide-react";
import { activarPlan, aprobar, armarPauta, cambiarEstadoPlan, completarFicha, guardarCasilla, guardarPlan, proponerTemas, quitarCasilla, redactarAhora } from "@/app/panel/(app)/consejo/actions";
import { ConsejoBorrar } from "@/components/panel/consejo-borrar";
import { ESTADOS_CASILLA, GENEROS, PREGUNTAS_FICHA, VIGENCIAS, evaluarFicha, notasPorSemana, sanearConfig, sumarDias, type Aprobacion, type ConfigConsejo, type EstadoCasilla, type EstadoPlan, type FichaPauta, type FuentePrevista, type Genero, type TemaConsejo, type Vigencia } from "@/lib/consejo/plan";

export type CasillaVista = { id: string; publishAt: string; sectionSlug: string; topic: string; angle: string; brief: string; priority: number; approval: Aprobacion; status: EstadoCasilla; articleId: string | null; error: string | null; ficha: FichaPauta };
type Seccion = { slug: string; name: string };

const DIAS = [[1, "Lun"], [2, "Mar"], [3, "Mié"], [4, "Jue"], [5, "Vie"], [6, "Sáb"], [7, "Dom"]] as const;
const PASOS = [
  { titulo: "Semana", sub: "Cuándo se publica" },
  { titulo: "Cobertura", sub: "Cuántas notas y quién aprueba" },
  { titulo: "Temas", sub: "Qué se quiere cubrir" },
  { titulo: "Pauta", sub: "Calendario con horas" },
  { titulo: "Poner en marcha", sub: "Revisar y activar" },
] as const;
const COLOR: Record<EstadoCasilla, string> = {
  planificada: "border-[var(--border-strong)]", redactando: "border-amber-500", revision: "border-[var(--accent)] bg-[var(--accent)]/10",
  programada: "border-emerald-600 bg-emerald-600/10", publicada: "border-emerald-700 bg-emerald-700/20", fallida: "border-red-600 bg-red-600/10", omitida: "opacity-40 border-[var(--border)]",
};
const campo = "w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-white px-3 py-2 text-sm text-[#0b0b0b] placeholder:text-[var(--fg-muted)]";
const boton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition disabled:opacity-50";
const primario = `${boton} bg-[var(--accent)] text-[var(--accent-fg,#fff)] hover:opacity-90`;
const secundario = `${boton} border border-[var(--border-strong)] hover:border-[var(--accent)] hover:text-[var(--accent)]`;

// Día «AAAA-MM-DD» y hora «HH:MM» de un instante, en hora de Colombia.
const diaDe = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date(iso));
const horaDe = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
const nombreDia = (fecha: string) => new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", timeZone: "America/Bogota" }).format(new Date(`${fecha}T12:00:00-05:00`));

// Una pantalla del paso a paso: título, ayuda y contenido.
function Paso({ n, titulo, ayuda, children }: { n: number; titulo: string; ayuda: string; children: React.ReactNode }) {
  return (
    <section className="lx-card flex flex-col gap-5 p-5 sm:p-7">
      <div>
        <p className="lx-kicker text-[var(--accent)]">Paso {n} de {PASOS.length}</p>
        <h2 className="lx-display mt-1 text-2xl font-semibold tracking-tight">{titulo}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--fg-muted)]">{ayuda}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * Consejo de redacción como paso a paso: 1 Semana, 2 Cobertura, 3 Temas, 4 Pauta (calendario con horas) y 5 Poner en marcha. Cada paso
 * es una pantalla; la barra de abajo guarda y avanza. La IA propone temas y arma la pauta; nada sale sin autorización de un editor.
 */
export function ConsejoEditor({ plan, casillas, secciones, puedePublicar, pasoInicial = 0 }: { plan: { id: string; title: string; weekStart: string; status: EstadoPlan; config: ConfigConsejo; temas: TemaConsejo[] }; casillas: CasillaVista[]; secciones: Seccion[]; puedePublicar: boolean; pasoInicial?: number }) {
  const router = useRouter();
  const [pend, run] = useTransition();
  const [paso, setPasoEstado] = useState(Math.min(PASOS.length - 1, Math.max(0, pasoInicial)));
  const [cfg, setCfg] = useState<ConfigConsejo>(plan.config);
  const [titulo, setTitulo] = useState(plan.title);
  const [temas, setTemas] = useState<TemaConsejo[]>(plan.temas);
  // Un campo de «nuevo tema» por sección, y las sugerencias de la IA por sección (todavía no están en el plan: se añaden con su botón).
  const [nuevos, setNuevos] = useState<Record<string, string>>({});
  const [propuestas, setPropuestas] = useState<Record<string, TemaConsejo[]>>({});
  const [fuentes, setFuentes] = useState<Record<string, { title: string; url: string }[]>>({});
  const [cargando, setCargando] = useState<string | null>(null);
  const [enfoque, setEnfoque] = useState("");
  const [nuevaHora, setNuevaHora] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const nombre = (slug: string) => secciones.find((s) => s.slug === slug)?.name ?? slug;
  const sel = casillas.find((c) => c.id === selId) ?? null;
  const editable = plan.status !== "cerrado";

  // Cambia de paso y lo deja en la dirección (así recargar o volver mantiene el lugar).
  const irA = (n: number) => {
    const p = Math.min(PASOS.length - 1, Math.max(0, n));
    setPasoEstado(p);
    setMsg(null);
    window.history.replaceState(null, "", `?paso=${p + 1}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const hacer = (fn: () => Promise<{ ok: boolean; message?: string }>, despues?: () => void) =>
    run(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, texto: r.message ?? (r.ok ? "Listo." : "No se pudo.") });
      if (r.ok) { despues?.(); router.refresh(); }
    });
  const guardar = () => guardarPlan(plan.id, { titulo, config: sanearConfig(cfg), temas });
  const nSemana = useMemo(() => notasPorSemana(cfg), [cfg]);

  const fechas = [...new Set([...cfg.dias.map((d) => sumarDias(plan.weekStart, d - 1)), ...casillas.map((c) => diaDe(c.publishAt))])].sort();
  const horas = [...new Set([...cfg.horas, ...casillas.map((c) => horaDe(c.publishAt))])].sort();
  const activas = casillas.filter((c) => c.status !== "omitida");
  const porRevisar = casillas.filter((c) => c.status === "revision");
  const cuota = (slug: string) => cfg.cuotas.find((q) => q.seccion === slug);
  const ponerCuota = (slug: string, porDia: number, aprobacion?: Aprobacion) =>
    setCfg((c) => ({ ...c, cuotas: [...c.cuotas.filter((q) => q.seccion !== slug), ...(porDia > 0 ? [{ seccion: slug, porDia, ...(aprobacion ? { aprobacion } : {}) }] : [])] }));
  // Secciones elegidas en el paso 2, con cuántos temas hacen falta (notas por día × días de la semana) y cuántos hay.
  const porSeccion = cfg.cuotas.map((q) => {
    const propios = temas.filter((t) => t.seccion === q.seccion);
    return { slug: q.seccion, name: nombre(q.seccion), porDia: q.porDia, necesita: q.porDia * cfg.dias.length, propios };
  });
  const otrosTemas = temas.filter((t) => !t.seccion || !cfg.cuotas.some((q) => q.seccion === t.seccion));
  const agregarTema = (slug: string) => {
    const texto = (nuevos[slug] ?? "").trim();
    if (texto.length < 4) return;
    setTemas((t) => [...t, { id: crypto.randomUUID(), texto, seccion: slug, prioridad: 2, origen: "manual" }]);
    setNuevos((n) => ({ ...n, [slug]: "" }));
  };
  // Pide a la IA los temas que faltan de una sección (guarda antes la configuración).
  const traerTemas = async (slug: string, faltan: number): Promise<{ ok: boolean; message?: string }> => {
    setCargando(slug);
    try {
      await guardar();
      const r = await proponerTemas(plan.id, { seccion: slug, cantidad: Math.max(1, faltan), enfoque });
      if (r.ok) { setPropuestas((p) => ({ ...p, [slug]: r.temas })); setFuentes((f) => ({ ...f, [slug]: r.fuentes })); }
      return r;
    } finally { setCargando(null); }
  };

  // ¿Qué pasos ya están listos? (el ✓ de la barra)
  const listo = [cfg.dias.length > 0 && cfg.horas.length > 0, cfg.cuotas.length > 0, temas.length > 0, activas.length > 0, plan.status === "activo"];
  // Lo que hace «Siguiente» en cada paso: guarda y avanza; en Temas arma la pauta si aún no hay.
  const siguiente = () => {
    if (paso === 0 || paso === 1) return hacer(guardar, () => irA(paso + 1));
    if (paso === 2) {
      if (activas.length > 0) return hacer(guardar, () => irA(3));
      return hacer(async () => { await guardar(); return armarPauta(plan.id, enfoque); }, () => irA(3));
    }
    return irA(paso + 1);
  };
  const textoSiguiente = paso === 2 && activas.length === 0 ? "Armar la pauta con IA" : paso === 0 ? "Siguiente · Cobertura" : paso === 1 ? "Siguiente · Temas" : paso === 2 ? "Siguiente · Pauta" : "Siguiente · Poner en marcha";
  const bloqueoSiguiente = paso === 1 && cfg.cuotas.length === 0 ? "Elige al menos una sección con notas por día" : "";

  return (
    <div className="flex flex-col gap-5 pb-28">
      {/* Cabecera y barra de pasos fijas: no se mueven al desplazar, solo el contenido del paso. */}
      <div className="sticky top-[3.9rem] z-30 -mx-4 flex flex-col gap-3 border-b border-[var(--border)] bg-[var(--bg)]/95 px-4 pb-3 pt-3 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0">
      <div>
        <Link href="/panel/consejo" className="mb-1 inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--accent)]"><ArrowLeft size={15} /> Consejos de redacción</Link>
        <div className="flex flex-wrap items-center gap-3">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={!editable} aria-label="Nombre del consejo" className="lx-display min-w-0 flex-1 bg-transparent text-xl font-semibold tracking-tight outline-none focus:underline sm:text-2xl" />
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${plan.status === "activo" ? "border-emerald-600 text-emerald-600" : "border-[var(--border-strong)] text-[var(--fg-muted)]"}`}>{plan.status === "activo" ? "Activo" : plan.status === "cerrado" ? "Cerrado" : "Borrador"}</span>
        </div>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">Semana del {nombreDia(plan.weekStart)} al {nombreDia(sumarDias(plan.weekStart, 6))}.</p>
      </div>

      {/* Barra de pasos */}
      <nav aria-label="Pasos del consejo" className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-2">
        <ol className="flex min-w-max items-center gap-1 sm:min-w-0 sm:justify-between">
          {PASOS.map((p, i) => (
            <li key={p.titulo} className="flex items-center gap-1 sm:flex-1">
              <button type="button" onClick={() => irA(i)} aria-current={paso === i ? "step" : undefined} className={`flex min-h-11 items-center gap-2 rounded-full pl-1 pr-3 text-left transition ${paso === i ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]/60"}`}>
                <span className={`grid size-8 shrink-0 place-items-center rounded-full border text-sm font-semibold ${paso === i ? "border-transparent bg-[var(--accent)] text-[var(--accent-fg,#fff)]" : listo[i] ? "border-emerald-600 bg-emerald-600/10 text-emerald-600" : "border-[var(--border-strong)] text-[var(--fg-muted)]"}`}>{listo[i] && paso !== i ? <Check size={15} /> : i + 1}</span>
                <span className="leading-tight"><span className="block text-sm font-semibold">{p.titulo}</span><span className="hidden text-[0.7rem] text-[var(--fg-muted)] lg:block">{p.sub}</span></span>
              </button>
              {i < PASOS.length - 1 && <span aria-hidden className="mx-1 hidden h-px flex-1 bg-[var(--border)] sm:block" />}
            </li>
          ))}
        </ol>
      </nav>
      </div>

      {msg && <p role="status" className={`rounded-[var(--radius)] border px-4 py-2.5 text-sm ${msg.ok ? "border-emerald-600/50 bg-emerald-600/10" : "border-red-600/50 bg-red-600/10"}`}>{msg.texto}</p>}

      {paso === 0 && (
        <Paso n={1} titulo="¿Cuándo se publica?" ayuda="Elige los días de la semana y las horas en que pueden salir las notas. La IA luego reparte las piezas entre esas horas.">
          <div>
            <p className="lx-kicker mb-2 text-[var(--fg-muted)]">Días que se publican</p>
            <div className="flex flex-wrap gap-2">
              {DIAS.map(([n, l]) => (
                <button key={n} type="button" disabled={!editable} aria-pressed={cfg.dias.includes(n)} onClick={() => setCfg((c) => ({ ...c, dias: c.dias.includes(n) ? c.dias.filter((d) => d !== n) : [...c.dias, n].sort() }))} className={`min-h-11 min-w-14 rounded-full border px-4 text-sm font-medium ${cfg.dias.includes(n) ? "border-transparent bg-[var(--accent)] text-[var(--accent-fg,#fff)]" : "border-[var(--border-strong)] text-[var(--fg-muted)]"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="lx-kicker mb-2 text-[var(--fg-muted)]">Horas de publicación (hora de Colombia)</p>
            <div className="flex flex-wrap items-center gap-2">
              {cfg.horas.map((h) => (
                <span key={h} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-[var(--border-strong)] pl-3 pr-1 text-sm tabular-nums">
                  <Clock size={14} aria-hidden /> {h}
                  <button type="button" aria-label={`Quitar ${h}`} disabled={!editable || cfg.horas.length <= 1} onClick={() => setCfg((c) => ({ ...c, horas: c.horas.filter((x) => x !== h) }))} className="grid size-8 place-items-center rounded-full hover:bg-[var(--surface-2)]"><X size={14} /></button>
                </span>
              ))}
              <input type="time" value={nuevaHora} onChange={(e) => setNuevaHora(e.target.value)} disabled={!editable} aria-label="Nueva hora" className="min-h-10 rounded-full border border-[var(--border-strong)] bg-white px-3 text-sm text-[#0b0b0b]" />
              <button type="button" disabled={!editable || !nuevaHora} onClick={() => { setCfg((c) => ({ ...c, horas: [...new Set([...c.horas, nuevaHora])].sort() })); setNuevaHora(""); }} className={secundario}><Plus size={14} /> Añadir hora</button>
            </div>
          </div>
          <label className="flex max-w-md flex-col gap-1 text-sm"><span className="lx-kicker text-[var(--fg-muted)]">La IA redacta cada nota con esta antelación (horas)</span>
            <input type="number" min={1} max={48} value={cfg.antelacionHoras} disabled={!editable} onChange={(e) => setCfg((c) => ({ ...c, antelacionHoras: Number(e.target.value) }))} className={campo} />
            <span className="text-xs text-[var(--fg-muted)]">Así un editor alcanza a revisarla antes de que salga.</span></label>
        </Paso>
      )}

      {paso === 1 && (
        <Paso n={2} titulo="Cobertura de la semana" ayuda="Cuántas notas por día quieres en cada sección y si salen con aprobación previa de un editor o automáticamente.">
          <label className="flex max-w-md flex-col gap-1 text-sm"><span className="lx-kicker text-[var(--fg-muted)]">Cómo salen las notas por defecto</span>
            <select value={cfg.aprobacion} disabled={!editable} onChange={(e) => setCfg((c) => ({ ...c, aprobacion: e.target.value as Aprobacion }))} className={campo}>
              <option value="manual">Con aprobación previa de un editor</option>
              <option value="auto" disabled={!puedePublicar}>Publicar automáticamente{puedePublicar ? "" : " (requiere poder publicar)"}</option>
            </select></label>
          <div className="grid gap-2 sm:grid-cols-2">
            {secciones.map((s) => {
              const q = cuota(s.slug);
              return (
                <div key={s.slug} className={`flex flex-wrap items-center gap-2 rounded-[var(--radius)] border px-3 py-2.5 ${q ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border)]"}`}>
                  <span className={`min-w-0 flex-1 text-sm ${q ? "font-semibold" : "text-[var(--fg-muted)]"}`}>{s.name}</span>
                  <div className="flex items-center gap-1" role="group" aria-label={`Notas por día en ${s.name}`}>
                    <button type="button" disabled={!editable || !q} onClick={() => ponerCuota(s.slug, (q?.porDia ?? 0) - 1, q?.aprobacion)} className="grid size-10 place-items-center rounded-full border border-[var(--border-strong)] text-lg" aria-label="Menos">−</button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums">{q?.porDia ?? 0}</span>
                    <button type="button" disabled={!editable || (q?.porDia ?? 0) >= 6} onClick={() => ponerCuota(s.slug, (q?.porDia ?? 0) + 1, q?.aprobacion)} className="grid size-10 place-items-center rounded-full border border-[var(--border-strong)] text-lg" aria-label="Más">+</button>
                  </div>
                  {q && (
                    <select value={q.aprobacion ?? cfg.aprobacion} disabled={!editable} onChange={(e) => ponerCuota(s.slug, q.porDia, e.target.value as Aprobacion)} aria-label={`Aprobación en ${s.name}`} className="w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-white px-2 py-2 text-xs text-[#0b0b0b]">
                      <option value="manual">✋ Con aprobación</option>
                      <option value="auto" disabled={!puedePublicar}>⚡ Automática</option>
                    </select>
                  )}
                </div>
              );
            })}
          </div>
          <p className="rounded-[var(--radius)] bg-[var(--surface-2)] px-4 py-3 text-sm">Son <strong>{nSemana}</strong> notas en la semana ({cfg.dias.length} días × {cfg.cuotas.reduce((s, q) => s + q.porDia, 0)} notas por día).</p>
        </Paso>
      )}

      {paso === 2 && (
        <Paso n={3} titulo="Temas por sección" ayuda="Para cada sección que elegiste, escribe los temas que quieres cubrir o pídele a la IA que los traiga (con fuentes). Cada sección necesita tantos temas como notas tendrá en la semana. Es opcional: lo que falte, la IA lo completa al armar la pauta.">
          {porSeccion.length === 0 && <p className="rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] p-6 text-center text-sm text-[var(--fg-muted)]">Primero elige las secciones en el paso 2 (Cobertura).</p>}
          {porSeccion.length > 0 && (
            <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] p-4 sm:flex-row sm:items-center">
              <input value={enfoque} disabled={!editable} onChange={(e) => setEnfoque(e.target.value)} placeholder="Enfoque opcional para la IA (p. ej. «más sanidad animal y exportaciones»)" className={`${campo} min-w-0 flex-1`} />
              <button type="button" disabled={pend || !!cargando || !editable} onClick={() => run(async () => {
                for (const sec of porSeccion) {
                  const faltan = sec.necesita - sec.propios.length - (propuestas[sec.slug]?.length ?? 0);
                  if (faltan <= 0) continue;
                  const r = await traerTemas(sec.slug, faltan);
                  setMsg({ ok: r.ok, texto: r.message ?? "Listo." });
                  if (!r.ok) break;
                }
              })} className={primario}>{cargando ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Traer los temas de todas</button>
            </div>
          )}
          {porSeccion.map((sec) => {
            const sugeridas = propuestas[sec.slug] ?? [];
            const faltan = Math.max(0, sec.necesita - sec.propios.length);
            const completo = faltan === 0;
            return (
              <div key={sec.slug} className={`flex flex-col gap-3 rounded-[var(--radius-lg)] border p-4 ${completo ? "border-emerald-600/60" : "border-[var(--border)]"}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="lx-display text-lg font-semibold">{sec.name}</h3>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${completo ? "bg-emerald-600/15 text-emerald-700" : "bg-[var(--surface-2)] text-[var(--fg-muted)]"}`}>{completo ? <><Check size={12} className="mr-1 inline" />Completa</> : `Faltan ${faltan}`} · {sec.propios.length} de {sec.necesita} temas</span>
                  <span className="text-xs text-[var(--fg-muted)]">{sec.porDia} por día × {cfg.dias.length} días</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]" aria-hidden><div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${Math.min(100, (sec.propios.length / Math.max(1, sec.necesita)) * 100)}%` }} /></div>
                <div className="flex flex-wrap gap-2">
                  <input value={nuevos[sec.slug] ?? ""} disabled={!editable} onChange={(e) => setNuevos((n) => ({ ...n, [sec.slug]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && agregarTema(sec.slug)} placeholder={`Un tema de ${sec.name}, p. ej. «Vacunación contra la aftosa en el Caribe»`} className={`${campo} min-w-0 flex-1`} />
                  <button type="button" disabled={!editable || (nuevos[sec.slug] ?? "").trim().length < 4} onClick={() => agregarTema(sec.slug)} className={secundario}><Plus size={15} /> Añadir</button>
                  <button type="button" disabled={pend || !!cargando || !editable} onClick={() => run(async () => { const r = await traerTemas(sec.slug, completo ? 3 : faltan); setMsg({ ok: r.ok, texto: r.message ?? "Listo." }); })} className={primario}>{cargando === sec.slug ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {completo ? "Traer 3 más" : `Traer ${faltan} con IA`}</button>
                </div>
                {sugeridas.length > 0 && (
                  <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--accent)] bg-[var(--accent)]/5 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-sm font-semibold"><Bot size={15} className="text-[var(--accent)]" /> La IA propone para {sec.name} ({sugeridas.length})</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setTemas((t) => [...t, ...sugeridas].slice(0, 60)); setPropuestas((p) => ({ ...p, [sec.slug]: [] })); }} className={primario}><Plus size={15} /> Añadir todos</button>
                        <button type="button" onClick={() => setPropuestas((p) => ({ ...p, [sec.slug]: [] }))} className={secundario}>Descartar</button>
                      </div>
                    </div>
                    <ul className="flex flex-col divide-y divide-[var(--border)]">
                      {sugeridas.map((t) => (
                        <li key={t.id} className="flex flex-wrap items-center gap-3 py-2">
                          <div className="min-w-0 flex-1 basis-64"><p className="text-sm font-semibold">{t.texto}</p>{t.angulo && <p className="text-xs text-[var(--fg-muted)]">{t.angulo}</p>}</div>
                          <button type="button" onClick={() => { setTemas((l) => [...l, t].slice(0, 60)); setPropuestas((p) => ({ ...p, [sec.slug]: (p[sec.slug] ?? []).filter((x) => x.id !== t.id) })); }} className={primario}><Plus size={15} /> Añadir tema</button>
                          <button type="button" aria-label="Descartar esta propuesta" onClick={() => setPropuestas((p) => ({ ...p, [sec.slug]: (p[sec.slug] ?? []).filter((x) => x.id !== t.id) }))} className="grid size-10 place-items-center rounded-full hover:bg-[var(--surface-2)]"><X size={15} /></button>
                        </li>
                      ))}
                    </ul>
                    {(fuentes[sec.slug]?.length ?? 0) > 0 && (
                      <details className="text-xs text-[var(--fg-muted)]"><summary className="cursor-pointer font-medium">Fuentes consultadas ({fuentes[sec.slug].length})</summary>
                        <ul className="mt-1 list-disc pl-5">{fuentes[sec.slug].map((f) => <li key={f.url}><a href={f.url} target="_blank" rel="noopener noreferrer" className="underline">{f.title}</a></li>)}</ul></details>
                    )}
                  </div>
                )}
                {sec.propios.length > 0 && (
                  <ul className="flex flex-col divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)]">
                    {sec.propios.map((t) => (
                      <li key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                        {t.origen === "ia" && <Bot size={15} aria-label="Propuesto por la IA" className="shrink-0 text-[var(--accent)]" />}
                        <div className="min-w-0 flex-1 basis-56"><p className="text-sm font-medium">{t.texto}</p>{t.angulo && <p className="text-xs text-[var(--fg-muted)]">{t.angulo}</p>}</div>
                        <select value={t.prioridad} disabled={!editable} onChange={(e) => setTemas((l) => l.map((x) => (x.id === t.id ? { ...x, prioridad: Number(e.target.value) as 1 | 2 | 3 } : x)))} aria-label="Prioridad" className="rounded-[var(--radius)] border border-[var(--border-strong)] bg-white px-2 py-2 text-xs text-[#0b0b0b]">
                          <option value={1}>Prioritario</option><option value={2}>Normal</option><option value={3}>De apoyo</option>
                        </select>
                        <button type="button" aria-label="Quitar tema" disabled={!editable} onClick={() => setTemas((l) => l.filter((x) => x.id !== t.id))} className="grid size-10 place-items-center rounded-full hover:bg-[var(--surface-2)]"><Trash2 size={15} /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          {otrosTemas.length > 0 && (
            <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] p-4">
              <h3 className="lx-display text-lg font-semibold">Otros temas ({otrosTemas.length})</h3>
              <p className="text-xs text-[var(--fg-muted)]">Sin sección elegida o de una sección que ya no está en la cobertura: la IA los reparte donde mejor encajen.</p>
              <ul className="flex flex-col divide-y divide-[var(--border)]">
                {otrosTemas.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-2 py-2">
                    <p className="min-w-0 flex-1 basis-56 text-sm font-medium">{t.texto}</p>
                    <button type="button" aria-label="Quitar tema" disabled={!editable} onClick={() => setTemas((l) => l.filter((x) => x.id !== t.id))} className="grid size-10 place-items-center rounded-full hover:bg-[var(--surface-2)]"><Trash2 size={15} /></button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Paso>
      )}

      {paso === 3 && (
        <Paso n={4} titulo="Pauta de la semana" ayuda="Así reparte la IA las notas por día, hora y sección. Toca una pieza para cambiar el tema, la hora o cómo sale.">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={pend || !editable} onClick={() => hacer(async () => { await guardar(); return armarPauta(plan.id, enfoque); })} className={secundario}>{pend ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {activas.length ? "Rearmar la pauta con IA" : "Armar la pauta con IA"}</button>
            {activas.length > 0 && <p className="text-xs text-[var(--fg-muted)]">{activas.length} piezas · {activas.filter((c) => c.approval === "auto").length} automáticas · ✋ con aprobación · ⚡ automática</p>}
          </div>
          {activas.length === 0 ? (
            <p className="rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] p-8 text-center text-sm text-[var(--fg-muted)]">Todavía no hay pauta. Pulsa «Armar la pauta con IA».</p>
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
            </>
          )}
          {sel && <PanelCasilla key={sel.id} c={sel} secciones={secciones} puedePublicar={puedePublicar} onClose={() => setSelId(null)} onGuardar={(d) => hacer(() => guardarCasilla(sel.id, d))} onQuitar={() => hacer(() => quitarCasilla(sel.id), () => setSelId(null))} onAprobar={() => hacer(() => aprobar(sel.id))} pend={pend} />}
        </Paso>
      )}

      {paso === 4 && (
        <Paso n={5} titulo="Poner en marcha" ayuda="Revisa el resumen y activa el plan. Desde ese momento la IA redacta cada pieza a su tiempo.">
          <ul className="grid gap-3 sm:grid-cols-3">
            {[["Piezas en la semana", activas.length], ["Con aprobación previa", activas.filter((c) => c.approval === "manual").length], ["Automáticas", activas.filter((c) => c.approval === "auto").length]].map(([t, n]) => (
              <li key={t as string} className="rounded-[var(--radius)] border border-[var(--border)] p-4"><p className="lx-kicker text-[var(--fg-muted)]">{t}</p><p className="lx-display text-3xl font-semibold tabular-nums">{n}</p></li>
            ))}
          </ul>
          {(() => {
            const pend = activas.filter((c) => c.status === "planificada" || c.status === "fallida");
            const listas = pend.filter((c) => evaluarFicha(c.ficha).lista).length;
            return pend.length ? (
              <p className={`rounded-[var(--radius)] border px-4 py-3 text-sm ${listas === pend.length ? "border-emerald-600/50 bg-emerald-600/10" : "border-amber-500/50 bg-amber-500/10"}`}>
                <strong>Fichas de pauta: {listas} de {pend.length} listas.</strong> {listas === pend.length ? "Todas las piezas tienen su foco, fuentes y preguntas." : "Las que falten las completa el editor jefe con investigación al llegar la hora; si aun así faltan datos obligatorios, la pieza se detiene y te avisa. Puedes completarlas ya desde el calendario (paso 4)."}
              </p>
            ) : null;
          })()}
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={cfg.divulgarIA !== false} disabled={!editable} onChange={(e) => setCfg((c) => ({ ...c, divulgarIA: e.target.checked }))} /><span><strong>Avisar al lector.</strong> Cada nota termina con «Nota elaborada con asistencia de inteligencia artificial a partir de las fuentes citadas». Es la práctica de medios como AP o The Guardian y la recomendamos.</span></label>
          <p className="text-sm leading-relaxed text-[var(--fg-muted)]">La IA redacta cada pieza <strong>{cfg.antelacionHoras} h antes de su hora</strong>, con la tubería verificada del asistente (sin inventar cifras ni citas) y con tu estilo de escritura. Las «con aprobación» quedan en revisión hasta que un editor las apruebe; las «automáticas» solo se programan si la nota pasa el control de calidad (300 palabras, con fuentes y sin marcadores); si no lo pasa, esperan tu aprobación.</p>
          {porRevisar.length > 0 && (
            <div>
              <h3 className="lx-display mb-2 text-lg font-semibold">Esperando tu aprobación ({porRevisar.length})</h3>
              <ul className="flex flex-col divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)]">
                {porRevisar.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1 basis-56"><p className="text-sm font-semibold">{c.topic}</p><p className="text-xs text-[var(--fg-muted)]">{nombre(c.sectionSlug)} · sale {nombreDia(diaDe(c.publishAt))} {horaDe(c.publishAt)}{c.error ? ` · ${c.error}` : ""}</p></div>
                    {c.articleId && <Link href={`/panel/articulos/${c.articleId}?modo=ia&paso=vista`} className={secundario}>Revisar la nota <ChevronRight size={14} /></Link>}
                    <button type="button" disabled={pend || !puedePublicar} title={puedePublicar ? "" : "Tu cuenta no puede publicar"} onClick={() => hacer(() => aprobar(c.id))} className={primario}><Check size={15} /> Aprobar y programar</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {plan.status !== "activo" && editable && <button type="button" disabled={pend || activas.length === 0} onClick={() => hacer(async () => { await guardar(); return activarPlan(plan.id); })} className={primario}>{pend ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />} Activar el plan</button>}
            {plan.status === "activo" && <>
              <button type="button" disabled={pend} onClick={() => hacer(() => redactarAhora(plan.id))} className={primario}>{pend ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Redactar lo que toque ahora</button>
              <button type="button" disabled={pend} onClick={() => hacer(() => cambiarEstadoPlan(plan.id, "borrador"))} className={secundario}>Pausar</button>
            </>}
            {editable && <button type="button" disabled={pend} onClick={() => hacer(() => cambiarEstadoPlan(plan.id, "cerrado"))} className={secundario}>Cerrar el consejo</button>}
            <ConsejoBorrar id={plan.id} titulo={titulo} piezas={activas.length} activo={plan.status === "activo"} volverA="/panel/consejo" etiqueta />
          </div>
          {activas.length === 0 && <p className="text-sm text-amber-600">Antes de activar necesitas una pauta: vuelve al paso 4.</p>}
        </Paso>
      )}

      {/* Barra inferior: atrás y siguiente, siempre a la vista */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--bg)]/95 px-4 py-3 backdrop-blur left-[var(--sb-w,4rem)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <button type="button" onClick={() => irA(paso - 1)} disabled={paso === 0 || pend} className={secundario}><ArrowLeft size={16} /> Atrás</button>
          <p className="hidden text-center text-xs text-[var(--fg-muted)] sm:block">Paso {paso + 1} de {PASOS.length} · {PASOS[paso].titulo}{bloqueoSiguiente ? ` · ${bloqueoSiguiente}` : ""}</p>
          {paso < PASOS.length - 1 ? (
            <button type="button" onClick={siguiente} disabled={pend || !!bloqueoSiguiente} className={primario}>{pend ? <Loader2 size={16} className="animate-spin" /> : null}{textoSiguiente} <ArrowRight size={16} /></button>
          ) : <span className="w-24" />}
        </div>
      </div>
    </div>
  );
}

// Una pieza en el calendario.
function Chip({ c, nombre, activa, onClick, hora }: { c: CasillaVista; nombre: string; activa: boolean; onClick: () => void; hora?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activa} className={`flex w-full flex-col gap-0.5 rounded-[var(--radius)] border px-2 py-1.5 text-left transition hover:border-[var(--accent)] ${COLOR[c.status]} ${activa ? "ring-2 ring-[var(--accent)]" : ""}`}>
      <span className="flex items-center justify-between gap-1 text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--fg-muted)]"><span className="truncate">{hora ? `${horaDe(c.publishAt)} · ` : ""}{nombre}</span><span className="shrink-0">{c.approval === "auto" ? "⚡ auto" : "✋"}</span></span>
      <span className="line-clamp-2 text-xs font-medium leading-snug">{c.topic || "Sin tema"}</span>
      <span className="flex items-center justify-between gap-1 text-[0.68rem] text-[var(--fg-muted)]"><span>{ESTADOS_CASILLA[c.status]}{c.priority === 1 ? " · prioritaria" : ""}</span>{(c.status === "planificada" || c.status === "fallida") && <span title={evaluarFicha(c.ficha).lista ? "Ficha de pauta lista" : "Falta la ficha de pauta: " + evaluarFicha(c.ficha).faltanObligatorias.join(", ")} className={evaluarFicha(c.ficha).lista ? "text-emerald-600" : "text-amber-600"}>{evaluarFicha(c.ficha).lista ? "✓ ficha" : "⚠ ficha"}</span>}</span>
    </button>
  );
}

// Las fuentes se editan como líneas: «Nombre — https://enlace» (documento/dato oficial) o solo «Nombre» (voz).
const fuentesATexto = (fs?: FuentePrevista[]) => (fs ?? []).map((f) => (f.url ? `${f.nombre} — ${f.url}` : f.tipo === "documento" ? `doc: ${f.nombre}` : f.nombre)).join("\n");
const textoAFuentes = (t: string): FuentePrevista[] =>
  t.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^(.*?)\s*[—-]\s*(https?:\/\/\S+)$/);
    if (m) return { nombre: m[1] || m[2], tipo: "documento" as const, url: m[2] };
    return /^doc:/i.test(l) ? { nombre: l.replace(/^doc:\s*/i, ""), tipo: "documento" as const } : { nombre: l, tipo: "voz" as const };
  });
const lineas = (t: string) => t.split("\n").map((l) => l.trim()).filter(Boolean);

// Una pregunta de la ficha: etiqueta, campo y ayuda (fuera de PanelCasilla para que el campo no pierda el foco al escribir).
function Pregunta({ clave, children }: { clave: string; children: React.ReactNode }) {
  const q = PREGUNTAS_FICHA.find((p) => p.clave === clave)!;
  return (
    <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">{q.etiqueta}{q.obligatoria && <span className="ml-1 text-amber-600" title="Obligatoria para redactar">*</span>}</span>{children}<span className="text-xs text-[var(--fg-muted)]">{q.ayuda}</span></label>
  );
}

// Edición de una pieza y de su ficha de pauta.
function PanelCasilla({ c, secciones, puedePublicar, onClose, onGuardar, onQuitar, onAprobar, pend }: { c: CasillaVista; secciones: Seccion[]; puedePublicar: boolean; onClose: () => void; onGuardar: (d: { topic: string; angle: string; brief: string; sectionSlug: string; publishAt: string; priority: number; approval: Aprobacion; ficha: FichaPauta }) => void; onQuitar: () => void; onAprobar: () => void; pend: boolean }) {
  const [d, setD] = useState({ topic: c.topic, angle: c.angle, brief: c.brief, sectionSlug: c.sectionSlug, fecha: diaDe(c.publishAt), hora: horaDe(c.publishAt), priority: c.priority, approval: c.approval });
  const [f, setF] = useState<FichaPauta>(c.ficha);
  const [fuentesTxt, setFuentesTxt] = useState(fuentesATexto(c.ficha.fuentes));
  const [msg, setMsg] = useState("");
  const [buscando, empezar] = useTransition();
  const router = useRouter();
  const editable = c.status === "planificada" || c.status === "fallida";
  const fichaActual: FichaPauta = { ...f, fuentes: textoAFuentes(fuentesTxt) };
  const ev = evaluarFicha(fichaActual);
  const campoLista = (clave: "datosAConfirmar" | "preguntas" | "abiertas" | "riesgos" | "evitar") => (
    <textarea rows={3} disabled={!editable} value={(f[clave] ?? []).join("\n")} onChange={(e) => setF({ ...f, [clave]: lineas(e.target.value) })} placeholder="Uno por línea" className={campo} />
  );
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--accent)] bg-[var(--bg-2)] p-4">
      <div className="flex items-center justify-between"><p className="lx-kicker text-[var(--accent)]">Pieza · {ESTADOS_CASILLA[c.status]}</p><button type="button" onClick={onClose} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full hover:bg-[var(--surface-2)]"><X size={16} /></button></div>
      {c.error && <p className="rounded-[var(--radius)] border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs">{c.error}</p>}
      <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Tema (titular tentativo)</span><input value={d.topic} disabled={!editable} onChange={(e) => setD({ ...d, topic: e.target.value })} className={campo} /></label>
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

      {/* Ficha de pauta: las preguntas que se responden antes de encargar la nota */}
      <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="lx-display flex-1 text-lg font-semibold">Ficha de pauta</p>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ev.lista ? "bg-emerald-600/15 text-emerald-700" : "bg-amber-500/15 text-amber-700"}`}>{ev.lista ? `Lista para redactar · ${ev.avance}%` : `Falta: ${ev.faltanObligatorias.length} obligatoria(s) · ${ev.avance}%`}</span>
          {editable && <button type="button" disabled={buscando || pend || d.topic.trim().length < 8} onClick={() => empezar(async () => { const r = await completarFicha(c.id, fichaActual); setMsg(r.message ?? ""); if (r.ok) { setF(r.ficha); setFuentesTxt(fuentesATexto(r.ficha.fuentes)); router.refresh(); } })} className={secundario}>{buscando ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Completar con investigación</button>}
        </div>
        {msg && <p role="status" className="text-xs text-[var(--fg-muted)]">{msg}</p>}
        <p className="text-xs text-[var(--fg-muted)]">Sin las preguntas con * la IA no redacta: no inventa. Si faltan al llegar la hora, el «editor jefe» las completa con investigación; si aun así faltan, la pieza queda detenida y te avisa.</p>
        <Pregunta clave="foco"><input value={f.foco ?? ""} disabled={!editable} onChange={(e) => setF({ ...f, foco: e.target.value })} className={campo} /></Pregunta>
        <Pregunta clave="porQueAhora"><input value={f.porQueAhora ?? ""} disabled={!editable} onChange={(e) => setF({ ...f, porQueAhora: e.target.value })} className={campo} /></Pregunta>
        <Pregunta clave="audiencia"><input value={f.audiencia ?? ""} disabled={!editable} onChange={(e) => setF({ ...f, audiencia: e.target.value })} className={campo} /></Pregunta>
        <Pregunta clave="novedad"><input value={f.novedad ?? ""} disabled={!editable} onChange={(e) => setF({ ...f, novedad: e.target.value })} className={campo} /></Pregunta>
        <Pregunta clave="fuentes"><textarea rows={3} disabled={!editable} value={fuentesTxt} onChange={(e) => setFuentesTxt(e.target.value)} placeholder={"Una por línea: «ICA — https://enlace» (documento), «doc: Boletín DANE» o «Gerente de FEDEGAN» (voz)"} className={campo} /></Pregunta>
        <Pregunta clave="preguntas">{campoLista("preguntas")}</Pregunta>
        <Pregunta clave="datosAConfirmar">{campoLista("datosAConfirmar")}</Pregunta>
        <Pregunta clave="abiertas">{campoLista("abiertas")}</Pregunta>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Género</span><select value={f.genero ?? ""} disabled={!editable} onChange={(e) => setF({ ...f, genero: (e.target.value || undefined) as Genero | undefined })} className={campo}><option value="">Sin definir</option>{(Object.keys(GENEROS) as Genero[]).map((g) => <option key={g} value={g}>{GENEROS[g]}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Palabras (aprox.)</span><input type="number" min={150} max={1500} step={50} disabled={!editable} value={f.palabras ?? ""} onChange={(e) => setF({ ...f, palabras: e.target.value ? Number(e.target.value) : undefined })} placeholder="450" className={campo} /></label>
          <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Vigencia</span><select value={f.vigencia ?? ""} disabled={!editable} onChange={(e) => setF({ ...f, vigencia: (e.target.value || undefined) as Vigencia | undefined })} className={campo}><option value="">Sin definir</option>{(Object.keys(VIGENCIAS) as Vigencia[]).map((v) => <option key={v} value={v}>{VIGENCIAS[v]}</option>)}</select></label>
        </div>
        <Pregunta clave="riesgos">{campoLista("riesgos")}</Pregunta>
        <Pregunta clave="palabraClave"><input value={f.palabraClave ?? ""} disabled={!editable} onChange={(e) => setF({ ...f, palabraClave: e.target.value })} className={campo} /></Pregunta>
        <Pregunta clave="visual"><input value={f.visual ?? ""} disabled={!editable} onChange={(e) => setF({ ...f, visual: e.target.value })} className={campo} /></Pregunta>
        <Pregunta clave="evitar">{campoLista("evitar")}</Pregunta>
        <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Notas adicionales para la IA</span><textarea rows={3} value={d.brief} disabled={!editable} onChange={(e) => setD({ ...d, brief: e.target.value })} className={campo} /></label>
      </div>

      <div className="flex flex-wrap gap-2">
        {editable && <button type="button" disabled={pend} onClick={() => onGuardar({ topic: d.topic, angle: d.angle, brief: d.brief, sectionSlug: d.sectionSlug, publishAt: `${d.fecha}T${d.hora}:00-05:00`, priority: d.priority, approval: d.approval, ficha: fichaActual })} className={primario}><Check size={15} /> Guardar la pieza</button>}
        {editable && <button type="button" disabled={pend} onClick={onQuitar} className={secundario}><Trash2 size={15} /> Quitar</button>}
        {c.status === "revision" && <button type="button" disabled={pend || !puedePublicar} onClick={onAprobar} className={primario}><Check size={15} /> Aprobar y programar</button>}
        {c.articleId && <Link href={`/panel/articulos/${c.articleId}?modo=ia&paso=vista`} className={secundario}>Abrir la nota <ChevronRight size={14} /></Link>}
      </div>
    </div>
  );
}
