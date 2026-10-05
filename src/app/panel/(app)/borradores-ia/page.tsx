import { requirePermiso } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import { db } from "@/db";
import { agentDrafts } from "@/db/schema";
import { Badge, Button, Card } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { DEMO_SOURCES } from "@/agents/sources";
import { approveDraft, rejectDraft, runAgentOnDemoSource } from "./actions";

// Se calcula en cada petición, nunca durante la compilación.
export const dynamic = "force-dynamic";

// Modo en que trabajan los agentes: con IA si hay clave, o simulación por plantilla.
const AGENT_MODE = process.env.ANTHROPIC_API_KEY ? "IA (Claude)" : "simulación por plantilla";

// Cola de borradores de IA pendientes de aprobar o rechazar (exige el permiso «borradores_ia»).
export default async function DraftsQueue() {
  await requirePermiso("borradores_ia");
  const rows = await db
    .select()
    .from(agentDrafts)
    .where(eq(agentDrafts.status, "pendiente"))
    .orderBy(desc(agentDrafts.createdAt))
    .limit(50);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Borradores de IA — cola de aprobación</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          Ningún contenido generado por agentes se publica sin aprobación humana registrada. Al
          aprobar se crea un artículo en borrador atribuido a ti; la publicación es un paso aparte.
        </p>
      </div>

      <Card className="flex flex-col gap-3 border-dashed">
        <div>
          <p className="text-sm font-semibold">Ejecutar el agente sobre una fuente</p>
          <p className="text-xs text-[var(--fg-muted)]">
            Fuentes estructuradas de demostración (en producción llegan de SIPSA, salas de prensa,
            ICA, agenda sectorial). El agente redacta un borrador y lo pasa por el verificador de
            cifras. Modo actual: <strong>{AGENT_MODE}</strong>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {DEMO_SOURCES.map((s) => (
            <form key={s.key} action={runAgentOnDemoSource}>
              <input type="hidden" name="sourceKey" value={s.key} />
              <Button variant="outline" type="submit" title={s.description}>
                + {s.label}
              </Button>
            </form>
          ))}
        </div>
      </Card>

      {rows.length === 0 && <p className="text-[var(--fg-muted)]">No hay borradores pendientes.</p>}

      {rows.map((d) => (
        <Card key={d.id} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{d.source}</Badge>
            <span className="text-xs text-[var(--fg-muted)]">{formatDate(d.createdAt)}</span>
            <span className="text-xs text-[var(--fg-muted)]">· modelo {d.modelVersion}</span>
            {d.hasUnverifiedClaims && (
              <span className="text-xs font-semibold text-[var(--danger)]">
                ⚠ contiene datos sin verificar
              </span>
            )}
          </div>

          <h2 className="text-lg font-bold">{d.title}</h2>
          <p className="text-sm text-[var(--fg-muted)]">{d.excerpt}</p>
          <p className="text-xs">
            Fuente: <span className="text-[var(--link)]">{d.sourceRef}</span>
          </p>

          <details className="text-sm">
            <summary className="cursor-pointer font-medium">Ver cuerpo y verificación</summary>
            <div
              className="prose prose-sm mt-2 max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(d.body) }}
            />
            <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[30rem] text-xs [&_td]:px-2 [&_td]:py-1.5 [&_th]:px-2 [&_th]:py-1.5">
              <thead className="text-left text-[var(--fg-muted)]">
                <tr>
                  <th>Afirmación</th>
                  <th>Valor</th>
                  <th>¿Verificada?</th>
                  <th>Cita de la fuente</th>
                </tr>
              </thead>
              <tbody>
                {d.factChecks.map((c, i) => (
                  <tr key={i} className="border-t border-[var(--border)]">
                    <td>{c.claim}</td>
                    <td>{c.value}</td>
                    <td className={c.verified ? "text-[var(--brand)]" : "text-[var(--danger)]"}>
                      {c.verified ? "sí" : "no"}
                    </td>
                    <td className="text-[var(--fg-muted)]">{c.sourceQuote ?? c.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </details>

          <div className="flex flex-wrap items-end gap-3">
            <form action={approveDraft.bind(null, d.id)}>
              <Button type="submit">Aprobar → crear borrador</Button>
            </form>
            <form action={rejectDraft} className="flex min-w-0 flex-wrap items-end gap-2">
              <input type="hidden" name="draftId" value={d.id} />
              <label className="min-w-0 flex-1 text-xs">
                Motivo de rechazo
                <input
                  name="reason"
                  className="ml-0 mt-1 block w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
                />
              </label>
              <Button variant="danger" type="submit">
                Rechazar
              </Button>
            </form>
          </div>
        </Card>
      ))}
    </div>
  );
}
