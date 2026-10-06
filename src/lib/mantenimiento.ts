import "server-only";
import { purgarLimitesVencidos } from "@/lib/rate-limit";
import { aplicarRetencion, type ResultadoRetencion } from "@/lib/newsletter/retencion";

/**
 * Mantenimiento diario de datos: lo que debe borrarse porque venció. Lo ejecuta el cron de `publish-scheduled` (el plan
 * Hobby de Vercel solo admite dos cron y ya están en uso, así que las tareas diarias comparten ese). Cada parte es
 * independiente y falla sola: una no impide a la otra.
 *
 *  - `rate_limits` (H-25): contadores de intentos, de un solo uso y de límites, vencidos hace más de una hora.
 *  - Retención de datos personales del boletín (H-21): ver `src/lib/newsletter/retencion.ts`.
 */
export type ResultadoMantenimiento = {
  limitesBorrados: number;
  boletin: ResultadoRetencion | { error: string };
};

export async function purgarVencidos(): Promise<ResultadoMantenimiento> {
  const [limitesBorrados, boletin] = await Promise.all([
    purgarLimitesVencidos(),
    aplicarRetencion().catch((e: unknown) => {
      console.error("mantenimiento: falló la retención de datos del boletín", e);
      return { error: String((e as Error)?.message ?? e).slice(0, 200) };
    }),
  ]);
  return { limitesBorrados, boletin };
}
