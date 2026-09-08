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
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Resumen editorial</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Publicados" value={statusMap["publicado"] ?? 0} />
        <Stat label="En revisión" value={statusMap["en_revision"] ?? 0} />
        <Stat label="Programados" value={statusMap["programado"] ?? 0} />
        <Stat label="Borradores" value={statusMap["borrador"] ?? 0} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-[var(--fg-muted)]">Borradores de IA pendientes de aprobación</p>
          <p className="mt-1 text-3xl font-bold">{pendingDrafts[0]?.n ?? 0}</p>
          <Link href="/panel/borradores-ia" className="mt-2 inline-block text-sm text-[var(--link)] underline">
            Revisar cola →
          </Link>
        </Card>
        <Card>
          <p className="text-sm text-[var(--fg-muted)]">Preguntas al asistente (7 días)</p>
          <p className="mt-1 text-3xl font-bold">{queries7d[0]?.n ?? 0}</p>
          <Link href="/panel/demanda" className="mt-2 inline-block text-sm text-[var(--link)] underline">
            Ver demanda informativa →
          </Link>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-sm text-[var(--fg-muted)]">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </Card>
  );
}
