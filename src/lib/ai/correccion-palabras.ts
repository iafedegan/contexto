import "server-only";
import { corregirPalabra, type PalabraConocida } from "@/lib/ai/lectura-pregunta";
import { notasConPalabra, palabrasDeTitulos } from "@/lib/search";

const sinTilde = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "");
/** Una palabra que sale en menos notas que esto puede ser un error: «bruselosis» está mal escrita en una nota y aun así hay que corregirla. */
const NOTAS_PARA_CONFIAR = 5;

/**
 * Corrige lo mal escrito antes de buscar, sin IA. Solo se toca una palabra que no está en los títulos y casi no sale en el texto, para no cambiar
 * nunca una palabra rara pero bien escrita. Devuelve las palabras finales y qué se cambió, para decírselo al lector.
 */
export async function corregirClaves(claves: string[]): Promise<{ claves: string[]; cambios: Array<{ de: string; a: string }> }> {
  if (!claves.length) return { claves, cambios: [] };
  const conocidas: PalabraConocida[] = await palabrasDeTitulos();
  const sabidas = new Set(conocidas.map((c) => sinTilde(c.palabra)));
  const cambios: Array<{ de: string; a: string }> = [];
  const finales = await Promise.all(
    claves.map(async (clave) => {
      if (sabidas.has(sinTilde(clave))) return clave;
      if ((await notasConPalabra(clave, NOTAS_PARA_CONFIAR)) >= NOTAS_PARA_CONFIAR) return clave;
      const corregida = corregirPalabra(clave, conocidas);
      if (!corregida) return clave;
      cambios.push({ de: clave, a: corregida });
      return corregida;
    }),
  );
  return { claves: finales, cambios };
}
