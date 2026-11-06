"use server";

/**
 * Biblioteca de imágenes del panel. Cualquier persona con sesión puede EXPLORAR lo que se le asignó (para elegir la imagen de una nota);
 * crear carpetas, subir, mover, borrar y asignar solo lo hace quien tiene el permiso «biblioteca» (administrador y diseñadora).
 * Las reglas de quién ve qué están en `src/lib/biblioteca-acceso.ts`.
 */
import { and, asc, desc, eq, ilike, inArray, isNull, sql } from "drizzle-orm";
import { db, rowsOf } from "@/db";
import { mediaAssets, mediaFolderAccess, mediaFolders, users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { tienePermiso } from "@/lib/permisos-server";
import { carpetasVisibles, estaDentroDe, nombreValido } from "@/lib/biblioteca-acceso";
import { urlPublicaMedia } from "@/lib/media-storage";

export type CarpetaInfo = { id: string; parentId: string | null; name: string };
export type ActivoInfo = { id: string; name: string; url: string; kind: string; bytes: number | null; folderId: string | null; carpeta: string | null; createdAt: string };
export type Explorado =
  | { ok: true; gestiona: boolean; carpetas: CarpetaInfo[]; activos: ActivoInfo[]; hayMas: boolean }
  | { ok: false; error: string };
type Resultado = { ok: true } | { ok: false; error: string };
type Persona = { id: string; name: string; role: string };

const MAX_ACTIVOS = 200;
const MAX_BUSQUEDA = 60;
const MAX_SUBIDA_LOTE = 100;
const SIN_ACCESO = "No tienes acceso a esa carpeta.";

/** Quien pregunta (cualquier rol con sesión) y si gestiona la biblioteca. */
async function contexto() {
  const yo = await requireRole("redactor");
  return { yo, gestiona: await tienePermiso(yo.id, yo.role, "biblioteca") };
}
/** Solo para quien gestiona: lanza si no. */
async function gestor() {
  const c = await contexto();
  if (!c.gestiona) throw new Error("SIN_PERMISO");
  return c.yo;
}

const todasLasCarpetas = async (): Promise<CarpetaInfo[]> =>
  db.select({ id: mediaFolders.id, parentId: mediaFolders.parentId, name: mediaFolders.name }).from(mediaFolders).orderBy(asc(mediaFolders.name));

// Un texto de búsqueda es literal: los comodines de LIKE no cuentan.
const comoLiteral = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Las carpetas que la persona ve y los archivos de una carpeta (o los que coinciden con la búsqueda, en todas las que ve). */
export async function explorarBiblioteca(input: { carpeta: string | null; q?: string; pagina?: number }): Promise<Explorado> {
  const { yo, gestiona } = await contexto();
  const carpetas = await todasLasCarpetas();
  const asignadas = gestiona ? [] : (await db.select({ id: mediaFolderAccess.folderId }).from(mediaFolderAccess).where(eq(mediaFolderAccess.userId, yo.id))).map((r) => r.id);
  const visibles = carpetasVisibles(carpetas, asignadas, gestiona);
  const carpeta = input.carpeta && typeof input.carpeta === "string" ? input.carpeta : null;
  if (carpeta && !visibles.has(carpeta)) return { ok: false, error: SIN_ACCESO };
  // La raíz solo tiene archivos propios para quien gestiona.
  if (!carpeta && !gestiona && !input.q) return { ok: true, gestiona, carpetas: carpetas.filter((c) => visibles.has(c.id)), activos: [], hayMas: false };

  const q = typeof input.q === "string" ? input.q.trim().slice(0, 80) : "";
  const donde = q
    ? and(ilike(mediaAssets.name, comoLiteral(q)), gestiona ? undefined : inArray(mediaAssets.folderId, [...visibles].length ? [...visibles] : ["00000000-0000-0000-0000-000000000000"]))
    : carpeta
      ? eq(mediaAssets.folderId, carpeta)
      : isNull(mediaAssets.folderId);
  const limite = q ? MAX_BUSQUEDA : MAX_ACTIVOS;
  // Una carpeta con miles de imágenes (las de las notas) se lee por páginas de 200.
  const desde = q ? 0 : Math.max(0, Math.min(Math.floor(Number(input.pagina) || 0), 1000)) * limite;
  const filas = await db
    .select({ id: mediaAssets.id, name: mediaAssets.name, url: mediaAssets.url, kind: mediaAssets.kind, bytes: mediaAssets.bytes, folderId: mediaAssets.folderId, createdAt: mediaAssets.createdAt })
    .from(mediaAssets)
    .where(donde)
    .orderBy(desc(mediaAssets.createdAt), asc(mediaAssets.id))
    .limit(limite + 1)
    .offset(desde);
  const nombre = new Map(carpetas.map((c) => [c.id, c.name]));
  return {
    ok: true,
    gestiona,
    carpetas: carpetas.filter((c) => visibles.has(c.id)),
    activos: filas.slice(0, limite).map((f) => ({ ...f, carpeta: f.folderId ? (nombre.get(f.folderId) ?? null) : null, createdAt: f.createdAt.toISOString() })),
    hayMas: filas.length > limite,
  };
}

export async function crearCarpeta(input: { parentId: string | null; name: string }): Promise<Resultado & { id?: string }> {
  const yo = await gestor();
  const name = nombreValido(input.name);
  if (!name) return { ok: false, error: "Escribe un nombre para la carpeta (hasta 120 letras)." };
  const parentId = input.parentId || null;
  const carpetas = await todasLasCarpetas();
  if (parentId && !carpetas.some((c) => c.id === parentId)) return { ok: false, error: "La carpeta de destino ya no existe." };
  if (carpetas.some((c) => c.parentId === parentId && c.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: `Ya hay una carpeta llamada «${name}» ahí.` };
  const [f] = await db.insert(mediaFolders).values({ parentId, name, createdBy: yo.id }).returning({ id: mediaFolders.id });
  return { ok: true, id: f.id };
}

export async function renombrarCarpeta(input: { id: string; name: string }): Promise<Resultado> {
  await gestor();
  const name = nombreValido(input.name);
  if (!name) return { ok: false, error: "Escribe un nombre para la carpeta (hasta 120 letras)." };
  const carpetas = await todasLasCarpetas();
  const actual = carpetas.find((c) => c.id === input.id);
  if (!actual) return { ok: false, error: "La carpeta ya no existe." };
  if (carpetas.some((c) => c.id !== actual.id && c.parentId === actual.parentId && c.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: `Ya hay una carpeta llamada «${name}» ahí.` };
  await db.update(mediaFolders).set({ name }).where(eq(mediaFolders.id, actual.id));
  return { ok: true };
}

/** Mueve una carpeta (con todo lo que tiene dentro) a otra, o a la raíz. No se puede meter una carpeta dentro de sí misma. */
export async function moverCarpeta(input: { id: string; parentId: string | null }): Promise<Resultado> {
  await gestor();
  const carpetas = await todasLasCarpetas();
  const actual = carpetas.find((c) => c.id === input.id);
  if (!actual) return { ok: false, error: "La carpeta ya no existe." };
  const destino = input.parentId || null;
  if (destino && !carpetas.some((c) => c.id === destino)) return { ok: false, error: "La carpeta de destino ya no existe." };
  if (destino && estaDentroDe(carpetas, destino, actual.id)) return { ok: false, error: "Una carpeta no puede ir dentro de sí misma." };
  if (carpetas.some((c) => c.id !== actual.id && c.parentId === destino && c.name.toLowerCase() === actual.name.toLowerCase())) return { ok: false, error: `Ya hay una carpeta llamada «${actual.name}» en el destino.` };
  await db.update(mediaFolders).set({ parentId: destino }).where(eq(mediaFolders.id, actual.id));
  return { ok: true };
}

/** Solo se borra una carpeta vacía: así nadie pierde imágenes sin querer. */
export async function eliminarCarpeta(input: { id: string }): Promise<Resultado> {
  await gestor();
  const [{ hijas }] = await db.select({ hijas: sql<number>`count(*)::int` }).from(mediaFolders).where(eq(mediaFolders.parentId, input.id));
  const [{ archivos }] = await db.select({ archivos: sql<number>`count(*)::int` }).from(mediaAssets).where(eq(mediaAssets.folderId, input.id));
  if (hijas > 0 || archivos > 0) return { ok: false, error: "La carpeta no está vacía: mueve o borra primero lo que tiene dentro." };
  await db.delete(mediaFolders).where(eq(mediaFolders.id, input.id));
  return { ok: true };
}

const EXT_IMAGEN = /\.(jpe?g|png|webp|avif|gif)$/i;
const EXT_VIDEO = /\.(mp4|webm)$/i;

/** Deja en la biblioteca archivos que YA se subieron al almacenamiento (la subida la hace `subirMedia`, que valida el tipo por su firma). */
export async function registrarActivos(input: { carpeta: string | null; archivos: { url: string; name: string; bytes?: number }[] }): Promise<Resultado & { agregados?: number }> {
  const yo = await gestor();
  const base = urlPublicaMedia("");
  if (!base) return { ok: false, error: "Falta configurar el almacenamiento de imágenes en el servidor." };
  const carpeta = input.carpeta || null;
  if (carpeta && !(await todasLasCarpetas()).some((c) => c.id === carpeta)) return { ok: false, error: "La carpeta de destino ya no existe." };
  const lote = (Array.isArray(input.archivos) ? input.archivos : []).slice(0, MAX_SUBIDA_LOTE);
  const filas = lote.flatMap((a) => {
    const url = typeof a.url === "string" ? a.url : "";
    // Solo direcciones del propio almacenamiento: la biblioteca no es un lugar para enlazar sitios ajenos.
    if (!url.startsWith(base) || url.length > 400) return [];
    const kind = EXT_IMAGEN.test(url) ? "imagen" : EXT_VIDEO.test(url) ? "video" : null;
    if (!kind) return [];
    const bytes = Number.isFinite(a.bytes) && (a.bytes as number) > 0 ? Math.round(a.bytes as number) : null;
    return [{ folderId: carpeta, name: nombreValido(a.name) ?? "Sin nombre", url, kind, bytes, uploadedBy: yo.id }];
  });
  if (!filas.length) return { ok: false, error: "No se pudo registrar ningún archivo." };
  const nuevos = await db.insert(mediaAssets).values(filas).onConflictDoNothing({ target: mediaAssets.url }).returning({ id: mediaAssets.id });
  return { ok: true, agregados: nuevos.length };
}

export async function moverActivos(input: { ids: string[]; carpeta: string | null }): Promise<Resultado> {
  await gestor();
  const carpeta = input.carpeta || null;
  if (carpeta && !(await todasLasCarpetas()).some((c) => c.id === carpeta)) return { ok: false, error: "La carpeta de destino ya no existe." };
  const ids = (Array.isArray(input.ids) ? input.ids : []).filter((x) => typeof x === "string").slice(0, 500);
  if (!ids.length) return { ok: false, error: "No elegiste ningún archivo." };
  await db.update(mediaAssets).set({ folderId: carpeta }).where(inArray(mediaAssets.id, ids));
  return { ok: true };
}

export async function renombrarActivo(input: { id: string; name: string }): Promise<Resultado> {
  await gestor();
  const name = nombreValido(input.name);
  if (!name) return { ok: false, error: "Escribe un nombre (hasta 120 letras)." };
  await db.update(mediaAssets).set({ name }).where(eq(mediaAssets.id, input.id));
  return { ok: true };
}

/** Quita archivos de la biblioteca. El archivo del almacenamiento se conserva mientras una nota lo use; si nadie lo usa, la limpieza lo retira a los 7 días. */
export async function eliminarActivos(input: { ids: string[] }): Promise<Resultado> {
  await gestor();
  const ids = (Array.isArray(input.ids) ? input.ids : []).filter((x) => typeof x === "string").slice(0, 500);
  if (!ids.length) return { ok: false, error: "No elegiste ningún archivo." };
  await db.delete(mediaAssets).where(inArray(mediaAssets.id, ids));
  return { ok: true };
}

/** Las personas a las que se puede dar acceso y a quiénes se les dio en esta carpeta. Administradores y quien gestiona ya lo ven todo, así que no aparecen. */
export async function accesosDeCarpeta(input: { carpeta: string }): Promise<{ ok: true; personas: Persona[]; asignadas: string[] } | { ok: false; error: string }> {
  await gestor();
  const [filas, dadas] = await Promise.all([
    db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(and(eq(users.active, true), inArray(users.role, ["redactor", "editor", "disenador"]))).orderBy(asc(users.name)),
    db.select({ id: mediaFolderAccess.userId }).from(mediaFolderAccess).where(eq(mediaFolderAccess.folderId, input.carpeta)),
  ]);
  return { ok: true, personas: filas, asignadas: dadas.map((d) => d.id) };
}

/** Deja exactamente estas personas con acceso a la carpeta (y a todo lo que hay dentro). */
export async function asignarCarpeta(input: { carpeta: string; userIds: string[] }): Promise<Resultado> {
  await gestor();
  if (!(await todasLasCarpetas()).some((c) => c.id === input.carpeta)) return { ok: false, error: "La carpeta ya no existe." };
  const pedidas = [...new Set((Array.isArray(input.userIds) ? input.userIds : []).filter((x) => typeof x === "string"))].slice(0, 200);
  const validas = pedidas.length ? (await db.select({ id: users.id }).from(users).where(and(inArray(users.id, pedidas), eq(users.active, true)))).map((u) => u.id) : [];
  await db.transaction(async (tx) => {
    await tx.delete(mediaFolderAccess).where(eq(mediaFolderAccess.folderId, input.carpeta));
    if (validas.length) await tx.insert(mediaFolderAccess).values(validas.map((userId) => ({ folderId: input.carpeta, userId })));
  });
  return { ok: true };
}

/** Ficha completa de una imagen: metadata del archivo, quién la subió y en qué notas se usó (con su periodista). */
export type FichaActivo = {
  name: string; url: string; kind: string; bytes: number | null; mime: string | null; creada: string; subidaPor: string | null;
  usos: { titulo: string; slug: string; estado: string; periodista: string | null; seccion: string | null; fecha: string | null; comoPortada: boolean }[];
};
export async function fichaActivo(input: { id: string }): Promise<{ ok: true; ficha: FichaActivo } | { ok: false; error: string }> {
  await gestor();
  const [a] = await db
    .select({ name: mediaAssets.name, url: mediaAssets.url, kind: mediaAssets.kind, bytes: mediaAssets.bytes, createdAt: mediaAssets.createdAt, por: users.name })
    .from(mediaAssets).leftJoin(users, eq(users.id, mediaAssets.uploadedBy)).where(eq(mediaAssets.id, input.id)).limit(1);
  if (!a) return { ok: false, error: "Esa imagen ya no existe." };
  const objeto = a.url.split("/object/public/media/")[1] ?? "";
  let mime: string | null = null;
  let bytes = a.bytes;
  try {
    const o = rowsOf<{ mime: string | null; size: string | null }>(
      await db.execute(sql`select metadata->>'mimetype' as mime, metadata->>'size' as size from storage.objects where bucket_id = 'media' and name = ${objeto} limit 1`),
    )[0];
    mime = o?.mime ?? null;
    if (!bytes && o?.size) bytes = Number(o.size);
  } catch { /* sin almacenamiento (pruebas locales) */ }
  const usos = rowsOf<{ titulo: string; slug: string; estado: string; periodista: string | null; seccion: string | null; fecha: string | null; portada: boolean }>(
    await db.execute(sql`
      select a.title as titulo, a.slug, a.status::text as estado, au.name as periodista, c.name as seccion,
             to_char(a.published_at, 'YYYY-MM-DD') as fecha, (a.cover_image_url = ${a.url}) as portada
      from articles a left join authors au on au.id = a.author_id left join categories c on c.id = a.category_id
      where a.cover_image_url = ${a.url} or (${objeto} <> '' and position(${objeto} in a.body) > 0)
      order by a.published_at desc nulls last limit 50`),
  );
  return {
    ok: true,
    ficha: {
      name: a.name, url: a.url, kind: a.kind, bytes, mime, creada: new Date(a.createdAt).toISOString(), subidaPor: a.por ?? null,
      usos: usos.map((u) => ({ titulo: u.titulo, slug: u.slug, estado: u.estado, periodista: u.periodista, seccion: u.seccion, fecha: u.fecha, comoPortada: !!u.portada })),
    },
  };
}
