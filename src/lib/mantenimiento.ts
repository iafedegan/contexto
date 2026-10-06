import "server-only";
import { purgarLimitesVencidos } from "@/lib/rate-limit";
import { aplicarRetencion, type ResultadoRetencion } from "@/lib/newsletter/retencion";
import { limpiarMediaHuerfana, type ResultadoLimpieza } from "@/lib/media-limpieza";

/**
 * Mantenimiento diario de datos: lo que debe borrarse porque venció. Lo ejecuta el cron de `publish-scheduled` (el plan
 * Hobby de Vercel solo admite dos cron y ya están en uso, así que las tareas diarias comparten ese). Cada parte es
 * independiente y falla sola: una no impide a la otra.
 *
 *  - `rate_limits` (H-25): contadores de intentos, de un solo uso y de límites, vencidos hace más de una hora.
 *  - Retención de datos personales del boletín (H-21): ver `src/lib/newsletter/retencion.ts`.
 *  - Medios huérfanos (H-22): archivos del bucket sin uso desde hace más de 7 días; ver `src/lib/media-limpieza.ts`.
 */
export type ResultadoMantenimiento = {
  limitesBorrados: number;
  boletin: ResultadoRetencion | { error: string };
  medios: ResultadoLimpieza | { error: string };
};

export async function purgarVencidos(): Promise<ResultadoMantenimiento> {
  // Cada parte falla sola: se registra y se devuelve el motivo, sin tumbar a las demás.
  const aislar = <T,>(nombre: string, tarea: Promise<T>) =>
    tarea.catch((e: unknown) => {
      console.error(`mantenimiento: falló ${nombre}`, e);
      return { error: String((e as Error)?.message ?? e).slice(0, 200) };
    });
  const [limitesBorrados, boletin, medios] = await Promise.all([
    purgarLimitesVencidos(),
    aislar("la retención de datos del boletín", aplicarRetencion()),
    aislar("la limpieza de medios", limpiarMediaHuerfana()),
  ]);
  return { limitesBorrados, boletin, medios };
}
