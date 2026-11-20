/**
 * Dirección (slug) libre para una nota nueva. Si el título ya está tomado, se agrega un número corto y legible (`titulo-2`, `titulo-3`…) y no un
 * sufijo al azar: las direcciones con letras y números sueltos (`…-mwp9bxru`) se ven mal en el navegador, en los buscadores y al compartirlas.
 * Sin base de datos, para poder probarla: `existe` dice si una dirección ya la usa otra nota.
 */
export const SUFIJO_ANTIGUO = /-[l-n][0-9a-z]{7}$/;

export async function slugLibre(base: string, existe: (slug: string) => Promise<boolean>): Promise<string> {
  if (!(await existe(base))) return base;
  for (let n = 2; n <= 99; n++) {
    // El título largo se recorta para que el número quepa en el tope de 96 caracteres de la dirección.
    const candidato = `${base.slice(0, 96 - String(n).length - 1).replace(/-$/, "")}-${n}`;
    if (!(await existe(candidato))) return candidato;
  }
  return `${base.slice(0, 80)}-${Date.now().toString(36).slice(-4)}`;
}

/**
 * ¿El final de la dirección es de verdad el sufijo de fecha que se le ponía al crearla? `SUFIJO_ANTIGUO` solo mira la forma (8 letras o números
 * que empiezan por l, m o n) y eso también calza con palabras normales («-lafaurie», «-monteria», «-medellin», «-nacional»). El sufijo era
 * `Date.now()` en base 36 en el momento de crear la nota: solo cuenta si, leído como fecha, cae a menos de 3 días de su `created_at`.
 */
export function esSufijoDeFecha(slug: string, creadaEn: Date | string | null | undefined): boolean {
  const m = slug.match(/-([l-n][0-9a-z]{7})$/);
  if (!m || !creadaEn) return false;
  const ts = parseInt(m[1], 36);
  const creada = new Date(creadaEn).getTime();
  return Number.isFinite(ts) && Number.isFinite(creada) && Math.abs(ts - creada) <= 3 * 86_400_000;
}
