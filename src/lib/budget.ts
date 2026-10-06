import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { assistantQueries, siteSettings } from "@/db/schema";
import { firmar, igualesSeguro } from "@/lib/claves";

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
export type LimitesAsistente = { presupuestoMensualUsd: number; topePorSesion: number; topeBorradoresDia: number };

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
    // Tope diario de borradores de los agentes de IA (la propuesta §6.3 exige un límite de volumen configurable).
    topeBorradoresDia: numero(process.env.AGENT_DAILY_DRAFT_LIMIT, 20),
  };
  try {
    const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, LIMITES_KEY)).limit(1);
    const v = (row?.value ?? {}) as Partial<LimitesAsistente>;
    return {
      presupuestoMensualUsd: typeof v.presupuestoMensualUsd === "number" ? v.presupuestoMensualUsd : porDefecto.presupuestoMensualUsd,
      topePorSesion: typeof v.topePorSesion === "number" ? v.topePorSesion : porDefecto.topePorSesion,
      topeBorradoresDia: typeof v.topeBorradoresDia === "number" ? v.topeBorradoresDia : porDefecto.topeBorradoresDia,
    };
  } catch {
    return porDefecto;
  }
}

/** Cookie con la sesión del asistente: la emite el servidor, firmada. Antes la inventaba el navegador y cambiarla evadía el tope por sesión. */
export const SESION_ASISTENTE_COOKIE = "contexto.asistente";

/**
 * Sesión del asistente a partir de la cookie. Si falta o su firma no vale (la cambiaron a mano), se crea una nueva y
 * `nueva` es verdadero: quien responde debe enviar `valor` como cookie. Una persona puede descartar sus cookies para
 * obtener otra sesión, así que el freno real al gasto no es este tope sino el de cada IP (ver la ruta) y el presupuesto mensual.
 */
export function sesionAsistente(cookie: string | undefined): { id: string; nueva: boolean; valor: string } {
  const [id, firma] = (cookie ?? "").split(".");
  if (id && firma && /^[0-9a-f-]{36}$/.test(id)) {
    try {
      if (igualesSeguro(firma, firmar("sesion-asistente", id).slice(0, 22))) return { id, nueva: false, valor: cookie! };
    } catch {
      /* sin secreto configurado: se emite una sesión nueva igualmente */
    }
  }
  const nuevo = randomUUID();
  let valor = nuevo;
  try {
    valor = `${nuevo}.${firmar("sesion-asistente", nuevo).slice(0, 22)}`;
  } catch {
    /* sin AUTH_SECRET (solo en desarrollo sin configurar): la sesión no va firmada */
  }
  return { id: nuevo, nueva: true, valor };
}

/** Lo que se aparta del presupuesto mensual antes de llamar al modelo: una respuesta típica cuesta bastante menos. */
export const RESERVA_USD = 0.02;
/** Coste aproximado del embedding de la pregunta (text-embedding-3-small, ~150 tokens): se suma a toda consulta. */
export const COSTO_EMBEDDING_USD = 0.00001;

// Resultado de reservar presupuesto: el id de la fila reservada, o el motivo por el que no se puede generar.
export type Reserva = { ok: true; id: string } | { ok: false; reason: "presupuesto_mensual" | "limite_sesion" };

/**
 * Aparta presupuesto ANTES de generar, de forma atómica (H-07). Comprobar el gasto y registrarlo después eran pasos
 * separados: varias consultas a la vez veían el mismo gasto y todas pasaban. Aquí, bajo un candado de transacción, se
 * comprueba el tope mensual (contando lo ya reservado) y el de la sesión, y se inserta la fila con la reserva; al terminar,
 * `liquidarGeneracion` la ajusta al coste real. Si el proceso muere a medias, la reserva se queda y cuenta como gasto.
 */
export async function reservarGeneracion(sessionId: string, question: string): Promise<Reserva> {
  const { presupuestoMensualUsd, topePorSesion } = await getLimites();
  const inicioMes = new Date();
  inicioMes.setUTCDate(1);
  inicioMes.setUTCHours(0, 0, 0, 0);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('assistant-budget'))`);
    const [mes] = await tx.select({ gasto: sql<string>`coalesce(sum(${assistantQueries.costUsd}), 0)` }).from(assistantQueries).where(gte(assistantQueries.createdAt, inicioMes));
    if (Number(mes?.gasto ?? 0) + RESERVA_USD > presupuestoMensualUsd) return { ok: false, reason: "presupuesto_mensual" } as const;
    const [sesion] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(assistantQueries)
      .where(and(gte(assistantQueries.createdAt, startOfDay()), eq(assistantQueries.sessionId, sessionId)));
    if (Number(sesion?.n ?? 0) >= topePorSesion) return { ok: false, reason: "limite_sesion" } as const;
    const [fila] = await tx
      .insert(assistantQueries)
      .values({ sessionId, question: question.slice(0, 2000), mode: "generativo", citedSources: [], answered: false, costUsd: RESERVA_USD.toFixed(6) })
      .returning({ id: assistantQueries.id });
    return { ok: true, id: fila.id } as const;
  });
}

/** Cierra una reserva: deja en la fila lo que de verdad ocurrió (modo, fuentes citadas, tokens y coste real). */
export async function liquidarGeneracion(
  id: string,
  r: { mode: "generativo" | "semantico_degradado"; cited: Array<{ title: string; url: string; kind: "articulo" | "archivo" }>; answered: boolean; inputTokens: number; outputTokens: number },
): Promise<void> {
  await db
    .update(assistantQueries)
    .set({
      mode: r.mode,
      citedSources: r.cited,
      answered: r.answered,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      costUsd: (estimateCostUsd(r.inputTokens, r.outputTokens) + COSTO_EMBEDDING_USD).toFixed(6),
    })
    .where(eq(assistantQueries.id, id));
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
