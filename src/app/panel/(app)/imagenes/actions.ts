"use server";

import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles, mediaAssets, mediaFolders } from "@/db/schema";
import { tienePermiso } from "@/lib/permisos-server";
import { nombreValido } from "@/lib/biblioteca-acceso";
import { urlPublicaMedia } from "@/lib/media-storage";
import { requirePermiso } from "@/lib/auth";
import { revalidarNotas } from "@/lib/article-ops";
import { cerrarPedido, disenadoresActivos, esDisenadorActivo, leerPedidos, registrarPedido } from "@/lib/imagenes-pedidas";
import { pedidoDeNota, urlDeImagenValida, type PedidoImagen } from "@/lib/imagenes-pedidas-reglas";

type Respuesta = { ok: boolean; message: string };

/** El estado del pedido de una nota y los diseñadores a los que se les puede pedir, para el paso «Imagen» del asistente de redacción. */
export async function estadoDelPedido(input: { articleId: string }): Promise<{ pedido: PedidoImagen | null; disenadores: { id: string; nombre: string }[] }> {
  await requirePermiso("articulos");
  const [lista, disenadores] = await Promise.all([leerPedidos(), disenadoresActivos()]);
  return { pedido: pedidoDeNota(lista, String(input.articleId)), disenadores };
}

/** Le pide al diseñador la imagen de portada de una nota. Pedir otra vez reemplaza el pedido anterior. No cambia la nota. */
export async function pedirImagen(input: { articleId: string; indicaciones: string; disenadorId: string }): Promise<Respuesta> {
  const yo = await requirePermiso("articulos");
  const articleId = String(input.articleId ?? "");
  const [nota] = await db.select({ id: articles.id }).from(articles).where(eq(articles.id, articleId)).limit(1);
  if (!nota) return { ok: false, message: "Guarda la nota primero para poder pedir su imagen." };
  const indicaciones = String(input.indicaciones ?? "").trim().slice(0, 1200);
  if (indicaciones.length < 10) return { ok: false, message: "Cuéntale al diseñador qué imagen necesitas (al menos una frase)." };
  const disenadorId = input.disenadorId ? String(input.disenadorId) : null;
  if (disenadorId && !(await esDisenadorActivo(disenadorId))) return { ok: false, message: "Elige un diseñador de la lista." };

  await registrarPedido({ articleId, porId: yo.id, disenadorId, indicaciones, estado: "pendiente", fecha: new Date().toISOString() });
  revalidatePath("/panel/imagenes");
  return { ok: true, message: "Pedido enviado. El diseñador lo verá en «Solicitud de imágenes»." };
}

/** Retira un pedido que sigue pendiente. */
export async function cancelarPedido(input: { articleId: string }): Promise<Respuesta> {
  await requirePermiso("articulos");
  const hecho = await cerrarPedido(String(input.articleId), { estado: "cancelada" });
  revalidatePath("/panel/imagenes");
  return hecho ? { ok: true, message: "Pedido cancelado." } : { ok: false, message: "Ese pedido ya no estaba pendiente." };
}

/** Las carpetas de la biblioteca donde puede quedar guardada la imagen entregada (solo quien gestiona la biblioteca elige carpeta). */
export async function carpetasDeEntrega(): Promise<{ gestiona: boolean; carpetas: { id: string; parentId: string | null; name: string }[] }> {
  const yo = await requirePermiso("articulos");
  const gestiona = await tienePermiso(yo.id, yo.role, "biblioteca");
  if (!gestiona) return { gestiona, carpetas: [] };
  const carpetas = await db.select({ id: mediaFolders.id, parentId: mediaFolders.parentId, name: mediaFolders.name }).from(mediaFolders).orderBy(asc(mediaFolders.name));
  return { gestiona, carpetas };
}

/**
 * El diseñador entrega la imagen: queda como portada de la nota con lo que necesita el buscador (texto alternativo y pie de foto con
 * crédito), se guarda en la carpeta de la biblioteca que elija y el pedido se cierra. Si la nota ya está publicada, se actualiza
 * también el sitio.
 */
export async function entregarImagen(input: { articleId: string; url: string; alt: string; pie?: string; nombre?: string; carpetaId?: string | null; bytes?: number }): Promise<Respuesta> {
  const yo = await requirePermiso("imagenes");
  const url = String(input.url ?? "").trim();
  if (!urlDeImagenValida(url)) return { ok: false, message: "Sube la imagen antes de entregarla." };
  const alt = String(input.alt ?? "").trim().slice(0, 300);
  if (alt.length < 10) return { ok: false, message: "Describe lo que se ve en la imagen (al menos 10 caracteres): Google la usa para entenderla." };
  const pie = String(input.pie ?? "").trim().slice(0, 300);
  const articleId = String(input.articleId ?? "");
  const [nota] = await db.select({ id: articles.id, estado: articles.status }).from(articles).where(eq(articles.id, articleId)).limit(1);
  if (!nota) return { ok: false, message: "La nota ya no existe." };

  // La carpeta de la biblioteca (solo quien gestiona la biblioteca): se comprueba ANTES de cerrar el pedido.
  const gestiona = await tienePermiso(yo.id, yo.role, "biblioteca");
  const carpetaId = gestiona && input.carpetaId ? String(input.carpetaId) : null;
  if (carpetaId) {
    const [c] = await db.select({ id: mediaFolders.id }).from(mediaFolders).where(eq(mediaFolders.id, carpetaId)).limit(1);
    if (!c) return { ok: false, message: "La carpeta elegida ya no existe." };
  }

  const cerrado = await cerrarPedido(articleId, { estado: "entregada", entregadaEn: new Date().toISOString(), entregadaPorId: yo.id, url, alt, pie });
  if (!cerrado) return { ok: false, message: "Ese pedido ya no estaba pendiente." };
  await db
    .update(articles)
    .set({ coverImageUrl: url, coverImageAlt: alt, coverImageCaption: pie || null, updatedAt: new Date() })
    .where(eq(articles.id, articleId));

  // Queda registrada en la biblioteca, en la carpeta elegida y con un nombre que se entienda (solo si es del propio almacenamiento).
  const base = urlPublicaMedia("");
  if (gestiona && base && url.startsWith(base) && url.length <= 400) {
    const nombre = nombreValido(input.nombre) ?? nombreValido(alt.slice(0, 100)) ?? "Imagen de portada";
    const bytes = Number.isFinite(input.bytes) && (input.bytes as number) > 0 ? Math.round(input.bytes as number) : null;
    await db
      .insert(mediaAssets)
      .values({ folderId: carpetaId, name: nombre, url, kind: "imagen", bytes, uploadedBy: yo.id })
      .onConflictDoUpdate({ target: mediaAssets.url, set: { folderId: carpetaId, name: nombre } });
    revalidatePath("/panel/biblioteca");
  }
  if (nota.estado === "publicado") await revalidarNotas([articleId]);
  revalidatePath("/panel/imagenes");
  return { ok: true, message: "Imagen entregada y puesta como portada de la nota." };
}
