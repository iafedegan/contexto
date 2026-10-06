import "server-only";
import { sql } from "drizzle-orm";
import { db, rowsOf } from "@/db";
import { borrarMedia, listarMedia } from "@/lib/media-storage";

/**
 * Limpieza de medios huérfanos (H-22): el almacenamiento solo crecía porque nada borraba las imágenes de una nota
 * eliminada ni las que se subieron y nunca se usaron. Cada día se listan los archivos del bucket y se borran los que
 * llevan más de `dias` días Y no aparecen citados en ninguna parte (notas, borradores de IA, anuncios, autores, ediciones
 * del boletín ni ajustes del sitio, que incluyen el estado de las conversaciones de Telegram).
 */

/** Días que un archivo sin uso se conserva antes de borrarse: margen para borradores que aún no se guardan. */
export const DIAS_DE_GRACIA = 7;
// Tope de borrados por ejecución: una limpieza descontrolada nunca vacía el bucket de golpe.
const MAX_BORRADOS = 200;

/** Nombres de archivo del bucket «media» que aparecen en cualquier tabla que pueda guardar una dirección. */
export async function nombresReferenciados(): Promise<Set<string>> {
  // `to_jsonb(fila)` evita enumerar columnas (y sigue valiendo si se añaden); el vector de embeddings se descarta por pesado.
  const patron = "/object/public/media/([A-Za-z0-9._/-]+)";
  const tablas = ["articles", "ads_zones", "authors", "agent_drafts", "newsletter_editions", "site_settings"];
  const consulta = tablas
    .map((t) => `select regexp_matches((to_jsonb(x) - 'embedding')::text, '${patron}', 'g') as m from ${t} x`)
    .join(" union all ");
  const filas = rowsOf<{ name: string }>(await db.execute(sql.raw(`select distinct (m)[1] as name from (${consulta}) s`)));
  return new Set(filas.map((f) => f.name));
}

/** Resultado de una limpieza. */
export type ResultadoLimpieza = { revisados: number; borrados: number; omitida?: string };

/** Borra los medios huérfanos con más de `dias` días. Se omite sola si algo no cuadra. */
export async function limpiarMediaHuerfana(opciones: { dias?: number; ahora?: Date } = {}): Promise<ResultadoLimpieza> {
  // Válvula de seguridad: borrar archivos es irreversible, así que se puede detener sin tocar código.
  if (process.env.MEDIA_CLEANUP === "off") return { revisados: 0, borrados: 0, omitida: "desactivada con MEDIA_CLEANUP=off" };
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { revisados: 0, borrados: 0, omitida: "sin almacenamiento configurado" };
  const limite = (opciones.ahora ?? new Date()).getTime() - (opciones.dias ?? DIAS_DE_GRACIA) * 24 * 3600_000;
  const objetos = await listarMedia();
  const refs = await nombresReferenciados();
  // Si no se encuentra NINGUNA referencia pero hay archivos, lo más probable es que la consulta falle o cambie el formato
  // de las direcciones: antes que borrar todo, no se borra nada.
  if (refs.size === 0 && objetos.length > 20) return { revisados: objetos.length, borrados: 0, omitida: "no se encontró ninguna referencia: no se borra nada" };

  let borrados = 0;
  for (const o of objetos) {
    if (borrados >= MAX_BORRADOS) break;
    if (refs.has(o.name) || Date.parse(o.createdAt) > limite) continue;
    if (await borrarMedia(o.name)) borrados++;
  }
  return { revisados: objetos.length, borrados };
}
