/**
 * Qué tan difícil de adivinar es una contraseña, de 0 (muy fácil) a 4 (muy difícil). Estima la entropía por el largo y la variedad de
 * caracteres y la rebaja por lo que un atacante prueba primero: palabras comunes (contraseña, fedegan, contexto…), el nombre o el correo
 * de la persona, secuencias (1234, abcd, qwerty), repeticiones (aaaa) y años. Sirve igual en el navegador (la barra) y en el servidor
 * (que rechaza las fáciles). No es zxcvbn, pero atrapa lo que se ve en la práctica.
 */
export type NivelClave = 0 | 1 | 2 | 3 | 4;
export const NOMBRES_NIVEL = ["Muy fácil", "Fácil", "Aceptable", "Difícil", "Muy difícil"] as const;
/** Nivel mínimo que se acepta al cambiar la contraseña. */
export const NIVEL_MINIMO: NivelClave = 2;
export const LARGO_MINIMO = 10;

const COMUNES = [
  "contrasena", "password", "passw0rd", "clave", "secreto", "admin", "administrador", "usuario", "bienvenido", "welcome", "qwerty", "asdf", "zxcv",
  "fedegan", "contexto", "ganadero", "ganaderia", "ganado", "colombia", "bogota", "medellin", "vaca", "toro", "iloveyou", "teamo", "dios",
  "123456", "654321", "111111", "000000", "abc123", "editor", "redactor", "panel",
];
const SECUENCIAS = ["abcdefghijklmnopqrstuvwxyz", "01234567890", "qwertyuiop", "asdfghjklñ", "zxcvbnm"];

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Nivel de la contraseña; `datos` son textos de la persona (nombre, correo) que no deben servir de contraseña. */
export function fuerzaClave(clave: string, datos: string[] = []): { nivel: NivelClave; bits: number; consejo: string | null } {
  if (!clave) return { nivel: 0, bits: 0, consejo: null };
  let pool = 0;
  if (/[a-zñ]/.test(clave)) pool += 27;
  if (/[A-ZÑ]/.test(clave)) pool += 27;
  if (/\d/.test(clave)) pool += 10;
  if (/[^a-zA-ZñÑ\d]/.test(clave)) pool += 33;
  const porCaracter = Math.log2(Math.max(pool, 2));
  let bits = clave.length * porCaracter;
  let consejo: string | null = null;

  const bajo = sinTildes(clave).replace(/[@4]/g, "a").replace(/3/g, "e").replace(/[1!]/g, "i").replace(/0/g, "o").replace(/\$/g, "s");
  const propios = datos
    .flatMap((d) => sinTildes(d).split(/[^a-z0-9]+/))
    .filter((p) => p.length >= 4);
  // Cada palabra conocida dentro de la contraseña cuenta casi como un solo carácter.
  for (const w of [...COMUNES, ...propios]) {
    if (w.length >= 4 && bajo.includes(w)) {
      bits -= (w.length - 1) * porCaracter;
      consejo = propios.includes(w) ? "No uses tu nombre ni tu correo." : "Evita palabras conocidas como «contraseña» o el nombre del gremio.";
    }
  }
  // Secuencias de 4 o más (1234, abcd, qwer) y repeticiones (aaaa).
  for (const sec of SECUENCIAS) {
    for (let i = 0; i + 4 <= sec.length; i++) {
      const trozo = sec.slice(i, i + 4);
      const reves = [...trozo].reverse().join("");
      if (bajo.includes(trozo) || bajo.includes(reves)) {
        bits -= 3 * porCaracter;
        consejo ??= "Evita secuencias como 1234 o abcd.";
      }
    }
  }
  const repes = bajo.match(/(.)\1{2,}/g) ?? [];
  for (const r of repes) {
    bits -= (r.length - 1) * porCaracter;
    consejo ??= "Evita repetir el mismo carácter.";
  }
  if (/(19|20)\d{2}/.test(clave)) {
    bits -= 2 * porCaracter;
    consejo ??= "Un año (como 2026) es de lo primero que se prueba.";
  }
  bits = Math.max(0, bits);
  if (clave.length < LARGO_MINIMO) consejo = `Usa al menos ${LARGO_MINIMO} caracteres.`;
  const nivel: NivelClave = clave.length < LARGO_MINIMO ? (bits >= 36 ? 1 : 0) : bits < 30 ? 0 : bits < 40 ? 1 : bits < 52 ? 2 : bits < 66 ? 3 : 4;
  if (!consejo && nivel < 3) consejo = "Hazla más larga o mezcla mayúsculas, números y símbolos.";
  return { nivel, bits: Math.round(bits), consejo };
}

const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/** Una contraseña segura generada al azar en el navegador o el servidor (Web Crypto): 4 grupos de 4, p. ej. «Hk7m-Qr2x-Pb9s-Tn4w». */
export function generarClaveSegura(): string {
  const azar = new Uint32Array(16);
  globalThis.crypto.getRandomValues(azar);
  const c = Array.from(azar, (n) => ALFABETO[n % ALFABETO.length]);
  return [0, 4, 8, 12].map((i) => c.slice(i, i + 4).join("")).join("-");
}
