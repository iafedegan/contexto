import Link from "next/link";
import { sql } from "drizzle-orm";
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  ArrowUpRight,
  Bot,
  Eye,
  Newspaper,
  CalendarClock,
  FileEdit,
  Minus,
  MessagesSquare,
  ScanSearch,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { tienePermiso } from "@/lib/permisos-server";
import { TabsResumen } from "@/components/panel/tabs-resumen";
import { db } from "@/db";
import { agentDrafts, articles, assistantQueries } from "@/db/schema";
import { Card } from "@/components/ui";
import { pctChange, siteDailySeries, siteWeekTotals } from "@/lib/article-stats";
import { AreaChart, Donut } from "@/components/panel/dash-charts";
import { nfCO as nf } from "@/lib/format";

// Estado de la lista de artículos al que lleva cada indicador.
const ESTADO_URL: Record<string, string> = { Publicados: "publicado", "En revisión": "en_revision", Programados: "programado", Borradores: "borrador" };

// Se calcula en cada petición, nunca durante la compilación.
export const dynamic = "force-dynamic";

// Resumen del panel: notas por estado, borradores pendientes, consultas del asistente, tendencia de lecturas, suscriptores y notas más leídas.
export default async function PanelHome() {
  const [session, byStatus, pendingDrafts, queries7d, week, trend, top] = await Promise.all([
    auth(),
    db.select({ status: articles.status, n: sql<number>`count(*)::int` }).from(articles).groupBy(articles.status),
    db.select({ n: sql<number>`count(*)::int` }).from(agentDrafts).where(sql`${agentDrafts.status} = 'pendiente'`),
    db.select({ n: sql<number>`count(*)::int` }).from(assistantQueries).where(sql`${assistantQueries.createdAt} > now() - interval '7 days'`),
    siteWeekTotals(),
    siteDailySeries(7),
    db
      .select({ id: articles.id, slug: articles.slug, title: articles.title, views: articles.views })
      .from(articles)
      .where(sql`${articles.status} = 'publicado' and ${articles.publishedAt} > now() - interval '30 days'`)
      .orderBy(sql`${articles.views} desc`)
      .limit(5),
  ]);

  const st = Object.fromEntries(byStatus.map((r) => [r.status, r.n])) as Record<string, number>;
  const change = week ? pctChange(week.last7, week.prev7) : null;
  const parts = [
    { label: "Publicados", value: st["publicado"] ?? 0, color: "var(--accent-2)", icon: <BadgeCheck size={16} /> },
    { label: "En revisión", value: st["en_revision"] ?? 0, color: "var(--accent)", icon: <ScanSearch size={16} /> },
    { label: "Programados", value: st["programado"] ?? 0, color: "var(--link)", icon: <CalendarClock size={16} /> },
    { label: "Borradores", value: st["borrador"] ?? 0, color: "var(--fg-muted)", icon: <FileEdit size={16} /> },
  ];
  const total = parts.reduce((s, p) => s + p.value, 0);
  // Etiqueta de cada día: «lun 05».
  const diaCorto = new Intl.DateTimeFormat("es-CO", { weekday: "short", timeZone: "UTC" });
  const labels = trend.days.map((d) => `${diaCorto.format(new Date(`${d}T12:00:00Z`)).replace(".", "")} ${d.slice(-2)}`);
  const maxViews = Math.max(1, ...top.map((a) => a.views));
  const totalViews7 = trend.views.reduce((s, v) => s + v, 0);
  const promedio = trend.views.length ? Math.round(totalViews7 / trend.views.length) : 0;
  const mejorDia = trend.views.indexOf(Math.max(...trend.views));
  // Saludo según la hora de Colombia.
  const hora = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/Bogota" }).format(new Date())) % 24;
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
  const nombre = session?.user?.name?.split(" ")[0] ?? "";
  // El análisis (audiencia y suscriptores) comparte esta opción del menú y se ve solo con su permiso.
  const verAnalitica = session?.user ? await tienePermiso(session.user.id, session.user.role, "analitica") : false;
  const fecha = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Bogota" }).format(new Date());
  const enRevision = st["en_revision"] ?? 0;
  const borradoresIA = pendingDrafts[0]?.n ?? 0;
  // Lo que espera una acción del equipo: se muestra arriba solo si hay algo.
  const atencion = [
    { n: enRevision, texto: enRevision === 1 ? "nota espera revisión" : "notas esperan revisión", href: "/panel/articulos?estado=en_revision", icon: <ScanSearch size={18} aria-hidden /> },
    { n: borradoresIA, texto: borradoresIA === 1 ? "borrador de IA por aprobar" : "borradores de IA por aprobar", href: "/panel/borradores-ia", icon: <Bot size={18} aria-hidden /> },
  ].filter((a) => a.n > 0);

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <TabsResumen activa="resumen" analitica={verAnalitica} />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="lx-kicker text-[var(--accent)] first-letter:uppercase">{fecha}</p>
          <h1 className="lx-display mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            {saludo}{nombre ? `, ${nombre}` : ""}
          </h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">Así va el sitio hoy: lecturas, estado de las notas y de dónde llegan tus suscriptores.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/panel/articulos/nuevo?modo=ia" className="lx-btn lx-btn-ghost">
            <Sparkles size={16} aria-hidden /> Nota con IA
          </Link>
          <Link href="/panel/articulos/nuevo?modo=manual" className="lx-btn">
            Nueva nota <ArrowUpRight size={16} aria-hidden />
          </Link>
        </div>
      </header>

      {atencion.length > 0 && (
        <section aria-label="Pendientes" className="flex flex-wrap gap-3">
          {atencion.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="group flex min-w-0 flex-1 basis-64 items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--accent)]/35 bg-[var(--accent)]/8 px-4 py-3 transition hover:border-[var(--accent)] hover:bg-[var(--accent)]/12"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)]">{a.icon}</span>
              <span className="min-w-0 flex-1 text-sm"><strong className="lx-display mr-1 text-xl tabular-nums">{a.n}</strong>{a.texto}</span>
              <ChevronRight size={18} aria-hidden className="shrink-0 text-[var(--accent)] transition group-hover:translate-x-0.5" />
            </Link>
          ))}
        </section>
      )}

      {/* Fila de indicadores: tarjeta oscura destacada + 3 claras (como un cuadro de mando) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative overflow-hidden rounded-[var(--radius-lg)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_70%,#000),var(--accent)_65%,color-mix(in_srgb,var(--accent)_75%,#fff))] p-5 text-white shadow-[var(--shadow)] sm:col-span-2 xl:col-span-1">
          <span aria-hidden className="absolute -right-8 -top-10 size-36 rounded-full bg-white/10 blur-2xl" />
          <div className="flex items-center justify-between">
            <p className="lx-kicker text-white/70">Lecturas · 7 días</p>
            <Eye size={18} className="text-white/70" aria-hidden />
          </div>
          <p className="lx-display mt-3 text-5xl font-semibold tabular-nums">{nf.format(week?.last7 ?? 0)}</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            {change !== null ? (
              <p className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
                {change > 0 ? <ArrowUp size={13} /> : change < 0 ? <ArrowDown size={13} /> : <Minus size={13} />}
                {Math.abs(change)}% vs. semana previa
              </p>
            ) : <span />}
            <Spark values={trend.views} />
          </div>
        </div>
        {parts.slice(0, 3).map((p) => (
          <Kpi key={p.label} label={p.label} value={p.value} total={total} color={p.color} icon={p.icon} href={`/panel/articulos?estado=${ESTADO_URL[p.label]}`} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-3">
        <Card className="lx-shine min-w-0 p-5 sm:p-6 lg:col-span-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="lx-kicker text-[var(--fg-muted)]">Tendencia</p>
              <h2 className="lx-display mt-1 text-xl font-semibold">Lecturas por día</h2>
            </div>
            <span className="text-xs text-[var(--fg-muted)]">Últimos 7 días</span>
          </div>
          <dl className="mt-3 flex flex-wrap gap-2 text-xs">
            {[
              ["Total", nf.format(totalViews7)],
              ["Promedio diario", nf.format(promedio)],
              ["Mejor día", totalViews7 > 0 && mejorDia >= 0 ? `${labels[mejorDia]} · ${nf.format(trend.views[mejorDia])}` : "—"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-full bg-[var(--surface-2)] px-3 py-1.5">
                <dt className="inline text-[var(--fg-muted)]">{k}: </dt>
                <dd className="inline font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4">
            <AreaChart labels={labels} values={trend.views} />
          </div>
        </Card>

        <Card className="lx-shine p-5 sm:p-6">
          <p className="lx-kicker text-[var(--fg-muted)]">Contenido</p>
          <h2 className="lx-display mt-1 text-xl font-semibold">Estado de las notas</h2>
          <div className="mt-4"><Donut parts={parts} total={total} label="Notas" /></div>
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            {parts.map((p) => (
              <li key={p.label}>
                <Link href={`/panel/articulos?estado=${ESTADO_URL[p.label]}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition hover:bg-[var(--surface-2)]">
                  <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: p.color }} aria-hidden />{p.label}</span>
                  <span className="font-semibold tabular-nums">{p.value}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-3">
        <Card className="lx-shine min-w-0 p-5 sm:p-6 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="lx-kicker text-[var(--fg-muted)]">Últimos 30 días</p>
              <h2 className="lx-display mt-1 text-xl font-semibold">Notas más leídas</h2>
            </div>
            <Link href="/panel/articulos?orden=lecturas" className="lx-link inline-flex items-center gap-1.5 text-xs font-semibold"><Newspaper size={15} aria-hidden /> Ver todas</Link>
          </div>
          <ol className="mt-4 flex flex-col gap-1">
            {top.length === 0 && <li className="text-sm text-[var(--fg-muted)]">Aún no hay lecturas registradas.</li>}
            {top.map((a, i) => (
              <li key={a.slug} className="min-w-0">
                <div className="group flex items-center gap-3 rounded-[var(--radius)] px-2 py-2 transition hover:bg-[var(--surface-2)]">
                  <span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums ${i === 0 ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "bg-[var(--surface-2)] text-[var(--fg-muted)]"}`}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/panel/articulos/${a.id}`} className="block truncate text-sm font-medium group-hover:text-[var(--accent)]" title="Abrir en el editor">{a.title}</Link>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)] group-hover:bg-[var(--border)]">
                      <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-2))]" style={{ width: `${Math.max(4, (a.views / maxViews) * 100)}%` }} />
                    </div>
                  </div>
                  <span className="shrink-0 text-right text-sm font-semibold tabular-nums">{nf.format(a.views)}<span className="block text-[0.65rem] font-normal text-[var(--fg-muted)]">lecturas</span></span>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <div className="flex flex-col gap-5 sm:gap-6">
          <Highlight label="Borradores de IA por aprobar" value={pendingDrafts[0]?.n ?? 0} href="/panel/borradores-ia" cta="Revisar cola" icon={<Bot size={20} />} />
          <Highlight label="Preguntas al asistente (7 días)" value={queries7d[0]?.n ?? 0} href="/panel/demanda" cta="Ver demanda" icon={<MessagesSquare size={20} />} />
        </div>
      </div>
    </div>
  );
}

// Indicador con su valor, su proporción y su color; lleva a la lista de notas de ese estado.
function Kpi({ label, value, total, color, icon, href }: { label: string; value: number; total: number; color: string; icon: React.ReactNode; href: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <Link href={href} className="group block rounded-[var(--radius-lg)] focus-visible:outline-2 focus-visible:outline-offset-2" aria-label={`${label}: ${value}. Ver la lista`}>
      <Card className="lx-shine h-full p-5 transition group-hover:border-[var(--border-strong)]">
        <div className="flex items-center justify-between gap-2">
          <p className="lx-kicker text-[var(--fg-muted)]">{label}</p>
          <span className="grid size-9 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>{icon}</span>
        </div>
        <p className="lx-display mt-3 text-4xl font-semibold tabular-nums">{value}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]" aria-hidden>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
        </div>
        <p className="mt-1.5 flex items-center justify-between text-xs text-[var(--fg-muted)]">
          <span>{pct}% del total</span>
          <span className="inline-flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">Ver <ChevronRight size={12} aria-hidden /></span>
        </p>
      </Card>
    </Link>
  );
}

// Mini línea de tendencia (SVG puro) para la tarjeta destacada.
function Spark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const W = 96;
  const H = 32;
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * W},${H - 3 - (v / max) * (H - 6)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-8 w-24 shrink-0" aria-hidden>
      <polyline points={pts} fill="none" stroke="white" strokeOpacity="0.85" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Dato destacado con su etiqueta y su valor.
function Highlight({
  label,
  value,
  href,
  cta,
  icon,
}: {
  label: string;
  value: number;
  href: string;
  cta: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="lx-shine group p-6">
      <div className="flex items-center gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
          {icon}
        </span>
        <p className="lx-kicker text-[var(--fg-muted)]">{label}</p>
      </div>
      <p className="lx-display mt-3 text-5xl font-semibold tabular-nums text-[var(--accent)]">
        {value}
      </p>
      <Link href={href} className="lx-link mt-4 inline-flex items-center gap-2 text-sm">
        {cta}
        <span aria-hidden className="transition-transform duration-500 group-hover:translate-x-1">
          →
        </span>
      </Link>
    </Card>
  );
}
