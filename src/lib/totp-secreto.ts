import "server-only";
import { firmar, igualesSeguro } from "@/lib/claves";
import { decryptSecret, encryptSecret } from "@/lib/secrets";

/**
 * Cómo se guarda y se acepta el secreto del segundo factor (hallazgo H-D1).
 *
 * Antes se guardaba en texto plano en `users.totp_secret`: un volcado de la base habría permitido generar los códigos de
 * todas las cuentas. Ahora se cifra con AES-256-GCM (`src/lib/secrets.ts`, prefijo `v2.`). Lo guardado antes, en texto plano,
 * se sigue aceptando y se cifra solo la próxima vez que esa persona entra con su código (`heredado` en `abrirSecretoTotp`).
 * Un secreto TOTP en base32 son letras mayúsculas y dígitos 2-7, así que nunca empieza por `v2.`: el prefijo distingue los dos formatos.
 *
 * Además, el secreto de un alta nueva viaja por el formulario; para que no se pueda sustituir por uno elegido por quien envía
 * el formulario, el servidor lo firma al generarlo (con la persona y la hora) y exige esa firma al confirmar.
 */

const PREFIJO_CIFRADO = "v2.";
// Cuánto vale la firma de un alta: el tiempo de escanear el QR y escribir el código.
export const VIGENCIA_ALTA_MS = 15 * 60 * 1000;

/** Texto listo para guardar en `users.totp_secret`. */
export const sellarSecretoTotp = (secreto: string): string => encryptSecret(secreto);

/** Secreto en claro. `heredado` es `true` si estaba guardado sin cifrar (hay que volver a sellarlo). `secreto` es `null` si no se pudo descifrar. */
export function abrirSecretoTotp(guardado: string): { secreto: string | null; heredado: boolean } {
  if (guardado.startsWith(PREFIJO_CIFRADO)) return { secreto: decryptSecret(guardado), heredado: false };
  return { secreto: guardado, heredado: true };
}

/** Firma el secreto de un alta nueva para la persona indicada: `hora.firma`. */
export function firmarAltaTotp(userId: string, secreto: string, ahora = Date.now()): string {
  return `${ahora}.${firmar("totp-alta", `${userId}:${secreto}:${ahora}`)}`;
}

/** `true` si el secreto lo generó este servidor para esa persona hace menos de `VIGENCIA_ALTA_MS`. */
export function altaTotpValida(userId: string, secreto: string, firma: string, ahora = Date.now()): boolean {
  const [hora, mac, ...resto] = firma.split(".");
  if (!hora || !mac || resto.length || !/^\d{10,16}$/.test(hora)) return false;
  const emitida = Number(hora);
  if (emitida > ahora + 60_000 || ahora - emitida > VIGENCIA_ALTA_MS) return false;
  return igualesSeguro(mac, firmar("totp-alta", `${userId}:${secreto}:${emitida}`));
}
