import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { after } from "next/server";
import { dangerouslyDeleteByTag } from "@vercel/functions";

/**
 * Caché de datos ENTRE peticiones para las lecturas del portal público.
 *
 * La portada y las categorías se renderizan en cada visita (`force-dynamic`: prerenderizarlas en el
 * build consultaba Supabase desde el servidor de compilación y el despliegue caía por tiempo de
 * espera). El `cache()` de React solo memoiza dentro de UNA petición, así que cada visita repetía
 * todas las consultas. Aquí se guarda el resultado de las lecturas pesadas durante unos segundos, y
 * las acciones del panel lo invalidan al instante con `invalidarCache()` al publicar o cambiar ajustes.
 */

/**
 * Etiquetas. OJO: en Next 16, `unstable_cache` leído al generar una página estática le pega a ESA página sus etiquetas y le baja el
 * `revalidate` a su TTL. Por eso lo que leen las notas y los autores (el marco del sitio) usa `TTL_LARGO` y etiquetas propias que solo
 * se invalidan cuando eso cambia de verdad; «contenido» y «ajustes» quedan para la portada y las secciones, que son dinámicas.
 */
/** Listados de la portada y las secciones: cambia al publicar. Ninguna página estática la lleva. */
export const TAG_CONTENIDO = "contenido";
/** En vivo, anuncios y cotizaciones de las páginas dinámicas. Ninguna página estática la lleva. */
export const TAG_AJUSTES = "ajustes";
/** Plantilla (`home_layout`), identidad, ventana emergente y analítica: el marco de TODAS las páginas. Invalidarla regenera las ~100.000 notas. */
export const TAG_SITIO = "sitio";
/** Categorías del menú y del pie: solo la invalidan las acciones de secciones (también regenera todas las notas). */
export const TAG_MENU = "menu";
/** TTL de lo que leen las páginas estáticas: 30 días, igual que su `revalidate`. Se renuevan por invalidación explícita, no por tiempo. */
export const TTL_LARGO = 2_592_000;

/** Un `Date` serializado por JSON.stringify: `2026-10-05T10:00:00.000Z`, exactamente con ese formato. */
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
// Al leer el JSON, convierte de nuevo en fecha los textos con formato ISO exacto.
const revivirFechas = (_clave: string, valor: unknown) =>
  typeof valor === "string" && FECHA_ISO.test(valor) ? new Date(valor) : valor;

/**
 * Envuelve una lectura con `unstable_cache`. El resultado pasa SIEMPRE por JSON (también en el primer
 * cálculo) y las fechas se reconstruyen, así quien llama recibe lo mismo con la caché fría que con la
 * caliente: sin esto, un `Date` llegaría como texto desde la segunda visita.
 *
 * `fn` no debe devolver `undefined` ni depender de cookies o cabeceras de la petición.
 */
export function cachear<A extends unknown[], R>(
  clave: string,
  fn: (...args: A) => Promise<R>,
  opciones: { tags: string[]; segundos?: number },
): (...args: A) => Promise<R> {
  const interna = unstable_cache(async (...args: A) => JSON.stringify((await fn(...args)) ?? null), ["cg", clave], {
    tags: opciones.tags,
    revalidate: opciones.segundos ?? 60,
  });
  return async (...args: A) => JSON.parse(await interna(...args), revivirFechas) as R;
}

/**
 * Descarta lo cacheado: la siguiente visita lee de la base. Llamar desde una acción del servidor o un
 * handler de ruta, junto a los `revalidatePath` (nunca durante un render). Sin etiquetas descarta «contenido» y «ajustes»,
 * que no tocan ninguna página estática; `TAG_SITIO` y `TAG_MENU` hay que pedirlas a propósito.
 */
export function invalidarCache(...tags: string[]) {
  for (const tag of tags.length ? tags : [TAG_CONTENIDO, TAG_AJUSTES]) revalidateTag(tag, { expire: 0 });
  borrarCopiasCdn();
}

/** Etiqueta (`Vercel-Cache-Tag`) de lo que guarda la red de Vercel: portada, secciones y los datos que las notas piden desde el navegador (`/api/ultima-hora`, `/api/anuncios`, `/api/cintillo`). */
export const TAG_CDN_PORTAL = "portal";

/**
 * Borra de la red de Vercel las copias de la portada y las secciones (ver `next.config.ts` y `src/proxy.ts`).
 * Sin esto, tras apagar el directo o publicar, la red seguía sirviendo la copia vieja hasta que caducaba.
 * Se borra (no solo se marca como vieja) para que la siguiente visita ya vea el cambio.
 * Corre después de responder; fuera de Vercel no hace nada.
 */
function borrarCopiasCdn() {
  const borrar = () => dangerouslyDeleteByTag(TAG_CDN_PORTAL).catch((e) => console.error("[cdn] no se pudo borrar la caché", e));
  try {
    after(borrar);
  } catch {
    // Fuera de una petición (scripts) no hay `after`: no hay red de Vercel que limpiar.
  }
}
