import { sql } from "drizzle-orm";
import { db } from "@/db";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Tablero de demanda informativa. El log de preguntas al asistente alimenta a la
 * redacción: qué buscan los lectores, qué no encuentra el archivo.
 */
export default async function DemandaPage() {
  const [top, unanswered, byDay, modes] = await Promise.all([
    db.execute(sql`
      SELECT lower(question) AS q, count(*)::int AS n
      FROM assistant_queries
      WHERE created_at > now() - interval '30 days'
      GROUP BY lower(question) ORDER BY n DESC LIMIT 25`),
    db.execute(sql`
      SELECT question, created_at
      FROM assistant_queries
      WHERE answered = false AND created_at > now() - interval '30 days'
      ORDER BY created_at DESC LIMIT 25`),
    db.execute(sql`
      SELECT date_trunc('day', created_at)::date AS day, count(*)::int AS n
      FROM assistant_queries
      WHERE created_at > now() - interval '30 days'
      GROUP BY day ORDER BY day`),
    db.execute(sql`
      SELECT mode, count(*)::int AS n, coalesce(sum(cost_usd),0)::float AS cost
      FROM assistant_queries
      WHERE created_at > now() - interval '30 days'
      GROUP BY mode`),
  ]);

  const rows = <T,>(r: unknown) => r as unknown as T[];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Demanda informativa (30 días)</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        {rows<{ mode: string; n: number; cost: number }>(modes).map((m) => (
          <Card key={m.mode}>
            <p className="text-sm text-[var(--fg-muted)]">{m.mode}</p>
            <p className="text-2xl font-bold">{m.n}</p>
            <p className="text-xs text-[var(--fg-muted)]">${m.cost.toFixed(2)} en LLM</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-semibold">Preguntas más frecuentes</h2>
          <ol className="flex flex-col gap-1 text-sm">
            {rows<{ q: string; n: number }>(top).map((r, i) => (
              <li key={i} className="flex justify-between gap-4">
                <span className="truncate">{r.q}</span>
                <span className="text-[var(--fg-muted)]">{r.n}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold">Sin respuesta (oportunidades de cobertura)</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {rows<{ question: string }>(unanswered).map((r, i) => (
              <li key={i} className="truncate text-[var(--danger)]">
                {r.question}
              </li>
            ))}
            {rows<unknown>(unanswered).length === 0 && (
              <li className="text-[var(--fg-muted)]">Todas las consultas encontraron fuentes.</li>
            )}
          </ul>
        </Card>
      </div>

      <Card>
        <h2 className="mb-2 font-semibold">Volumen diario</h2>
        <div className="flex items-end gap-1" style={{ height: 120 }}>
          {rows<{ day: string; n: number }>(byDay).map((d) => {
            const max = Math.max(...rows<{ n: number }>(byDay).map((x) => x.n), 1);
            return (
              <div
                key={d.day}
                title={`${d.day}: ${d.n}`}
                className="flex-1 bg-[var(--brand)]"
                style={{ height: `${(d.n / max) * 100}%` }}
              />
            );
          })}
        </div>
      </Card>
    </div>
  );
}
