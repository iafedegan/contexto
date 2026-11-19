import { randomInt } from "node:crypto";

/** Letras y números sin los que se confunden al leerlos o dictarlos (0/O, 1/l/I). */
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/**
 * Contraseña temporal para restablecer una cuenta: 12 caracteres al azar (aleatoriedad criptográfica), en tres grupos de cuatro para
 * que se lea y se copie sin errores (p. ej. «Hk7m-Qr2x-Pb9s»). Cumple el mínimo de 10 caracteres del panel.
 */
export function generarClaveTemporal(): string {
  const grupo = () => Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
  return `${grupo()}-${grupo()}-${grupo()}`;
}
