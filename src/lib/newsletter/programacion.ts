/**
 * Fechas de la programación del envío. Colombia no tiene horario de verano (UTC−5 todo el año), así que la hora que se escribe en el
 * panel («7:00 a. m.») se interpreta siempre como hora de Colombia, sin importar dónde esté el navegador o el servidor. Sin `server-only`.
 */

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Una fecha y hora escritas como `2026-10-15T07:00` (hora de Colombia) → el instante real; `null` si no es una fecha válida. */
export function fechaBogota(local: string): Date | null {
  const m = LOCAL.exec(local.trim());
  if (!m) return null;
  const [, a, mes, d, h, min] = m.map(Number) as unknown as number[];
  const fecha = new Date(`${local.trim()}:00-05:00`);
  if (Number.isNaN(fecha.getTime())) return null;
  // Rechaza «30 de febrero», «25:00»… (Date las corrige en silencio): se comprueba que la fecha dice lo mismo que se escribió.
  const vuelta = aLocalBogota(fecha);
  return vuelta === `${String(a).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}` ? fecha : null;
}

/** Un instante → `2026-10-15T07:00` en hora de Colombia (lo que espera un campo `datetime-local`). */
export function aLocalBogota(fecha: Date): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(fecha).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** «jueves 15 de octubre de 2026, 7:00 a. m.» */
export function describirCuando(fecha: Date): string {
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(fecha);
}

/** Margen mínimo entre ahora y la hora elegida (el envío necesita que alguien lo dispare) y máximo (un año). */
export const MIN_ANTICIPO_MS = 2 * 60_000;
export const MAX_ANTICIPO_MS = 366 * 24 * 3600_000;
