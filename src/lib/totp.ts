import "server-only";
import { verifySync } from "otplib";
import { usoUnico } from "@/lib/rate-limit";

/**
 * Verificación del segundo factor (TOTP) con las dos protecciones que faltaban (hallazgo H-20):
 *
 *  - Tolerancia de un paso (±30 s) a cada lado: un teléfono con el reloj algo desfasado ya no falla, que antes
 *    ocurría porque se exigía el paso exacto.
 *  - Un código sirve UNA sola vez (RFC 6238 §5.2): una vez aceptado, su paso de tiempo queda marcado y el mismo código
 *    se rechaza si se repite dentro de su ventana de validez. Así, quien lo vea por encima del hombro o lo capture no
 *    puede reutilizarlo.
 *
 * El marcado usa la tabla `rate_limits` (UPSERT atómico, vale entre instancias) y no una columna de `users`: no
 * requiere migración. Hereda la política de ese limitador: si la base falla, no bloquea el acceso.
 */

/** Segundos de tolerancia a cada lado del paso actual (un paso de 30 s). */
export const TOLERANCIA_RELOJ_S = 30;
// Cuánto se recuerda un código ya gastado: tres pasos de 30 s cubren toda la ventana en la que podría validar.
const MEMORIA_CODIGO_S = 120;

// Motivo por el que se rechaza un código.
export type ResultadoTotp = { ok: true } | { ok: false; motivo: "incorrecto" | "reutilizado" };

/**
 * Comprueba un código de 6 dígitos contra el secreto de la cuenta y, si es válido, lo gasta. Acepta el código con
 * espacios (`123 456`), como lo muestran algunas aplicaciones.
 */
export async function verificarCodigoTotp(userId: string, secreto: string, codigo: string): Promise<ResultadoTotp> {
  const limpio = codigo.replace(/\s/g, "");
  if (!/^\d{6}$/.test(limpio)) return { ok: false, motivo: "incorrecto" };
  let resultado;
  try {
    resultado = verifySync({ token: limpio, secret: secreto, epochTolerance: TOLERANCIA_RELOJ_S });
  } catch {
    return { ok: false, motivo: "incorrecto" }; // secreto guardado corrupto: nunca valida
  }
  if (!resultado.valid) return { ok: false, motivo: "incorrecto" };
  // El paso de tiempo identifica al código sin guardarlo: dos códigos distintos nunca comparten paso. La API funcional
  // de otplib lo devuelve en runtime pero no lo declara en sus tipos; si faltara, se calcula con el desfase (`delta`).
  const extra = resultado as { timeStep?: number; delta?: number };
  const paso = extra.timeStep ?? Math.floor(Date.now() / 30_000) + (extra.delta ?? 0);
  if (!(await usoUnico(`totp:${userId}:${paso}`, MEMORIA_CODIGO_S))) {
    return { ok: false, motivo: "reutilizado" };
  }
  return { ok: true };
}

/**
 * Comprueba un código con la misma tolerancia pero SIN gastarlo. Es para el alta del segundo factor: ahí el código
 * solo demuestra que la aplicación de la persona ya tiene el secreto, y gastarlo la obligaría a esperar al siguiente
 * si entra justo después.
 */
export function codigoTotpValido(secreto: string, codigo: string): boolean {
  const limpio = codigo.replace(/\s/g, "");
  if (!/^\d{6}$/.test(limpio)) return false;
  try {
    return verifySync({ token: limpio, secret: secreto, epochTolerance: TOLERANCIA_RELOJ_S }).valid;
  } catch {
    return false;
  }
}
