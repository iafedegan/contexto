import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { assistantQueries, siteSettings } from "@/db/schema";

/**
 * Control de consumo del asistente conversacional.
 *  - Tope de consultas por sesión de usuario.
 *  - Presupuesto mensual en USD. Al superarlo el asistente degrada a búsqueda
 *    semántica sin generación (modo "semantico_degradado"). Nunca cae el portal.
 *
 * Precio aproximado (Claude Sonnet, USD por 1M tokens). Ajustar si cambia.
 */
const PRICE = { inputPerM: 3, outputPerM: 15 };

// Coste estimado en dólares de una consulta según sus tokens de entrada y de salida.
export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * PRICE.inputPerM +
    (outputTokens / 1_000_000) * PRICE.outputPerM
  );
}

/**
 * Límites del asistente público. Los edita un administrador en Configuración →
 * Asistente (se guardan en `site_settings`); las variables de entorno solo
 * sirven de valor inicial mientras nadie los haya cambiado.
 */
export const LIMITES_KEY = "assistant_limits";
// Límites de uso del asistente: presupuesto mensual y tope de consultas por sesión.
export type LimitesAsistente = { presupuestoMensualUsd: number; topePorSesion: number };

// Límites vigentes: lo que guardó un administrador o, si no hay nada, los valores del entorno ya validados.
export async function getLimites(): Promise<LimitesAsistente> {
  // Un valor no numérico en el entorno daría NaN, y `gasto >= NaN` nunca es verdadero: el tope quedaría
  // desactivado sin avisar. Se valida y, si no sirve, se usa el valor por defecto.
  const numero = (valor: string | undefined, defecto: number) => {
    const n = Number(valor);
    return valor?.trim() && Number.isFinite(n) && n >= 0 ? n : defecto;
  };
  const porDefecto = {
    presupuestoMensualUsd: numero(process.env.ASSISTANT_MONTHLY_BUDGET_USD, 150),
    topePorSesion: numero(process.env.ASSISTANT_SESSION_QUERY_LIMIT, 15),
  };
  try {
    const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, LIMITES_KEY)).limit(1);
    const v = (row?.value ?? {}) as Partial<LimitesAsistente>;
    return {
      presupuestoMensualUsd: typeof v.presupuestoMensualUsd === "number" ? v.presupuestoMensualUsd : porDefecto.presupuestoMensualUsd,
      topePorSesion: typeof v.topePorSesion === "number" ? v.topePorSesion : porDefecto.topePorSesion,
    };
  } catch {
    return porDefecto;
  }
}

// Resultado de comprobar el presupuesto: si se puede generar, el motivo si no, y el consumo actual.
export type BudgetState = {
  allowGeneration: boolean;
  reason: "ok" | "presupuesto_mensual" | "limite_sesion";
  monthSpendUsd: number;
  sessionCount: number;
};

// Comprueba el gasto del mes y las consultas del día de la sesión para decidir si el asistente puede generar una respuesta.
export async function checkBudget(sessionId: string): Promise<BudgetState> {
  const { presupuestoMensualUsd: MONTHLY_BUDGET, topePorSesion: SESSION_LIMIT } = await getLimites();
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

// Inicio del día actual en UTC.
function startOfDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
