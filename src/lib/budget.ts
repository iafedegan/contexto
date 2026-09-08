import "server-only";
import { and, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { assistantQueries } from "@/db/schema";

/**
 * Control de consumo del asistente conversacional.
 *  - Tope de consultas por sesión de usuario.
 *  - Presupuesto mensual en USD. Al superarlo el asistente degrada a búsqueda
 *    semántica sin generación (modo "semantico_degradado"). Nunca cae el portal.
 *
 * Precio aproximado (Claude Sonnet, USD por 1M tokens). Ajustar si cambia.
 */
const PRICE = { inputPerM: 3, outputPerM: 15 };

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * PRICE.inputPerM +
    (outputTokens / 1_000_000) * PRICE.outputPerM
  );
}

const MONTHLY_BUDGET = Number(process.env.ASSISTANT_MONTHLY_BUDGET_USD ?? "150");
const SESSION_LIMIT = Number(process.env.ASSISTANT_SESSION_QUERY_LIMIT ?? "15");

export type BudgetState = {
  allowGeneration: boolean;
  reason: "ok" | "presupuesto_mensual" | "limite_sesion";
  monthSpendUsd: number;
  sessionCount: number;
};

export async function checkBudget(sessionId: string): Promise<BudgetState> {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const [agg] = await db
    .select({
      monthSpend: sql<string>`coalesce(sum(${assistantQueries.costUsd}), 0)`,
    })
    .from(assistantQueries)
    .where(gte(assistantQueries.createdAt, startOfMonth));

  const [sess] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(assistantQueries)
    .where(
      and(
        gte(assistantQueries.createdAt, startOfDay()),
        sql`${assistantQueries.sessionId} = ${sessionId}`,
      ),
    );

  const monthSpendUsd = Number(agg?.monthSpend ?? 0);
  const sessionCount = Number(sess?.n ?? 0);

  if (monthSpendUsd >= MONTHLY_BUDGET) {
    return { allowGeneration: false, reason: "presupuesto_mensual", monthSpendUsd, sessionCount };
  }
  if (sessionCount >= SESSION_LIMIT) {
    return { allowGeneration: false, reason: "limite_sesion", monthSpendUsd, sessionCount };
  }
  return { allowGeneration: true, reason: "ok", monthSpendUsd, sessionCount };
}

function startOfDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
