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
} from "lucide-react";
import { db } from "@/db";
import { agentDrafts, articles, assistantQueries } from "@/db/schema";
import { Card } from "@/components/ui";
import { nf, pctChange, siteDailySeries, siteWeekTotals } from "@/lib/article-stats";
import { AreaChart, Donut } from "@/components/panel/dash-charts";
import { SubscriberMap } from "@/components/panel/subscriber-map";
import { subscriberPoints as loadSubscriberPoints } from "@/lib/subscriber-map";

export const dynamic = "force-dynamic";

export default async function PanelHome() {
  const [byStatus, pendingDrafts, queries7d, week, trend, subscriberPoints, top] = await Promise.all([
    db.select({ status: articles.status, n: sql<number>`count(*)::int` }).from(articles).groupBy(articles.status),
    db.select({ n: sql<number>`count(*)::int` }).from(agentDrafts).where(sql`${agentDrafts.status} = 'pendiente'`),
    db.select({ n: sql<number>`count(*)::int` }).from(assistantQueries).where(sql`${assistantQueries.createdAt} > now() - interval '7 days'`),
    siteWeekTotals(),
    siteDailySeries(7),
    loadSubscriberPoints(),
    db
      .select({ slug: articles.slug, title: articles.title, views: articles.views })
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
  const labels = trend.days.map((d) => d.slice(-2));
  const maxViews = Math.max(1, ...top.map((a) => a.views));

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="lx-kicker text-[var(--accent)]">Panel editorial</p>
          <h1 className="lx-display mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Resumen editorial</h1>
        </div>
        <Link href="/panel/articulos" className="lx-btn">Nueva nota <ArrowUpRight size={16} aria-hidden /></Link>
      </header>

      {/* Fila de indicadores: tarjeta oscura destacada + 3 claras (como un cuadro de mando) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative overflow-hidden rounded-[var(--radius-lg)] bg-[linear-gradient(135deg,#1f2d12,#3a4d1c_60%,#55702a)] p-5 text-white shadow-[var(--shadow)] sm:col-span-2 xl:col-span-1">
          <span aria-hidden className="absolute -right-8 -top-10 size-36 rounded-full bg-white/10 blur-2xl" />
          <div className="flex items-center justify-between">
            <p className="lx-kicker text-white/70">Lecturas · 7 días</p>
            <Eye size={18} className="text-white/70" aria-hidden />
          </div>
          <p className="lx-display mt-3 text-5xl font-semibold tabular-nums">{nf.format(week?.last7 ?? 0)}</p>
          {change !== null && (
            <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
              {change > 0 ? <ArrowUp size={13} /> : change < 0 ? <ArrowDown size={13} /> : <Minus size={13} />}
              {Math.abs(change)}% vs. 7 días previos
            </p>
          )}
        </div>
        {parts.slice(0, 3).map((p) => (
          <Kpi key={p.label} label={p.label} value={p.value} total={total} color={p.color} icon={p.icon} />
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
              <li key={p.label} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: p.color }} aria-hidden />{p.label}</span>
                <span className="font-semibold tabular-nums">{p.value}</span>
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
            <Newspaper size={20} className="text-[var(--accent)]" aria-hidden />
          </div>
          <ol className="mt-4 flex flex-col gap-3">
            {top.length === 0 && <li className="text-sm text-[var(--fg-muted)]">Aún no hay lecturas registradas.</li>}
            {top.map((a, i) => (
              <li key={a.slug} className="min-w-0">
                <div className="flex items-baseline gap-3">
                  <span className="lx-display w-6 shrink-0 text-lg text-[var(--accent)] tabular-nums">{i + 1}</span>
                  <Link href={`/articulo/${a.slug}`} className="lx-link min-w-0 flex-1 truncate text-sm font-medium">{a.title}</Link>
                  <span className="shrink-0 text-xs tabular-nums text-[var(--fg-muted)]">{nf.format(a.views)}</span>
                </div>
                <div className="ml-9 mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(4, ((a.views) / maxViews) * 100)}%` }} />
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

      <Card className="lx-shine p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="lx-kicker text-[var(--fg-muted)]">Suscriptores del boletín · de dónde se dan de alta</p>
          <Link href="/panel/newsletter?tab=suscriptores" className="lx-link text-xs">Ver suscriptores →</Link>
        </div>
        <div className="mt-4"><SubscriberMap points={subscriberPoints} /></div>
      </Card>
    </div>
  );
}

function Kpi({ label, value, total, color, icon }: { label: string; value: number; total: number; color: string; icon: React.ReactNode }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <Card className="lx-shine p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="lx-kicker text-[var(--fg-muted)]">{label}</p>
        <span className="grid size-9 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>{icon}</span>
      </div>
      <p className="lx-display mt-3 text-4xl font-semibold tabular-nums">{value}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]" aria-hidden>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className="mt-1.5 text-xs text-[var(--fg-muted)]">{pct}% del total</p>
    </Card>
  );
}

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
