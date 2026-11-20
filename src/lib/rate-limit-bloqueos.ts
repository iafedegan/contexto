import "server-only";
import { sql } from "drizzle-orm";
import { db, rowsOf } from "@/db";

/**
 * Cuentas bloqueadas por intentos fallidos. El inicio de sesión cuenta los intentos por correo (`login:email:<correo>`, tope 5 en 15 minutos)
 * y los códigos enviados por cuenta (`codigo-acceso:envio:<id>`, tope 5 en 15 minutos): pasado el tope la persona no puede entrar hasta que vence
 * la ventana. Aquí se LEE ese estado para mostrárselo a un administrador y se BORRA para desbloquear antes de tiempo. Si la tabla no existe,
 * nadie figura como bloqueado.
 */
const TOPE_LOGIN = 5;
const TOPE_CODIGOS = 5;

/** Para cada cuenta bloqueada ahora, hasta cuándo (el correo en minúsculas es la clave). */
export async function bloqueosActivos(cuentas: { id: string; email: string }[]): Promise<Map<string, Date>> {
  const salida = new Map<string, Date>();
  if (!cuentas.length) return salida;
  try {
    const claves = cuentas.flatMap((c) => [`login:email:${c.email.toLowerCase().trim()}`, `codigo-acceso:envio:${c.id}`]);
    const filas = rowsOf<{ key: string; count: number; reset_at: string | Date }>(
      await db.execute(sql`select key, count, reset_at from rate_limits where key in (${sql.join(claves.map((k) => sql`${k}`), sql`, `)}) and reset_at > now()`),
    );
    for (const f of filas) {
      const hasta = new Date(f.reset_at);
      const n = Number(f.count);
      const bloqueada = (f.key.startsWith("login:email:") && n > TOPE_LOGIN) || (f.key.startsWith("codigo-acceso:envio:") && n > TOPE_CODIGOS);
      if (!bloqueada) continue;
      const cuenta = cuentas.find((c) => f.key === `login:email:${c.email.toLowerCase().trim()}` || f.key === `codigo-acceso:envio:${c.id}`);
      if (!cuenta) continue;
      const previo = salida.get(cuenta.id);
      if (!previo || hasta > previo) salida.set(cuenta.id, hasta);
    }
  } catch {
    /* sin tabla de límites: nadie bloqueado */
  }
  return salida;
}

/** Quita los contadores de la cuenta: puede volver a intentar de inmediato. */
export async function desbloquearCuenta(cuenta: { id: string; email: string }): Promise<void> {
  try {
    await db.execute(sql`delete from rate_limits where key in (${`login:email:${cuenta.email.toLowerCase().trim()}`}, ${`codigo-acceso:envio:${cuenta.id}`})`);
  } catch {
    /* sin tabla: nada que limpiar */
  }
}
