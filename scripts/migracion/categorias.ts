/**
 * Correspondencia entre las secciones del sitio anterior y las categorías del portal nuevo.
 *
 * El sitio anterior guardaba cada nota en una carpeta (`/regiones/…`) y, aparte, una lista de secciones donde debía aparecer
 * (`home`, `colombia`, `regiones`, `gremialidad`…). Aquí se decide la categoría principal de cada nota (la más específica) y se
 * conservan todas las secciones, para que sigan apareciendo también en las demás.
 */

/** Categorías que el portal nuevo no tenía y que la migración crea (cuelgan de una categoría ya existente). */
export const CATEGORIAS_NUEVAS: Array<{ slug: string; name: string; parent: string; legacyPaths: string[]; description: string }> = [
  { slug: "galeria", name: "Galería", parent: "especiales", legacyPaths: ["/galeria"], description: "Galerías de fotos del sector ganadero y del campo colombiano." },
  { slug: "video", name: "Video", parent: "tv", legacyPaths: ["/video"], description: "Videos de CONtexto ganadero." },
  { slug: "audio", name: "Audio", parent: "radio", legacyPaths: ["/audio"], description: "Entrevistas y programas de audio de CONtexto ganadero." },
  { slug: "seguridad", name: "Seguridad", parent: "colombia", legacyPaths: ["/seguridad"], description: "Orden público y seguridad en el campo colombiano." },
];

/** Direcciones antiguas que se suman a categorías que ya existían (la carpeta se llamaba distinto en el sitio anterior). */
export const RUTAS_ANTIGUAS_EXTRA: Record<string, string[]> = {
  blogs: ["/blog"],
};

/**
 * Nombres antiguos (carpeta o sección) que no coinciden con el slug de ninguna categoría ni con sus direcciones antiguas.
 * Claves en minúscula.
 */
export const ALIAS: Record<string, string> = {
  columna: "columnas",
  blog: "blogs",
  otroseventos: "otros-eventos",
  saludanimal: "salud-animal",
  otrossistemp: "otros-sistemas-pecuarios",
  ovinocaprino: "ovino-caprino",
  otrosmundo: "otros-mundo",
  redessociales: "redes-sociales",
  sistempecuario: "sistemas-pecuarios",
  precioganado: "precio-del-ganado",
  // La carpeta «ganaderia-sostenible» reunía las notas de Ganadería; la sección exacta sale de la lista de secciones de cada nota.
  "ganaderia-sostenible": "ganaderia",
};

/** Árbol de categorías conocido: slug → padre (null si es de primer nivel). */
export type Arbol = Map<string, string | null>;

// Descendientes (hijos, nietos…) de una categoría.
function descendientes(arbol: Arbol, slug: string): string[] {
  const directos = [...arbol].filter(([, p]) => p === slug).map(([s]) => s);
  return directos.flatMap((h) => [h, ...descendientes(arbol, h)]);
}

/** Nombre antiguo → slug de categoría del árbol, o null si no corresponde a ninguna. */
export function aCategoria(clave: string, arbol: Arbol): string | null {
  const k = clave.trim().toLowerCase();
  if (!k || k === "home") return null;
  const slug = ALIAS[k] ?? k;
  return arbol.has(slug) ? slug : null;
}

/**
 * Categoría principal y todas las categorías de una nota.
 * - Si la carpeta es una categoría sin hijas, esa es la principal.
 * - Si es una categoría con hijas (Economía, Tendencias, Ganadería…), gana la primera sección marcada que sea una de sus hijas.
 * - `todas` incluye la principal primero y luego el resto de las secciones, sin repetir.
 */
export function elegirCategoria(carpeta: string, secciones: string[], arbol: Arbol): { principal: string | null; todas: string[] } {
  const marcadas = [...new Set(secciones.map((s) => aCategoria(s, arbol)).filter((s): s is string => !!s))];
  const delaCarpeta = aCategoria(carpeta, arbol);
  let principal: string | null = null;
  if (delaCarpeta) {
    const hijas = descendientes(arbol, delaCarpeta);
    if (hijas.length === 0) principal = delaCarpeta;
    else {
      const hojas = marcadas.filter((m) => hijas.includes(m) && descendientes(arbol, m).length === 0);
      principal = hojas[0] ?? marcadas.find((m) => hijas.includes(m)) ?? delaCarpeta;
    }
  } else {
    // Carpeta sin categoría propia: la sección marcada más específica (hoja primero).
    principal = marcadas.find((m) => descendientes(arbol, m).length === 0) ?? marcadas[0] ?? null;
  }
  const todas = [...new Set([...(principal ? [principal] : []), ...marcadas, ...(delaCarpeta ? [delaCarpeta] : [])])];
  return { principal, todas };
}
