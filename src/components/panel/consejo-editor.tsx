"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bot, Check, ChevronRight, Clock, Loader2, PenLine, Plus, Rocket, Sparkles, Trash2, X } from "lucide-react";
import { activarPlan, aprobar, armarPauta, autollenarTema, cambiarEstadoPlan, completarFicha, guardarCasilla, guardarPlan, moverCasilla, quitarCasilla, redactarAhora } from "@/app/panel/(app)/consejo/actions";
import { ConsejoBorrar } from "@/components/panel/consejo-borrar";
import { AreaVoz, InputVoz } from "@/components/panel/campo-voz";
import { type EscritorOpcion } from "@/components/panel/selector-escritor";
import { diasDeCuota, ALCANCES, AUDIENCIAS, sanearBrief, ESTADOS_CASILLA, GENEROS, PALABRAS_OPCIONES, PREGUNTAS_SECCION, TONOS, respondidas, PREGUNTAS_FICHA, VIGENCIAS, evaluarFicha, sanearConfig, sumarDias, type Aprobacion, type ConfigConsejo, type EstadoCasilla, type BriefSeccion, type EstadoPlan, type FichaPauta, type FuentePrevista, type Genero, type TemaConsejo, type Vigencia } from "@/lib/consejo/plan";

export type CasillaVista = { id: string; publishAt: string; sectionSlug: string; topic: string; angle: string; brief: string; priority: number; approval: Aprobacion; status: EstadoCasilla; articleId: string | null; error: string | null; ficha: FichaPauta };
type Seccion = { slug: string; name: string };

const DIAS_LARGO = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DIAS = [[1, "Lun"], [2, "Mar"], [3, "Mié"], [4, "Jue"], [5, "Vie"], [6, "Sáb"], [7, "Dom"]] as const;
const PASOS = [
  { titulo: "Semana", sub: "Cuándo se publica" },
  { titulo: "Temas", sub: "Cobertura, temas y responsable" },
  { titulo: "Pauta", sub: "Calendario con horas" },
  { titulo: "Fichas", sub: "Qué se sabe antes de redactar" },
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
 * Consejo de redacción como paso a paso: 1 Semana, 2 Temas (cobertura, temas y quién escribe), 3 Pauta (calendario con horas), 4 Fichas y 5 Poner en marcha. Cada paso
 * es una pantalla; la barra de abajo guarda y avanza. La IA propone temas y arma la pauta; nada sale sin autorización de un editor.
 */
export function ConsejoEditor({ plan, casillas: casillasProp, secciones, puedePublicar, escritores, yoId, pasoInicial = 0 }: { plan: { id: string; title: string; weekStart: string; status: EstadoPlan; config: ConfigConsejo; temas: TemaConsejo[] }; casillas: CasillaVista[]; secciones: Seccion[]; puedePublicar: boolean; escritores: EscritorOpcion[]; yoId: string; pasoInicial?: number }) {
  const router = useRouter();
  const [pend, run] = useTransition();
  // Arrastrar y soltar en el calendario: `movidas` aplica el cambio al instante (antes de que el servidor responda); `sobre` resalta la celda de destino.
  const [movidas, setMovidas] = useState<Record<string, string>>({});
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const casillas = useMemo(() => casillasProp.map((c) => (movidas[c.id] ? { ...c, publishAt: movidas[c.id] } : c)), [casillasProp, movidas]);
  const [paso, setPasoEstado] = useState(Math.min(PASOS.length - 1, Math.max(0, pasoInicial)));
  const [cfg, setCfg] = useState<ConfigConsejo>(plan.config);
  const [titulo, setTitulo] = useState(plan.title);
  const [temas, setTemas] = useState<TemaConsejo[]>(plan.temas);
  // Un campo de «nuevo tema» por sección, y las sugerencias de la IA por sección (todavía no están en el plan: se añaden con su botón).
  const [llenando, setLlenando] = useState<string | null>(null);
  const [avisoLlenar, setAvisoLlenar] = useState<{ slug: string; ok: boolean; texto: string } | null>(null);
  const [cargando, setCargando] = useState<string | null>(null);
  // Panel de preguntas de cada sección: abierto mientras no se haya respondido nada.
  const [temaAbierto, setTemaAbierto] = useState<Record<string, boolean>>({});
  const [seccionNueva, setSeccionNueva] = useState("");
  const [diaNuevo, setDiaNuevo] = useState<number | undefined>(undefined);
  const [borrador, setBorrador] = useState<Record<string, BriefSeccion>>({});
  const [preguntasAbiertas, setPreguntasAbiertas] = useState<Record<string, boolean>>({ nuevo: true });
  const [nuevaHora, setNuevaHora] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const nombre = (slug: string) => secciones.find((s) => s.slug === slug)?.name ?? slug;
  // Quién escribe cada pieza: el elegido en su ficha o, si no, el del consejo. `nombreEscritor` solo devuelve algo si la pieza tiene uno propio.
  const escritorDe = (c: CasillaVista) => c.ficha.escritorId ?? cfg.escritorId ?? "";
  const nombreEscritor = (id: string) => (escritores.find((e) => e.id === id)?.nombre ?? "").split(" ").slice(0, 2).join(" ");
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

  const fechas = [...new Set([...cfg.dias.map((d) => sumarDias(plan.weekStart, d - 1)), ...casillas.map((c) => diaDe(c.publishAt))])].sort();
  const horas = [...new Set([...cfg.horas, ...casillas.map((c) => horaDe(c.publishAt))])].sort();
  const activas = casillas.filter((c) => c.status !== "omitida");
  const porRevisar = casillas.filter((c) => c.status === "revision");
  const cuota = (slug: string) => cfg.cuotas.find((q) => q.seccion === slug);
  const ponerCuota = (slug: string, porDia: number, aprobacion?: Aprobacion, dias?: number[]) =>
    setCfg((c) => ({ ...c, cuotas: [...c.cuotas.filter((q) => q.seccion !== slug), ...(porDia > 0 ? [{ seccion: slug, porDia, ...(aprobacion ? { aprobacion } : {}), ...(dias?.length ? { dias } : {}) }] : [])] }));
  // Secciones elegidas en la cobertura del paso 2, con cuántos temas hacen falta (notas por día × días de la semana) y cuántos hay.
  const porSeccion = cfg.cuotas.map((q) => {
    const propios = temas.filter((t) => t.seccion === q.seccion);
    return { slug: q.seccion, name: nombre(q.seccion), porDia: q.porDia, necesita: q.porDia * diasDeCuota(q, cfg).length, dias: diasDeCuota(q, cfg).length, diasLista: diasDeCuota(q, cfg), propios };
  });
  const otrosTemas = temas.filter((t) => !t.seccion || !cfg.cuotas.some((q) => q.seccion === t.seccion));
  // Guarda el tema del formulario (con sus respuestas, su sección y su cobertura) y lo deja limpio para proponer otro. Si la sección aún no tenía cobertura, queda con 1 nota por día.
  const guardarTemaDelFormulario = () => {
    const slug = seccionNueva;
    const b = sanearBrief(borrador.nuevo);
    const texto = (b.temas ?? "").trim().slice(0, 200);
    if (!slug) return setMsg({ ok: false, texto: "Elige la sección en la que sale el tema." });
    if (texto.length < 4) return;
    const resto: BriefSeccion = { ...b };
    delete resto.temas;
    // Se pueden crear tantos temas como se quiera: si ya no caben a razón de las notas por día de la sección, esta sube para que cada tema sea una nota.
    const q = cuota(slug);
    const dias = q ? diasDeCuota(q, cfg) : cfg.dias;
    const propios = temas.filter((t) => t.seccion === slug);
    const necesarias = Math.ceil((propios.length + 1) / Math.max(1, dias.length));
    if (!q) ponerCuota(slug, Math.max(1, necesarias));
    else if (q.porDia < necesarias) ponerCuota(slug, necesarias, q.aprobacion, q.dias);
    const cuenta = (d: number) => propios.filter((t) => t.dia === d).length;
    const dia = diaNuevo ?? [...dias].sort((x, y) => cuenta(x) - cuenta(y))[0];
    setTemas((l) => [...l, { id: crypto.randomUUID(), texto, seccion: slug, prioridad: 2 as const, origen: "manual" as const, ...(dia ? { dia } : {}), ...(respondidas(resto) ? { brief: resto } : {}) }].slice(0, 60));
    setBorrador((d) => ({ ...d, nuevo: {} }));
    setDiaNuevo(undefined);
    setMsg({ ok: true, texto: "Tema guardado." });
  };
  const ponerBriefTema = (id: string, c: Partial<BriefSeccion>) => setTemas((l) => l.map((x) => (x.id === id ? { ...x, brief: { ...x.brief, ...c } } : x)));
  // Suelta una pieza en la celda de un día y una hora: se mueve al instante y se guarda; si el servidor la rechaza, vuelve a su sitio.
  const soltar = (slotId: string, fecha: string, hora: string) => {
    setSobre(null);
    setArrastrando(null);
    const nueva = new Date(`${fecha}T${hora}:00-05:00`).toISOString();
    const antes = casillas.find((c) => c.id === slotId);
    if (!antes || antes.publishAt === nueva) return;
    setMovidas((m) => ({ ...m, [slotId]: nueva }));
    run(async () => {
      const r = await moverCasilla(slotId, nueva);
      setMsg({ ok: r.ok, texto: r.message ?? (r.ok ? "Pieza movida." : "No se pudo mover.") });
      if (r.ok) router.refresh();
      else setMovidas((m) => { const x = { ...m }; delete x[slotId]; return x; });
    });
  };
  // La IA contesta las demás preguntas del tema que se está describiendo (guarda el resultado en el borrador de esa sección).
  const autollenar = async (slug: string, clave: string) => {
    setLlenando(clave);
    setAvisoLlenar(null);
    try {
      const r = await autollenarTema(plan.id, slug, borrador[clave]?.temas ?? "");
      if (r.ok) setBorrador((d) => ({ ...d, [clave]: { ...r.brief, temas: d[clave]?.temas, escritorId: d[clave]?.escritorId } }));
      setAvisoLlenar({ slug: clave, ok: r.ok, texto: r.message ?? "Listo." });
    } finally { setLlenando(null); }
  };

  // ¿Qué pasos ya están listos? (el ✓ de la barra)
  const aRedactar = activas.filter((c) => c.status === "planificada" || c.status === "fallida");
  const fichasListas = aRedactar.filter((c) => evaluarFicha(c.ficha).lista);
  const listo = [cfg.dias.length > 0 && cfg.horas.length > 0, cfg.cuotas.length > 0 && temas.length > 0, activas.length > 0, aRedactar.length > 0 && fichasListas.length === aRedactar.length, plan.status === "activo"];
  // Lo que hace «Siguiente» en cada paso: guarda y avanza; en Temas arma la pauta si aún no hay.
  const siguiente = () => {
    if (paso === 0) return hacer(guardar, () => irA(1));
    if (paso === 1) {
      if (activas.length > 0) return hacer(guardar, () => irA(2));
      return hacer(async () => { await guardar(); return armarPauta(plan.id); }, () => irA(2));
    }
    return irA(paso + 1);
  };
  const textoSiguiente = paso === 1 && activas.length === 0 ? "Armar la pauta con IA" : paso === 0 ? "Siguiente · Temas" : paso === 1 ? "Siguiente · Pauta" : paso === 2 ? "Siguiente · Fichas" : "Siguiente · Poner en marcha";
  const bloqueoSiguiente = paso === 1 && cfg.cuotas.length === 0 ? "Elige al menos una sección con notas por día" : "";

  return (
    <div className="flex flex-col gap-5 pb-28">
      {/* Cabecera y barra de pasos fijas: no se mueven al desplazar, solo el contenido del paso. */}
      <div className="sticky top-[3.9rem] z-30 -mx-4 flex flex-col gap-3 border-b border-[var(--border)] bg-[var(--bg)]/95 px-4 pb-3 pt-3 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0">
      <div>
        <Link href="/panel/consejo" className="mb-1 inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--accent)]"><ArrowLeft size={15} /> Consejos de redacción</Link>
        <div className="flex flex-wrap items-center gap-3">
          <InputVoz value={titulo} onValue={(v) => setTitulo(v)} disabled={!editable} aria-label="Nombre del consejo" className="lx-display min-w-0 flex-1 bg-transparent text-xl font-semibold tracking-tight outline-none focus:underline sm:text-2xl" />
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
        <Paso n={2} titulo="Temas, cobertura y responsable" ayuda="Empieza creando los temas. En cada formulario eliges la sección, la cobertura (cuántas notas por día, qué días y si salen con aprobación) y quién la escribe; la IA puede contestar el resto de las preguntas. Lo que falte, la IA lo completa al armar la pauta.">
          {/* Primero se crean los temas: en el mismo formulario se elige la sección, la cobertura y quién escribe. */}
          {editable && (
            <PreguntasSeccion key="nuevo" encabezado={(
              <div className="flex flex-col gap-3 rounded-[var(--radius)] border-2 border-[var(--accent)]/40 p-3 sm:col-span-2">
                <p className="lx-kicker text-[var(--accent)]">Cobertura de este tema</p>
                <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">¿En qué sección sale?</span>
                  <select value={seccionNueva} onChange={(e) => { setSeccionNueva(e.target.value); setDiaNuevo(undefined); }} className={campo}>
                    <option value="">Elige la sección…</option>
                    {secciones.map((x) => <option key={x.slug} value={x.slug}>{x.name.split(" › ").join(" / ")}{cuota(x.slug) ? ` · ${cuota(x.slug)?.porDia} por día` : ""}</option>)}
                  </select></label>
                {seccionNueva && (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold" role="group" aria-label="Cómo sale">¿Cómo sale?
                      {([["manual", "🖐 Con aprobación de un editor"], ["auto", "⚡ Automática"]] as const).map(([v, etq]) => {
                        const actual = cuota(seccionNueva)?.aprobacion ?? cfg.aprobacion;
                        return <button key={v} type="button" disabled={!editable || (v === "auto" && !puedePublicar)} aria-pressed={actual === v} onClick={() => ponerCuota(seccionNueva, cuota(seccionNueva)?.porDia ?? 1, v, cuota(seccionNueva)?.dias)} className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition disabled:opacity-40 ${actual === v ? "border-transparent bg-[var(--accent)] !text-white" : "border-[var(--border-strong)] bg-white text-[#0b0b0b]"}`}>{etq}</button>;
                      })}
                    </div>
                    <label className="flex items-center gap-2 text-sm font-semibold">¿Qué día sale este tema?
                      <select value={diaNuevo ?? ""} onChange={(e) => setDiaNuevo(e.target.value ? Number(e.target.value) : undefined)} className="rounded-[var(--radius)] border border-[var(--border-strong)] bg-white px-3 py-2 text-sm font-normal text-[#0b0b0b]">
                        <option value="">El primer día libre</option>
                        {(cuota(seccionNueva) ? diasDeCuota(cuota(seccionNueva)!, cfg) : cfg.dias).map((d) => <option key={d} value={d}>{DIAS_LARGO[d - 1]}</option>)}
                      </select></label>
                  </>
                )}
              </div>
            )} titulo="Nuevo tema" nombre="este tema" escritores={escritores} yoId={yoId} valor={borrador.nuevo} onChange={(c) => setBorrador((d) => ({ ...d, nuevo: { ...d.nuevo, ...c } }))} editable={editable} abierto={preguntasAbiertas.nuevo !== false} onToggle={() => setPreguntasAbiertas((p) => ({ ...p, nuevo: p.nuevo === false }))}>
              <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
                <span className="text-xs text-[var(--fg-muted)]">Describe un solo tema en la primera pregunta.</span>
                {(llenando === "nuevo" || avisoLlenar?.slug === "nuevo") && <p role="status" className={`w-full text-sm font-medium ${llenando === "nuevo" ? "text-[var(--fg-muted)]" : avisoLlenar?.ok ? "text-emerald-700" : "text-red-600"}`}>{llenando === "nuevo" ? "La IA está investigando el tema en la web y llenando las preguntas (puede tardar hasta un minuto)…" : avisoLlenar?.texto}</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={!editable || !!llenando || !seccionNueva || (borrador.nuevo?.temas ?? "").trim().length < 4} onClick={() => autollenar(seccionNueva, "nuevo")} className={secundario}>{llenando === "nuevo" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Autollenar el resto con IA</button>
                  <button type="button" disabled={!editable || !seccionNueva || (borrador.nuevo?.temas ?? "").trim().length < 4} onClick={guardarTemaDelFormulario} className={primario}><Check size={15} /> Guardar tema</button>
                </div>
              </div>
            </PreguntasSeccion>
          )}

          {porSeccion.length === 0 && <p className="rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] p-6 text-center text-sm text-[var(--fg-muted)]">Guarda tu primer tema y aparecerá aquí, agrupado por sección.</p>}
          {porSeccion.map((sec) => {
            return (
              <div key={sec.slug} className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-col"><span className="lx-kicker text-[var(--fg-muted)]">{sec.name.includes(" › ") ? "Subsección" : "Sección"}</span><h3 className="lx-display text-lg font-semibold">{sec.name.split(" › ").join(" / ")}</h3></div>
                  <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold text-[var(--fg-muted)]">{sec.propios.length} {sec.propios.length === 1 ? "tema" : "temas"}</span>
                  <span className="text-xs text-[var(--fg-muted)]">{sec.porDia} por día × {sec.dias} {sec.dias === 1 ? "día" : "días"}</span>
                </div>
                {sec.propios.length > 0 && (
                  <ul className="flex flex-col divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)]">
                    {sec.propios.map((t) => (
                      <li key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                        {t.origen === "ia" && <Bot size={15} aria-label="Propuesto por la IA" className="shrink-0 text-[var(--accent)]" />}
                        <div className="min-w-0 flex-1 basis-56"><p className="text-sm font-medium">{t.texto}</p><p className="text-xs text-[var(--fg-muted)]">{t.dia ? `📅 ${DIAS_LARGO[t.dia - 1]}` : "📅 Sin día fijo"}{t.brief?.escritorId ? ` · ✍ ${nombreEscritor(t.brief.escritorId)}` : ""}</p>{t.angulo && <p className="text-xs text-[var(--fg-muted)]">{t.angulo}</p>}</div>
                        <select value={t.dia ?? ""} disabled={!editable} onChange={(e) => setTemas((l) => l.map((x) => (x.id === t.id ? { ...x, dia: e.target.value ? Number(e.target.value) : undefined } : x)))} aria-label="Día en que sale" className="rounded-[var(--radius)] border border-[var(--border-strong)] bg-white px-2 py-2 text-xs text-[#0b0b0b]"><option value="">Sin día fijo</option>{sec.diasLista.map((d) => <option key={d} value={d}>{DIAS_LARGO[d - 1]}</option>)}</select>
                        <select value={t.prioridad} disabled={!editable} onChange={(e) => setTemas((l) => l.map((x) => (x.id === t.id ? { ...x, prioridad: Number(e.target.value) as 1 | 2 | 3 } : x)))} aria-label="Prioridad" className="rounded-[var(--radius)] border border-[var(--border-strong)] bg-white px-2 py-2 text-xs text-[#0b0b0b]">
                          <option value={1}>Prioritario</option><option value={2}>Normal</option><option value={3}>De apoyo</option>
                        </select>
                        <button type="button" aria-label="Quitar tema" disabled={!editable} onClick={() => setTemas((l) => l.filter((x) => x.id !== t.id))} className="grid size-10 place-items-center rounded-full hover:bg-[var(--surface-2)]"><Trash2 size={15} /></button>
                        <div className="basis-full"><PreguntasSeccion nombre={`este tema`} escritores={escritores} yoId={yoId} valor={t.brief} onChange={(c) => ponerBriefTema(t.id, c)} editable={editable} abierto={!!temaAbierto[t.id]} onToggle={() => setTemaAbierto((p) => ({ ...p, [t.id]: !p[t.id] }))} /></div>
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

      {paso === 2 && (
        <Paso n={3} titulo="Pauta de la semana" ayuda="Así reparte la IA las notas por día, hora y sección. Toca una pieza para cambiar el tema, la hora o cómo sale.">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={pend || !editable} onClick={() => hacer(async () => { await guardar(); return armarPauta(plan.id); })} className={secundario}>{pend ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {activas.length ? "Rearmar la pauta con IA" : "Armar la pauta con IA"}</button>
            {activas.length > 0 && <p className="text-xs text-[var(--fg-muted)]">{activas.length} piezas · {activas.filter((c) => c.approval === "auto").length} automáticas · ✋ con aprobación · ⚡ automática · <strong>arrastra una pieza a otro día u hora</strong></p>}
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
                        {fechas.map((f) => {
                          const clave = `${f}|${h}`;
                          return (
                            <td
                              key={f}
                              className={`align-top transition ${sobre === clave ? "rounded-[var(--radius)] bg-[var(--accent)]/15 outline outline-2 outline-dashed outline-[var(--accent)]" : ""}`}
                              onDragOver={(e) => { if (arrastrando) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (sobre !== clave) setSobre(clave); } }}
                              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre((s) => (s === clave ? null : s)); }}
                              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain") || arrastrando; if (id) soltar(id, f, h); }}
                            >
                              {casillas.filter((c) => c.status !== "omitida" && diaDe(c.publishAt) === f && horaDe(c.publishAt) === h).map((c) => (
                                <Chip key={c.id} c={c} nombre={nombre(c.sectionSlug)} escritor={c.ficha.escritorId ? nombreEscritor(c.ficha.escritorId) : undefined} activa={c.id === selId} onClick={() => setSelId(c.id === selId ? null : c.id)}
                                  arrastrable={editable && (c.status === "planificada" || c.status === "fallida")}
                                  onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); e.dataTransfer.effectAllowed = "move"; setArrastrando(c.id); }}
                                  onDragEnd={() => { setArrastrando(null); setSobre(null); }} />
                              ))}
                            </td>
                          );
                        })}
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
                      <div className="flex flex-col gap-1">{delDia.map((c) => <Chip key={c.id} c={c} nombre={nombre(c.sectionSlug)} escritor={c.ficha.escritorId ? nombreEscritor(c.ficha.escritorId) : undefined} hora activa={c.id === selId} onClick={() => setSelId(c.id === selId ? null : c.id)} />)}</div></div>
                  ) : null;
                })}
              </div>
            </>
          )}
          {sel && <PanelCasilla key={sel.id} c={sel} secciones={secciones} puedePublicar={puedePublicar} escritores={escritores} escritorConsejo={cfg.escritorId ?? ""} yoId={yoId} onClose={() => setSelId(null)} onGuardar={(d) => hacer(() => guardarCasilla(sel.id, d))} onQuitar={() => hacer(() => quitarCasilla(sel.id), () => setSelId(null))} onAprobar={() => hacer(() => aprobar(sel.id))} pend={pend} />}
        </Paso>
      )}

      {paso === 3 && (
        <Paso n={4} titulo="Fichas de pauta" ayuda="Antes de que la IA escriba una nota, el consejo debe dejar definido de qué trata, por qué ahora, a quién le importa, con qué fuentes y qué preguntas responde. Así la IA no inventa. Aquí ves cómo va cada pieza y puedes completarlas con investigación.">
          {aRedactar.length === 0 ? (
            <p className="rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] p-8 text-center text-sm text-[var(--fg-muted)]">No hay piezas por redactar. Arma la pauta en el paso 3.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] bg-[var(--surface-2)] px-4 py-3">
                <p className="flex-1 text-sm"><strong>{fichasListas.length} de {aRedactar.length}</strong> fichas listas para redactar.</p>
                <button type="button" disabled={pend || !!cargando || !editable || fichasListas.length === aRedactar.length} onClick={() => run(async () => {
                  for (const c of aRedactar) {
                    if (evaluarFicha(c.ficha).lista || c.topic.trim().length < 8) continue;
                    setCargando(c.id);
                    const r = await completarFicha(c.id, c.ficha);
                    setCargando(null);
                    setMsg({ ok: r.ok, texto: r.ok ? `Ficha completada: «${c.topic}»` : `«${c.topic}»: ${r.message}` });
                    if (!r.ok) break;
                    router.refresh();
                  }
                })} className={primario}>{cargando ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Completar todas con investigación</button>
              </div>
              <ul className="flex flex-col divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)]">
                {aRedactar.map((c) => {
                  const ev = evaluarFicha(c.ficha);
                  return (
                    <li key={c.id} className="flex flex-col gap-2 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1 basis-64"><p className="text-sm font-semibold">{c.topic || "Sin tema"}</p><p className="text-xs text-[var(--fg-muted)]">{nombre(c.sectionSlug)} · sale {nombreDia(diaDe(c.publishAt))} {horaDe(c.publishAt)}{escritorDe(c) ? ` · ✍ ${escritores.find((e) => e.id === escritorDe(c))?.nombre ?? ""}` : ""}</p></div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ev.lista ? "bg-emerald-600/15 text-emerald-700" : "bg-amber-500/15 text-amber-700"}`}>{ev.lista ? `Lista · ${ev.avance}%` : `Incompleta · ${ev.avance}%`}</span>
                        <button type="button" onClick={() => setSelId(c.id === selId ? null : c.id)} className={secundario}>{c.id === selId ? "Cerrar" : "Abrir la ficha"}</button>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]" aria-hidden><div className={`h-full rounded-full transition-all ${ev.lista ? "bg-emerald-600" : "bg-amber-500"}`} style={{ width: `${ev.avance}%` }} /></div>
                      {!ev.lista && <p className="text-xs text-[var(--fg-muted)]">Falta: {ev.faltanObligatorias.join(" · ")}</p>}
                      {c.error && <p className="text-xs text-amber-700">{c.error}</p>}
                    </li>
                  );
                })}
              </ul>
              {sel && <PanelCasilla key={sel.id} c={sel} secciones={secciones} puedePublicar={puedePublicar} escritores={escritores} escritorConsejo={cfg.escritorId ?? ""} yoId={yoId} onClose={() => setSelId(null)} onGuardar={(d) => hacer(() => guardarCasilla(sel.id, d))} onQuitar={() => hacer(() => quitarCasilla(sel.id), () => setSelId(null))} onAprobar={() => hacer(() => aprobar(sel.id))} pend={pend} />}
            </>
          )}
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
                <strong>Fichas de pauta: {listas} de {pend.length} listas.</strong> {listas === pend.length ? "Todas las piezas tienen su foco, fuentes y preguntas." : "Las que falten las completa el editor jefe con investigación al llegar la hora; si aun así faltan datos obligatorios, la pieza se detiene y te avisa. Puedes completarlas ya en el paso 4 (Fichas)."}
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
          {activas.length === 0 && <p className="text-sm text-amber-600">Antes de activar necesitas una pauta: vuelve al paso 3.</p>}
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
function Chip({ c, nombre, escritor, activa, onClick, hora, arrastrable, onDragStart, onDragEnd }: { c: CasillaVista; nombre: string; escritor?: string; activa: boolean; onClick: () => void; hora?: boolean; arrastrable?: boolean; onDragStart?: (e: React.DragEvent) => void; onDragEnd?: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activa} draggable={arrastrable} onDragStart={onDragStart} onDragEnd={onDragEnd} title={arrastrable ? "Arrástrala a otro día u hora" : undefined} className={`flex w-full flex-col gap-0.5 rounded-[var(--radius)] border px-2 py-1.5 text-left transition hover:border-[var(--accent)] ${arrastrable ? "cursor-grab active:cursor-grabbing" : ""} ${COLOR[c.status]} ${activa ? "ring-2 ring-[var(--accent)]" : ""}`}>
      <span className="flex items-center justify-between gap-1 text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--fg-muted)]"><span className="truncate">{hora ? `${horaDe(c.publishAt)} · ` : ""}{nombre}</span><span className="shrink-0">{c.approval === "auto" ? "⚡ auto" : "✋"}</span></span>
      <span className="line-clamp-2 text-xs font-medium leading-snug">{c.topic || "Sin tema"}</span>
      {escritor && <span className="truncate text-[0.68rem] text-[var(--fg-muted)]">✍ {escritor}</span>}
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

// Una pregunta de la sección: texto, campo y ayuda.
function Caja({ clave, children }: { clave: keyof BriefSeccion; children: React.ReactNode }) {
  const q = PREGUNTAS_SECCION.find((p) => p.clave === clave)!;
  return <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">{q.pregunta}</span>{children}<span className="text-xs text-[var(--fg-muted)]">{q.ayuda}</span></label>;
}

// Las preguntas del editor jefe a una sección: lo que el consejo contesta antes de pedirle temas a la IA. Fuera del editor para que los campos no pierdan el foco.
function PreguntasSeccion({ nombre, titulo, escritores, yoId, encabezado, children, valor, onChange, editable, abierto, onToggle }: { nombre: string; titulo?: string; escritores?: EscritorOpcion[]; yoId?: string; encabezado?: React.ReactNode; children?: React.ReactNode; valor: BriefSeccion | undefined; onChange: (c: Partial<BriefSeccion>) => void; editable: boolean; abierto: boolean; onToggle: () => void }) {
  const n = respondidas(valor);
  const sel = "w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-white px-3 py-2 text-sm text-[#0b0b0b]";
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)]/50">
      <button type="button" onClick={onToggle} aria-expanded={abierto} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
        <Bot size={16} className="shrink-0 text-[var(--accent)]" aria-hidden />
        <span className="min-w-0 flex-1 text-sm font-semibold">{titulo ?? `Cuéntale a la IA sobre ${nombre}`}<span className="ml-2 text-xs font-normal text-[var(--fg-muted)]">{n} de {PREGUNTAS_SECCION.length} respondidas · cuantas más, mejores temas y notas</span></span>
        <ChevronRight size={16} className={`shrink-0 transition-transform ${abierto ? "rotate-90" : ""}`} aria-hidden />
      </button>
      {abierto && (
        <div className="grid gap-4 border-t border-[var(--border)] p-3 sm:grid-cols-2">
          {encabezado}
          {escritores && yoId && (
            <label className="flex flex-col gap-1 text-sm sm:col-span-2"><span className="flex items-center gap-1.5 font-semibold"><PenLine size={14} aria-hidden /> ¿Quién la escribe?</span>
              <select disabled={!editable} value={valor?.escritorId ?? ""} onChange={(e) => onChange({ escritorId: e.target.value || undefined })} className={sel}><option value="">El predeterminado ({escritores.find((e) => e.id === yoId)?.nombre ?? "yo"})</option>{[...escritores].sort((a, b) => Number(b.conDiagnostico) - Number(a.conDiagnostico) || a.nombre.localeCompare(b.nombre)).map((e) => <option key={e.id} value={e.id}>{e.nombre}{e.id === yoId ? " (yo)" : ""}{e.tipo === "externo" ? " · externo" : ""}{e.conDiagnostico ? "" : " · sin estilo aprendido"}</option>)}</select>
              <span className="text-xs text-[var(--fg-muted)]">Sus temas, la pauta y la nota usan su diagnóstico de estilo.</span></label>
          )}
          <div className="sm:col-span-2"><Caja clave="temas"><AreaVoz autoAjustar rows={2} disabled={!editable} value={valor?.temas ?? ""} onValue={(v) => onChange({ temas: v })} placeholder="Ej.: sequía y pasturas, precio del novillo, ciclo de vacunación contra la aftosa" className={sel} /></Caja></div>
          <div className="sm:col-span-2"><Caja clave="agenda"><AreaVoz autoAjustar rows={2} disabled={!editable} value={valor?.agenda ?? ""} onValue={(v) => onChange({ agenda: v })} placeholder="Ej.: Feria de Montería del 15 al 18; el DANE publica el sacrificio el jueves" className={sel} /></Caja></div>
          <Caja clave="audiencia"><select disabled={!editable} value={valor?.audiencia ?? ""} onChange={(e) => onChange({ audiencia: (e.target.value || undefined) as BriefSeccion["audiencia"] })} className={sel}><option value="">Sin definir</option>{AUDIENCIAS.map((a) => <option key={a} value={a}>{a}</option>)}</select></Caja>
          <Caja clave="palabras"><select disabled={!editable} value={valor?.palabras ?? ""} onChange={(e) => onChange({ palabras: e.target.value ? Number(e.target.value) : undefined })} className={sel}><option value="">Sin definir</option>{PALABRAS_OPCIONES.map((p) => <option key={p} value={p}>Unas {p} palabras</option>)}</select></Caja>
          <div className="sm:col-span-2">
            <Caja clave="generos"><span className="flex flex-wrap gap-1.5">{(Object.keys(GENEROS) as Genero[]).map((g) => { const on = valor?.generos?.includes(g) ?? false; return <button key={g} type="button" disabled={!editable} aria-pressed={on} onClick={() => onChange({ generos: on ? (valor?.generos ?? []).filter((x) => x !== g) : [...(valor?.generos ?? []), g] })} className={`min-h-9 rounded-full border px-3 text-sm font-medium ${on ? "border-transparent bg-[var(--accent)] text-[var(--accent-fg,#fff)]" : "border-[var(--border-strong)] text-[var(--fg-muted)]"}`}>{GENEROS[g]}</button>; })}</span></Caja>
          </div>
          <Caja clave="grafica"><select disabled={!editable} value={valor?.grafica ?? ""} onChange={(e) => onChange({ grafica: (e.target.value || undefined) as BriefSeccion["grafica"] })} className={sel}><option value="">Sin definir</option><option value="si">Sí, si hay cifras con fuente</option><option value="no">No</option></select></Caja>
          <Caja clave="alcance"><select disabled={!editable} value={valor?.alcance ?? ""} onChange={(e) => onChange({ alcance: (e.target.value || undefined) as BriefSeccion["alcance"] })} className={sel}><option value="">Sin definir</option>{ALCANCES.map((a) => <option key={a} value={a}>{a}</option>)}</select></Caja>
          <Caja clave="lugares"><InputVoz disabled={!editable} value={valor?.lugares ?? ""} onValue={(v) => onChange({ lugares: v })} placeholder="Ej.: Caribe, Meta, Brasil" className={sel} /></Caja>
          <Caja clave="tono"><select disabled={!editable} value={valor?.tono ?? ""} onChange={(e) => onChange({ tono: (e.target.value || undefined) as BriefSeccion["tono"] })} className={sel}><option value="">Sin definir</option>{TONOS.map((t) => <option key={t} value={t}>{t}</option>)}</select></Caja>
          <Caja clave="fuentes"><InputVoz disabled={!editable} value={valor?.fuentes ?? ""} onValue={(v) => onChange({ fuentes: v })} placeholder="Ej.: ICA, FEDEGAN, DANE" className={sel} /></Caja>
          <div className="sm:col-span-2"><Caja clave="evitar"><AreaVoz autoAjustar rows={2} disabled={!editable} value={valor?.evitar ?? ""} onValue={(v) => onChange({ evitar: v })} placeholder="Ej.: no repetir la sequía de la semana pasada; evitar cifras sin fuente" className={sel} /></Caja></div>
          {children}
        </div>
      )}
    </div>
  );
}

// Una pregunta de la ficha: etiqueta, campo y ayuda (fuera de PanelCasilla para que el campo no pierda el foco al escribir).
function Pregunta({ clave, children }: { clave: string; children: React.ReactNode }) {
  const q = PREGUNTAS_FICHA.find((p) => p.clave === clave)!;
  return (
    <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">{q.etiqueta}{q.obligatoria && <span className="ml-1 text-amber-600" title="Obligatoria para redactar">*</span>}</span>{children}<span className="text-xs text-[var(--fg-muted)]">{q.ayuda}</span></label>
  );
}

// Edición de una pieza y de su ficha de pauta.
function PanelCasilla({ c, secciones, puedePublicar, escritores, escritorConsejo, yoId, onClose, onGuardar, onQuitar, onAprobar, pend }: { c: CasillaVista; secciones: Seccion[]; puedePublicar: boolean; escritores: EscritorOpcion[]; escritorConsejo: string; yoId: string; onClose: () => void; onGuardar: (d: { topic: string; angle: string; brief: string; sectionSlug: string; publishAt: string; priority: number; approval: Aprobacion; ficha: FichaPauta }) => void; onQuitar: () => void; onAprobar: () => void; pend: boolean }) {
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
    <AreaVoz rows={3} disabled={!editable} value={(f[clave] ?? []).join("\n")} onValue={(v) => setF({ ...f, [clave]: lineas(v) })} placeholder="Uno por línea" className={campo} />
  );
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--accent)] bg-[var(--bg-2)] p-4">
      <div className="flex items-center justify-between"><p className="lx-kicker text-[var(--accent)]">Pieza · {ESTADOS_CASILLA[c.status]}</p><button type="button" onClick={onClose} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full hover:bg-[var(--surface-2)]"><X size={16} /></button></div>
      {c.error && <p className="rounded-[var(--radius)] border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs">{c.error}</p>}
      <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Tema (titular tentativo)</span><InputVoz value={d.topic} disabled={!editable} onValue={(v) => setD({ ...d, topic: v })} className={campo} /></label>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Sección</span><select value={d.sectionSlug} disabled={!editable} onChange={(e) => setD({ ...d, sectionSlug: e.target.value })} className={campo}>{secciones.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Día</span><input type="date" value={d.fecha} disabled={!editable} onChange={(e) => setD({ ...d, fecha: e.target.value })} className={campo} /></label>
        <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Hora</span><input type="time" value={d.hora} disabled={!editable} onChange={(e) => setD({ ...d, hora: e.target.value })} className={campo} /></label>
        <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Prioridad</span><select value={d.priority} disabled={!editable} onChange={(e) => setD({ ...d, priority: Number(e.target.value) })} className={campo}><option value={1}>Alta</option><option value={2}>Normal</option><option value={3}>De apoyo</option></select></label>
      </div>
      <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Editor IA que escribe esta nota</span>
        <select value={f.escritorId ?? ""} disabled={!editable} onChange={(e) => setF({ ...f, escritorId: e.target.value || undefined })} className={campo}>
          <option value="">El del consejo ({escritores.find((e) => e.id === (escritorConsejo || yoId))?.nombre ?? "yo"})</option>
          {[...escritores].sort((a, b) => Number(b.conDiagnostico) - Number(a.conDiagnostico) || a.nombre.localeCompare(b.nombre)).map((e) => <option key={e.id} value={e.id}>{e.nombre}{e.id === yoId ? " (yo)" : ""}{e.tipo === "externo" ? " · externo" : ""}{e.conDiagnostico ? "" : " · sin estilo aprendido"}</option>)}
        </select>
        <span className="text-xs text-[var(--fg-muted)]">La IA escribe con el estilo de esa persona (tono, ritmo, vocabulario; nunca sus hechos). Si tiene cuenta en el panel, la nota sale firmada por ella.</span></label>
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
        <Pregunta clave="foco"><InputVoz value={f.foco ?? ""} disabled={!editable} onValue={(v) => setF({ ...f, foco: v })} className={campo} /></Pregunta>
        <Pregunta clave="porQueAhora"><InputVoz value={f.porQueAhora ?? ""} disabled={!editable} onValue={(v) => setF({ ...f, porQueAhora: v })} className={campo} /></Pregunta>
        <Pregunta clave="audiencia"><InputVoz value={f.audiencia ?? ""} disabled={!editable} onValue={(v) => setF({ ...f, audiencia: v })} className={campo} /></Pregunta>
        <Pregunta clave="novedad"><InputVoz value={f.novedad ?? ""} disabled={!editable} onValue={(v) => setF({ ...f, novedad: v })} className={campo} /></Pregunta>
        <Pregunta clave="fuentes"><AreaVoz rows={3} disabled={!editable} value={fuentesTxt} onValue={(v) => setFuentesTxt(v)} placeholder={"Una por línea: «ICA — https://enlace» (documento), «doc: Boletín DANE» o «Gerente de FEDEGAN» (voz)"} className={campo} /></Pregunta>
        <Pregunta clave="preguntas">{campoLista("preguntas")}</Pregunta>
        <Pregunta clave="datosAConfirmar">{campoLista("datosAConfirmar")}</Pregunta>
        <Pregunta clave="abiertas">{campoLista("abiertas")}</Pregunta>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Género</span><select value={f.genero ?? ""} disabled={!editable} onChange={(e) => setF({ ...f, genero: (e.target.value || undefined) as Genero | undefined })} className={campo}><option value="">Sin definir</option>{(Object.keys(GENEROS) as Genero[]).map((g) => <option key={g} value={g}>{GENEROS[g]}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Palabras (aprox.)</span><input type="number" min={150} max={1500} step={50} disabled={!editable} value={f.palabras ?? ""} onChange={(e) => setF({ ...f, palabras: e.target.value ? Number(e.target.value) : undefined })} placeholder="450" className={campo} /></label>
          <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Vigencia</span><select value={f.vigencia ?? ""} disabled={!editable} onChange={(e) => setF({ ...f, vigencia: (e.target.value || undefined) as Vigencia | undefined })} className={campo}><option value="">Sin definir</option>{(Object.keys(VIGENCIAS) as Vigencia[]).map((v) => <option key={v} value={v}>{VIGENCIAS[v]}</option>)}</select></label>
        </div>
        <Pregunta clave="riesgos">{campoLista("riesgos")}</Pregunta>
        <Pregunta clave="palabraClave"><InputVoz value={f.palabraClave ?? ""} disabled={!editable} onValue={(v) => setF({ ...f, palabraClave: v })} className={campo} /></Pregunta>
        <Pregunta clave="visual"><InputVoz value={f.visual ?? ""} disabled={!editable} onValue={(v) => setF({ ...f, visual: v })} className={campo} /></Pregunta>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!editable} checked={f.conGrafica === true} onChange={(e) => setF({ ...f, conGrafica: e.target.checked || undefined })} /> <span className="font-semibold">Incluir una gráfica de datos</span><span className="text-xs text-[var(--fg-muted)]">· la IA la arma con cifras con fuente; si no las halla, la nota sale sin ella.</span></label>
        <Pregunta clave="evitar">{campoLista("evitar")}</Pregunta>
        <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Notas adicionales para la IA</span><AreaVoz rows={3} value={d.brief} disabled={!editable} onValue={(v) => setD({ ...d, brief: v })} className={campo} /></label>
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
