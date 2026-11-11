"use server";

import { revalidatePath } from "next/cache";
import { requirePermiso } from "@/lib/auth";
import { puedeVerNota } from "@/lib/propiedad-notas";
import { agregarComentario, listarComentarios, marcarLeidos, MAX_CITA, MAX_COMENTARIO, type Comentario } from "@/lib/comentarios-notas";

type Respuesta = { ok: true; comentarios: Comentario[] } | { ok: false; message: string };
const SIN_ACCESO = "No tienes acceso a esta nota.";

/** Los comentarios de una nota; al abrirlos se dan por leídos. Solo para quien ve la nota. */
export async function comentariosDeNota(articleId: string): Promise<Respuesta> {
  const yo = await requirePermiso("articulos");
  const id = String(articleId ?? "");
  if (!(await puedeVerNota(yo, id))) return { ok: false, message: SIN_ACCESO };
  await marcarLeidos(id, yo.id);
  revalidatePath("/panel/articulos");
  return { ok: true, comentarios: await listarComentarios(id, yo.id) };
}

/** Deja un comentario en la nota y devuelve la conversación. Solo para quien ve la nota. */
export async function comentarNota(articleId: string, texto: string, cita?: string): Promise<Respuesta> {
  const yo = await requirePermiso("articulos");
  const id = String(articleId ?? "");
  if (!(await puedeVerNota(yo, id))) return { ok: false, message: SIN_ACCESO };
  const limpio = String(texto ?? "").trim();
  if (!limpio) return { ok: false, message: "Escribe el comentario." };
  if (limpio.length > MAX_COMENTARIO) return { ok: false, message: `El comentario es muy largo (máximo ${MAX_COMENTARIO} caracteres).` };
  // La cita es el fragmento seleccionado: texto plano, con los espacios normalizados y recortado.
  const fragmento = String(cita ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_CITA);
  await agregarComentario(id, yo.id, limpio, fragmento || null);
  revalidatePath("/panel/articulos");
  return { ok: true, comentarios: await listarComentarios(id, yo.id) };
}
