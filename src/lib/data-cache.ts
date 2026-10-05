import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";

/**
 * Caché de datos ENTRE peticiones para las lecturas del portal público.
 *
 * La portada y las categorías se renderizan en cada visita (`force-dynamic`: prerenderizarlas en el
 * build consultaba Supabase desde el servidor de compilación y el despliegue caía por tiempo de
 * espera). El `cache()` de React solo memoiza dentro de UNA petición, así que cada visita repetía
 * todas las consultas. Aquí se guarda el resultado de las lecturas pesadas durante unos segundos, y
 * las acciones del panel lo invalidan al instante con `invalidarCache()` al publicar o cambiar ajustes.
 */

/** Notas, categorías, autores y todo lo que cambia al publicar. */
export const TAG_CONTENIDO = "contenido";
/** Identidad del sitio, plantilla de portada, ventana emergente y anuncios. */
export const TAG_AJUSTES = "ajustes";

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
 * handler de ruta, junto a los `revalidatePath` (nunca durante un render).
 */
export function invalidarCache(...tags: string[]) {
  for (const tag of tags.length ? tags : [TAG_CONTENIDO, TAG_AJUSTES]) revalidateTag(tag, { expire: 0 });
}
