import Link from "next/link";
import { sql } from "drizzle-orm";
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Bot,
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
import { ViewsBarChart } from "@/components/panel/views-chart";
import { SubscriberMap } from "@/components/panel/subscriber-map";
import { subscriberPoints as loadSubscriberPoints } from "@/lib/subscriber-map";

export const dynamic = "force-dynamic";

export default async function PanelHome() {
  const [byStatus, pendingDrafts, queries7d, week, trend, subscriberPoints] = await Promise.all([
    db
      .select({ status: articles.status, n: sql<number>`count(*)::int` })
      .from(articles)
      .groupBy(articles.status),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(agentDrafts)
      .where(sql`${agentDrafts.status} = 'pendiente'`),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(assistantQueries)
      .where(sql`${assistantQueries.createdAt} > now() - interval '7 days'`),
    siteWeekTotals(),
    siteDailySeries(7),
    loadSubscriberPoints(),
  ]);

  const statusMap = Object.fromEntries(byStatus.map((r) => [r.status, r.n]));
  const change = week ? pctChange(week.last7, week.prev7) : null;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="lx-kicker text-[var(--accent)]">Panel editorial</p>
        <h1 className="lx-display mt-2 text-3xl font-semibold tracking-tight">Resumen editorial</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Publicados"
          value={statusMap["publicado"] ?? 0}
          icon={<BadgeCheck size={18} />}
          tint="var(--accent-2)"
        />
        <Stat
          label="En revisión"
          value={statusMap["en_revision"] ?? 0}
          icon={<ScanSearch size={18} />}
          tint="var(--accent)"
        />
        <Stat
          label="Programados"
          value={statusMap["programado"] ?? 0}
          icon={<CalendarClock size={18} />}
          tint="var(--link)"
        />
        <Stat
          label="Borradores"
          value={statusMap["borrador"] ?? 0}
          icon={<FileEdit size={18} />}
          tint="var(--fg-muted)"
        />
      </div>

      {week && (
        <Card className="lx-shine p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="lx-kicker text-[var(--fg-muted)]">Lecturas · últimos 7 días</p>
              <p className="lx-display mt-2 text-4xl font-semibold tabular-nums">{nf.format(week.last7)}</p>
            </div>
            {change !== null && (
              <span
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${
                  change > 0
                    ? "bg-[var(--accent-2)]/15 text-[var(--accent-2)]"
                    : change < 0
                      ? "bg-[var(--danger)]/15 text-[var(--danger)]"
                      : "bg-[var(--surface-2)] text-[var(--fg-muted)]"
                }`}
              >
                {change > 0 ? <ArrowUp size={14} /> : change < 0 ? <ArrowDown size={14} /> : <Minus size={14} />}
                {Math.abs(change)}% vs. los 7 días anteriores
              </span>
            )}
          </div>
          <div className="mt-6">
            <ViewsBarChart days={trend.days} values={trend.views} />
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Highlight
          label="Borradores de IA pendientes de aprobación"
          value={pendingDrafts[0]?.n ?? 0}
          href="/panel/borradores-ia"
          cta="Revisar cola"
          icon={<Bot size={20} />}
        />
        <Highlight
          label="Preguntas al asistente (7 días)"
          value={queries7d[0]?.n ?? 0}
          href="/panel/demanda"
          cta="Ver demanda informativa"
          icon={<MessagesSquare size={20} />}
        />
      </div>

      <Card className="lx-shine p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="lx-kicker text-[var(--fg-muted)]">Suscriptores del boletín · de dónde se dan de alta</p>
          <Link href="/panel/newsletter?tab=suscriptores" className="lx-link text-xs">
            Ver suscriptores →
          </Link>
        </div>
        <div className="mt-4">
          <SubscriberMap points={subscriberPoints} />
        </div>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tint: string;
}) {
  return (
    <Card className="lx-shine relative overflow-hidden p-6">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: tint }} />
      <div className="flex items-center gap-2">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-full"
          style={{ background: `color-mix(in srgb, ${tint} 15%, transparent)`, color: tint }}
        >
          {icon}
        </span>
        <p className="lx-kicker text-[var(--fg-muted)]">{label}</p>
      </div>
      <p className="lx-display mt-3 text-4xl font-semibold tabular-nums">{value}</p>
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
