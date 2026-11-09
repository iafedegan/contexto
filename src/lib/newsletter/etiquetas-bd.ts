import "server-only";

import { eq, sql, type SQL } from "drizzle-orm";
import { db, rowsOf } from "@/db";
import { newsletterSubscribers as t } from "@/db/schema";
import { MAX_ETIQUETAS_POR_SUSCRIPTOR, claveEtiqueta, limpiarEtiqueta, sanitizarEtiquetas } from "@/lib/newsletter/etiquetas";

/**
 * Etiquetas de suscriptores (lectura y escritura). Cada persona lleva una lista de nombres en `tags`. Para que «Aliados», «aliados» y
 * «Alíados» no se conviertan en tres grupos, al poner una etiqueta se reutiliza la forma que ya existe (`nombreExistente`); por eso
 * después basta comparar los nombres tal cual. Todo se hace en SQL de una sola sentencia: rápido aun con miles de suscriptores.
 */

const idsSql = (ids: string[]): SQL => sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `);

/** Inventario: cada etiqueta con cuántas personas la llevan (todas, estén activas o no). */
export async function etiquetasEnUso(): Promise<{ nombre: string; n: number }[]> {
  const r = await db.execute(sql`
    select e as nombre, count(*)::int as n
    from newsletter_subscribers, jsonb_array_elements_text(tags) e
    group by e order by n desc, e limit 500`);
  return (rowsOf(r) as { nombre: string; n: number }[]).map((x) => ({ nombre: String(x.nombre), n: Number(x.n) }));
}

/** El nombre tal como ya está guardado si existe una etiqueta igual salvo mayúsculas o tildes; si no, el nombre limpio. Vacío = no válido. */
export async function nombreExistente(nombre: string, enUso?: { nombre: string }[]): Promise<string> {
  const limpio = limpiarEtiqueta(nombre);
  if (!limpio) return "";
  const clave = claveEtiqueta(limpio);
  return (enUso ?? (await etiquetasEnUso())).find((e) => claveEtiqueta(e.nombre) === clave)?.nombre ?? limpio;
}

/** Fija las etiquetas de una persona (sustituye su lista). Devuelve la lista guardada, o `null` si la persona no existe. */
export async function fijarEtiquetas(id: string, nuevas: unknown): Promise<string[] | null> {
  const enUso = await etiquetasEnUso();
  const lista = sanitizarEtiquetas(sanitizarEtiquetas(nuevas).map((n) => enUso.find((e) => claveEtiqueta(e.nombre) === claveEtiqueta(n))?.nombre ?? n));
  const r = await db.update(t).set({ tags: lista }).where(eq(t.id, id)).returning({ id: t.id });
  return r.length ? lista : null;
}

/** Pone una etiqueta a varias personas. `llenos` = a cuántas no se les pudo poner por llevar ya el máximo. */
export async function agregarAVarios(ids: string[], nombre: string): Promise<{ etiqueta: string; cambiados: number; llenos: number }> {
  const etiqueta = await nombreExistente(nombre);
  if (!etiqueta || ids.length === 0) return { etiqueta, cambiados: 0, llenos: 0 };
  const llenos = rowsOf(
    await db.execute(sql`
      select 1 from newsletter_subscribers
      where id in (${idsSql(ids)}) and not (tags ? ${etiqueta}::text) and jsonb_array_length(tags) >= ${MAX_ETIQUETAS_POR_SUSCRIPTOR}`),
  ).length;
  const cambiados = rowsOf(
    await db.execute(sql`
      update newsletter_subscribers set tags = tags || to_jsonb(${etiqueta}::text)
      where id in (${idsSql(ids)}) and not (tags ? ${etiqueta}::text) and jsonb_array_length(tags) < ${MAX_ETIQUETAS_POR_SUSCRIPTOR}
      returning id`),
  ).length;
  return { etiqueta, cambiados, llenos };
}

/** Quita una etiqueta a varias personas. Devuelve a cuántas se la quitó. */
export async function quitarDeVarios(ids: string[], nombre: string): Promise<{ etiqueta: string; cambiados: number }> {
  const etiqueta = await nombreExistente(nombre);
  if (!etiqueta || ids.length === 0) return { etiqueta, cambiados: 0 };
  const cambiados = rowsOf(
    await db.execute(sql`
      update newsletter_subscribers set tags = tags - ${etiqueta}::text
      where id in (${idsSql(ids)}) and tags ? ${etiqueta}::text
      returning id`),
  ).length;
  return { etiqueta, cambiados };
}

/**
 * Cambia el nombre de una etiqueta en todas las personas que la llevan. Si ya existe otra con el nuevo nombre (salvo mayúsculas o tildes),
 * se unen: quien llevaba las dos queda con una sola.
 */
export async function renombrarEtiqueta(de: string, nuevo: string): Promise<{ nombre: string; afectados: number } | null> {
  const origen = limpiarEtiqueta(de);
  const enUso = await etiquetasEnUso();
  const nombre = await nombreExistente(nuevo, enUso.filter((e) => e.nombre !== origen));
  if (!origen || !nombre || nombre === origen || !enUso.some((e) => e.nombre === origen)) return null;
  // Quien ya llevaba el nombre nuevo solo pierde el viejo; al resto se le cambia.
  const unidos = rowsOf(
    await db.execute(sql`
      update newsletter_subscribers set tags = tags - ${origen}::text
      where tags ? ${origen}::text and tags ? ${nombre}::text
      returning id`),
  ).length;
  const renombrados = rowsOf(
    await db.execute(sql`
      update newsletter_subscribers set tags = (tags - ${origen}::text) || to_jsonb(${nombre}::text)
      where tags ? ${origen}::text
      returning id`),
  ).length;
  return { nombre, afectados: unidos + renombrados };
}

/** Quita una etiqueta de todas las personas. Devuelve a cuántas se la quitó. */
export async function eliminarEtiqueta(nombre: string): Promise<number> {
  const etiqueta = limpiarEtiqueta(nombre);
  if (!etiqueta) return 0;
  return rowsOf(
    await db.execute(sql`
      update newsletter_subscribers set tags = tags - ${etiqueta}::text
      where tags ? ${etiqueta}::text
      returning id`),
  ).length;
}
