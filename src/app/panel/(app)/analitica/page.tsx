import Link from "next/link";
import { BarChart3, Clock, Eye, Flame, Repeat, ScrollText, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import { requirePermiso } from "@/lib/auth";
import { Card } from "@/components/ui";
import { BiFiltros } from "@/components/panel/bi-filtros";
import { EmbudoLectura, GraficaTiempo, ListaBarras, MapaCalorHoras, MapaLectura, SerieDiaria } from "@/components/panel/bi-graficas";
import { BI_COLORES } from "@/lib/graficas";
import { TablaNotas } from "@/components/panel/bi-notas";
import { SubscriberMap } from "@/components/panel/subscriber-map";
import { aParametros, filtrosActivos, hoyColombia, leerFiltros } from "@/lib/lectores-filtros";
import { panorama } from "@/lib/lectores-consulta";
import { panoramaSuscriptores } from "@/lib/suscriptores-consulta";
import { subscriberPoints } from "@/lib/subscriber-map";
import { hallazgosAudiencia } from "@/lib/lectores-resumen";
import { duracion, parte, variacionPct } from "@/lib/lectores-formato";
import { nfCO } from "@/lib/format";

// Se calcula en cada petición, nunca durante la compilación.
export const dynamic = "force-dynamic";

/**
 * Centro de análisis: qué leen, cuándo, desde dónde y cómo crece la base de suscriptores, con filtros que cruzan todo
 * (periodo, dispositivo, ciudad, origen, sección, visitante nuevo o recurrente). Solo para quien tenga el permiso
 * «analitica». La medición de lectores es anónima y con permiso: aquí no aparece ninguna persona, solo agregados.
 */
type Q = Record<string, string | string[] | undefined>;

// Tarjeta de un indicador con su variación frente al periodo anterior.
function Kpi({ icono: Icono, titulo, valor, ayuda, delta, bueno = "sube" }: { icono: typeof Eye; titulo: string; valor: string; ayuda: string; delta: number | null; bueno?: "sube" | "baja" }) {
  const mejora = delta === null ? null : bueno === "sube" ? delta >= 0 : delta <= 0;
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
      <div className="flex items-center justify-between gap-2 text-[var(--fg-muted)]">
        <p className="lx-kicker">{titulo}</p>
        <Icono size={16} aria-hidden />
      </div>
      <p className="lx-display mt-2 text-3xl font-semibold tabular-nums">{valor}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        {delta !== null ? (
          <span className={`font-bold tabular-nums ${mejora ? "text-[#157a4a]" : "text-[#b4232a]"}`}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toLocaleString("es-CO", { maximumFractionDigits: 0 })} %</span>
        ) : (
          <span className="text-[var(--fg-muted)]">sin periodo previo</span>
        )}
        <span className="text-[var(--fg-muted)]">{ayuda}</span>
      </p>
    </div>
  );
}

// Valor por lectura (segundos, por ejemplo) con su variación.
const dif = (a: number, b: number) => variacionPct(a, b);

function Panel({ titulo, kicker, children, className = "" }: { titulo: string; kicker: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`min-w-0 p-5 sm:p-6 ${className}`}>
      <p className="lx-kicker text-[var(--fg-muted)]">{kicker}</p>
      <h2 className="lx-display mb-4 mt-1 text-xl font-semibold">{titulo}</h2>
      {children}
    </Card>
  );
}

// Barras simples (sin interacción) para los datos de suscriptores.
function Barras({ items, total }: { items: { clave: string; n: number }[]; total: number }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  if (!items.length) return <p className="text-sm text-[var(--fg-muted)]">Sin datos.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((i) => (
        <li key={i.clave}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{i.clave}</span>
            <span className="shrink-0 tabular-nums"><strong>{nfCO.format(i.n)}</strong> <span className="text-[var(--fg-muted)]">· {parte(i.n, total).toLocaleString("es-CO", { maximumFractionDigits: 0 })} %</span></span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${(i.n / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export default async function AnaliticaPage({ searchParams }: { searchParams: Promise<Q> }) {
  await requirePermiso("analitica");
  const q = await searchParams;
  const f = leerFiltros(q);
  const vista = q.vista === "suscriptores" ? "suscriptores" : "audiencia";
  const hoy = hoyColombia();
  const enlace = (v: string) => `?${new URLSearchParams({ ...Object.fromEntries(aParametros(f)), vista: v }).toString()}`;

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="lx-kicker text-[var(--accent)]">Centro de análisis</p>
          <h1 className="lx-display mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Audiencia y suscriptores</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--fg-muted)]">Qué se lee, a qué hora, desde dónde y con quién. Cruza los filtros para llegar al detalle; cada vista queda en la dirección y se puede compartir.</p>
        </div>
        <nav aria-label="Vista" className="inline-flex rounded-full border border-[var(--border-strong)] bg-[var(--surface)] p-0.5">
          {([["audiencia", "Audiencia", BarChart3], ["suscriptores", "Suscriptores", Users]] as const).map(([k, t, Icono]) => (
            <Link key={k} href={enlace(k)} aria-current={vista === k ? "page" : undefined} className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${vista === k ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>
              <Icono size={15} aria-hidden /> {t}
            </Link>
          ))}
        </nav>
      </header>

      {vista === "audiencia" ? <Audiencia f={f} hoy={hoy} /> : <Suscriptores f={f} hoy={hoy} />}
    </div>
  );
}

async function Audiencia({ f, hoy }: { f: ReturnType<typeof leerFiltros>; hoy: string }) {
  let p: Awaited<ReturnType<typeof panorama>>;
  try {
    p = await panorama(f);
  } catch {
    return (
      <Card className="flex items-start gap-3 border-[#b4232a]/40 p-5">
        <TriangleAlert aria-hidden className="mt-0.5 shrink-0 text-[#b4232a]" />
        <div className="text-sm">
          <p className="font-semibold">Falta preparar la base de datos de la medición.</p>
          <p className="mt-1 text-[var(--fg-muted)]">Corre la migración <code className="lx-mono">drizzle/0011_lecturas_de_lectores.sql</code> en el SQL Editor de Supabase y recarga esta página.</p>
        </div>
      </Card>
    );
  }
  const i = p.indicadores;
  const a = p.anterior;
  const hallazgos = hallazgosAudiencia(p);
  const cobertura = p.lecturasTotales > 0 ? parte(i.lecturas, p.lecturasTotales) : null;
  const filtrado = filtrosActivos(f) > 0;
  return (
    <>
      <BiFiltros filtros={f} opciones={p.opciones} hoy={hoy} />

      {!p.hayLecturas ? (
        <Card className="p-6 sm:p-8">
          <ShieldCheck aria-hidden className="text-[var(--accent)]" />
          <h2 className="lx-display mt-3 text-2xl font-semibold">La medición acaba de empezar</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--fg-muted)]">Los lectores ven un aviso y deciden si aceptan que midamos su lectura de forma anónima. Cuando acepten, aquí aparecerán qué leen, a qué hora, desde qué ciudad y cuánto de cada nota. No hace falta hacer nada más: las primeras lecturas se verán en minutos.</p>
        </Card>
      ) : (
        <>
          {cobertura !== null && (
            <p className="flex items-start gap-2 rounded-[var(--radius)] bg-[var(--surface-2)] px-3.5 py-2.5 text-xs leading-relaxed text-[var(--fg-muted)]">
              <ShieldCheck size={15} aria-hidden className="mt-0.5 shrink-0 text-[var(--accent)]" />
              <span>Muestra con permiso: {nfCO.format(i.lecturas)} de las {nfCO.format(p.lecturasTotales)} lecturas del contador general ({cobertura.toLocaleString("es-CO", { maximumFractionDigits: 0 })} %){filtrado ? " — con los filtros aplicados la comparación es aproximada" : ""}. Solo se mide a quien acepta; los porcentajes describen a ese grupo.</span>
            </p>
          )}

          <section aria-label="Indicadores" className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
            <Kpi icono={Eye} titulo="Lecturas" valor={nfCO.format(i.lecturas)} ayuda="notas abiertas" delta={dif(i.lecturas, a.lecturas)} />
            <Kpi icono={Users} titulo="Lectores únicos" valor={nfCO.format(i.visitantes)} ayuda={`${(i.lecturas / Math.max(1, i.visitantes)).toLocaleString("es-CO", { maximumFractionDigits: 1 })} ${i.lecturas / Math.max(1, i.visitantes) === 1 ? "nota" : "notas"} por lector`} delta={dif(i.visitantes, a.visitantes)} />
            <Kpi icono={Clock} titulo="Tiempo típico" valor={duracion(i.segundosMediana)} ayuda={`promedio ${duracion(i.segundosMedios)}`} delta={dif(i.segundosMediana, a.segundosMediana)} />
            <Kpi icono={ScrollText} titulo="Lectura completa" valor={`${parte(i.completas, i.lecturas).toLocaleString("es-CO", { maximumFractionDigits: 0 })} %`} ayuda={`bajan el ${Math.round(i.scrollMedio)} % del texto`} delta={dif(parte(i.completas, i.lecturas), parte(a.completas, a.lecturas))} />
            <Kpi icono={Repeat} titulo="Vuelven" valor={`${parte(i.recurrentes, i.lecturas).toLocaleString("es-CO", { maximumFractionDigits: 0 })} %`} ayuda="lecturas de quien ya leyó antes" delta={dif(parte(i.recurrentes, i.lecturas), parte(a.recurrentes, a.lecturas))} />
            <Kpi icono={Flame} titulo="Rebote" valor={`${parte(i.rebotes, i.lecturas).toLocaleString("es-CO", { maximumFractionDigits: 0 })} %`} ayuda="se van en menos de 10 s" delta={dif(parte(i.rebotes, i.lecturas), parte(a.rebotes, a.lecturas))} bueno="baja" />
          </section>

          {hallazgos.length > 0 && (
            <section aria-label="Lo que dicen los datos" className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-gradient-to-br from-[var(--accent)]/6 to-transparent p-4 sm:p-5">
              <h2 className="lx-kicker text-[var(--accent)]">Lo que dicen los datos</h2>
              <ul className="mt-3 grid gap-2.5 md:grid-cols-2">
                {hallazgos.map((h) => (
                  <li key={h.texto} className="flex items-start gap-2.5 text-sm leading-relaxed">
                    <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${h.tono === "bien" ? "bg-[#157a4a]" : h.tono === "alerta" ? "bg-[#b4232a]" : "bg-[var(--accent)]"}`} />
                    {h.texto}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Panel kicker="Tendencia" titulo="Lecturas y lectores por día"><SerieDiaria serie={p.serie} lectoresUnicos={i.visitantes} /></Panel>

          <div className="grid gap-5 lg:grid-cols-2 sm:gap-6">
            <Panel kicker="Cuándo leen" titulo="Día de la semana y hora"><MapaCalorHoras calor={p.calor} /></Panel>
            <Panel kicker="Cuánto leen" titulo="¿Leen todo?"><EmbudoLectura embudo={p.embudo} /></Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 sm:gap-6">
            <Panel kicker="Desde dónde" titulo="Departamentos"><MapaLectura regiones={p.regiones} total={i.lecturas} /></Panel>
            <Panel kicker="Desde dónde" titulo="Ciudades"><ListaBarras items={p.ciudades.slice(0, 8)} total={i.lecturas} param="ciudad" /></Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-3 sm:gap-6">
            <Panel kicker="Con qué" titulo="Dispositivo"><ListaBarras items={p.dispositivos} total={i.lecturas} param="dispositivo" mapa="dispositivo" /></Panel>
            <Panel kicker="Con qué" titulo="Navegador"><ListaBarras items={p.navegadores} total={i.lecturas} /></Panel>
            <Panel kicker="Con qué" titulo="Sistema"><ListaBarras items={p.sistemas} total={i.lecturas} /></Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 sm:gap-6">
            <Panel kicker="Cómo llegan" titulo="Origen del tráfico"><ListaBarras items={p.fuentes} total={i.lecturas} param="fuente" /></Panel>
            <Panel kicker="Qué leen" titulo="Secciones"><ListaBarras items={p.categorias} total={i.lecturas} /></Panel>
          </div>

          <Panel kicker="Qué leen" titulo="Notas con más lectura y cuánto las terminan"><TablaNotas notas={p.notas} total={i.lecturas} /></Panel>

          <p className="text-xs leading-relaxed text-[var(--fg-muted)]">
            Las horas son de Colombia. «Lectura completa» cuenta a quien llegó al 85 % o más de la nota; «rebote» a quien se fue en menos de 10 segundos sin bajar un cuarto. La ciudad y el departamento son aproximados (se deducen de la conexión). No se guarda ninguna IP, nombre ni correo.
          </p>
        </>
      )}
    </>
  );
}

async function Suscriptores({ f, hoy }: { f: ReturnType<typeof leerFiltros>; hoy: string }) {
  const [s, puntos] = await Promise.all([panoramaSuscriptores(f), subscriberPoints()]);
  const r = s.resumen;
  const c = s.completitud;
  return (
    <>
      <BiFiltros filtros={f} opciones={{ ciudades: [], fuentes: [], categorias: [] }} hoy={hoy} soloFechas />
      <section aria-label="Indicadores" className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
        <Kpi icono={Users} titulo="Suscriptores activos" valor={nfCO.format(r.activos)} ayuda={`${nfCO.format(r.total)} altas en total`} delta={null} />
        <Kpi icono={Eye} titulo="Altas del periodo" valor={nfCO.format(r.altasPeriodo)} ayuda="frente al periodo anterior" delta={dif(r.altasPeriodo, r.altasAnterior)} />
        <Kpi icono={Flame} titulo="Bajas del periodo" valor={nfCO.format(r.bajasPeriodo)} ayuda={`${nfCO.format(r.bajas)} bajas en total`} delta={null} />
        <Kpi icono={ShieldCheck} titulo="Confirmación" valor={`${r.confirmacion.toLocaleString("es-CO", { maximumFractionDigits: 0 })} %`} ayuda={`${nfCO.format(r.pendientes)} pendientes de confirmar`} delta={null} />
      </section>

      <Panel kicker="Crecimiento" titulo="Altas por día y base acumulada">
        <GraficaTiempo
          dias={s.serie.map((d) => d.dia)}
          series={[
            { clave: "acumulado", etiqueta: "Base activa acumulada", valores: s.serie.map((d) => d.acumulado), color: BI_COLORES[0], area: true, total: s.serie[s.serie.length - 1]?.acumulado ?? 0 },
            { clave: "altas", etiqueta: "Altas del día", valores: s.serie.map((d) => d.altas), color: BI_COLORES[1] },
          ]}
        />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-3 sm:gap-6">
        <Panel kicker="Quiénes son" titulo="Edad"><Barras items={s.edades} total={c.activos || 1} /></Panel>
        <Panel kicker="Dónde están" titulo="Ciudades"><Barras items={s.ciudades} total={r.activos || 1} /></Panel>
        <Panel kicker="Cómo leen el correo" titulo="Proveedor"><Barras items={s.correos} total={r.activos || 1} /></Panel>
      </div>

      <Panel kicker="Dónde están" titulo="Mapa de suscriptores"><SubscriberMap points={puntos} /></Panel>

      <Card className="p-5 text-sm">
        <h2 className="lx-display text-lg font-semibold">Qué tan completa está la base</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {([["Edad", c.edad], ["Ciudad", c.ciudad], ["Celular", c.celular]] as const).map(([t, n]) => (
            <li key={t}>
              <div className="flex justify-between"><span className="font-medium">{t}</span><span className="tabular-nums text-[var(--fg-muted)]">{parte(n, c.activos).toLocaleString("es-CO", { maximumFractionDigits: 0 })} %</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]"><div className="h-full rounded-full bg-[var(--accent-2)]" style={{ width: `${parte(n, c.activos)}%` }} /></div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-[var(--fg-muted)]">Todo aquí es agregado: ninguna persona aparece sola ni se muestra su correo. Saber qué lee cada suscriptor exige su autorización expresa y todavía no está activado.</p>
      </Card>
    </>
  );
}
