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

  const s = Object.fromEntries(byStatus.map((r) => [r.status, r.n]));

  return (
    <div className="rise flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-[-0.02em]">Resumen editorial</h1>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">Estado de la redacción de un vistazo.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Publicados" value={s["publicado"] ?? 0} accent />
        <Stat label="En revisión" value={s["en_revision"] ?? 0} />
        <Stat label="Programados" value={s["programado"] ?? 0} />
        <Stat label="Borradores" value={s["borrador"] ?? 0} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ActionCard
          label="Borradores de IA pendientes"
          value={pendingDrafts[0]?.n ?? 0}
          href="/panel/borradores-ia"
          cta="Revisar cola"
        />
        <ActionCard
          label="Preguntas al asistente · 7 días"
          value={queries7d[0]?.n ?? 0}
          href="/panel/demanda"
          cta="Ver demanda informativa"
        />
      </div>
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card className={accent ? "border-[var(--brand)] bg-[var(--brand-tint)]" : ""}>
      <p className="text-[13px] font-medium text-[var(--ink-soft)]">{label}</p>
      <p className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums text-[var(--ink)]">
        {value}
      </p>
    </Card>
  );
}

function ActionCard({
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
    <Card className="flex flex-col">
      <p className="text-sm text-[var(--ink-soft)]">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums">{value}</p>
      <Link
        href={href}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] hover:gap-2.5"
      >
        {cta} <span aria-hidden>→</span>
      </Link>
    </Card>
  );
}
