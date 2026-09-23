import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { agentDrafts, articles, assistantQueries } from "@/db/schema";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PanelHome() {
  const [byStatus, pendingDrafts, queries7d] = await Promise.all([
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
  ]);

  const statusMap = Object.fromEntries(byStatus.map((r) => [r.status, r.n]));

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="lx-kicker text-[var(--accent)]">Panel editorial</p>
        <h1 className="lx-display mt-2 text-3xl font-semibold tracking-tight">Resumen editorial</h1>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Publicados" value={statusMap["publicado"] ?? 0} />
        <Stat label="En revisión" value={statusMap["en_revision"] ?? 0} />
        <Stat label="Programados" value={statusMap["programado"] ?? 0} />
        <Stat label="Borradores" value={statusMap["borrador"] ?? 0} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Highlight
          label="Borradores de IA pendientes de aprobación"
          value={pendingDrafts[0]?.n ?? 0}
          href="/panel/borradores-ia"
          cta="Revisar cola"
        />
        <Highlight
          label="Preguntas al asistente (7 días)"
          value={queries7d[0]?.n ?? 0}
          href="/panel/demanda"
          cta="Ver demanda informativa"
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="lx-shine p-6">
      <p className="lx-kicker text-[var(--fg-muted)]">{label}</p>
      <p className="lx-display mt-3 text-4xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

function Highlight({
  label,
  value,
  href,
  cta,
}: {
  label: string;
  value: number;
  href: string;
  cta: string;
}) {
  return (
    <Card className="lx-shine group p-6">
      <p className="lx-kicker text-[var(--fg-muted)]">{label}</p>
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
