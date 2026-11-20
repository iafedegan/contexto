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
