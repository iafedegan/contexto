import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Autoriza las llamadas a los endpoints de cron (Vercel Cron y programadores externos).
 *
 * Esperan `Authorization: Bearer <CRON_SECRET>`. Si la variable no está definida o está vacía
 * se rechaza SIEMPRE: antes, comparar contra `Bearer ${process.env.CRON_SECRET}` dejaba pasar
 * el texto literal «Bearer undefined» cuando faltaba la variable. La comparación es de tiempo
 * constante para no filtrar el secreto por la latencia de la respuesta.
 */
export function cronAutorizado(req: Request): boolean {
  const secreto = process.env.CRON_SECRET?.trim();
  if (!secreto) {
    console.error("[cron] CRON_SECRET no está configurada: se rechaza la llamada.");
    return false;
  }
  const recibido = Buffer.from(req.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${secreto}`);
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
}
