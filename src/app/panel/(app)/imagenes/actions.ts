"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";
import { revalidarNotas } from "@/lib/article-ops";
import { cerrarPedido, disenadoresActivos, esDisenadorActivo, leerPedidos, registrarPedido } from "@/lib/imagenes-pedidas";
import { pedidoDeNota, puedeEntregarImagen, urlDeImagenValida, type PedidoImagen } from "@/lib/imagenes-pedidas-reglas";

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
  return { ok: true, message: "Pedido enviado. El diseñador lo verá en «Imágenes pedidas»." };
}

/** Retira un pedido que sigue pendiente. */
export async function cancelarPedido(input: { articleId: string }): Promise<Respuesta> {
  await requirePermiso("articulos");
  const hecho = await cerrarPedido(String(input.articleId), { estado: "cancelada" });
  revalidatePath("/panel/imagenes");
  return hecho ? { ok: true, message: "Pedido cancelado." } : { ok: false, message: "Ese pedido ya no estaba pendiente." };
}

/**
 * El diseñador entrega la imagen: queda como portada de la nota (con su texto alternativo) y el pedido se cierra. Si la nota ya está
 * publicada, se actualiza también el sitio.
 */
export async function entregarImagen(input: { articleId: string; url: string; alt: string }): Promise<Respuesta> {
  const yo = await requirePermiso("articulos");
  if (!puedeEntregarImagen(yo.role)) return { ok: false, message: "Solo los diseñadores entregan imágenes." };
  const url = String(input.url ?? "").trim();
  if (!urlDeImagenValida(url)) return { ok: false, message: "Sube la imagen antes de entregarla." };
  const articleId = String(input.articleId ?? "");
  const [nota] = await db.select({ id: articles.id, estado: articles.status }).from(articles).where(eq(articles.id, articleId)).limit(1);
  if (!nota) return { ok: false, message: "La nota ya no existe." };

  const cerrado = await cerrarPedido(articleId, { estado: "entregada", entregadaEn: new Date().toISOString(), entregadaPorId: yo.id, url });
  if (!cerrado) return { ok: false, message: "Ese pedido ya no estaba pendiente." };
  await db
    .update(articles)
    .set({ coverImageUrl: url, coverImageAlt: String(input.alt ?? "").trim().slice(0, 300) || null, updatedAt: new Date() })
    .where(eq(articles.id, articleId));
  if (nota.estado === "publicado") await revalidarNotas([articleId]);
  revalidatePath("/panel/imagenes");
  return { ok: true, message: "Imagen entregada y puesta como portada de la nota." };
}
