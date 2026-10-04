"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";
import { enviarAviso, pushConfigurado } from "@/lib/push";
import { siteUrl } from "@/lib/utils";

export type AvisoState = { ok: boolean; message: string } | null;

/**
 * Envía un aviso de última hora a los suscriptores. Lo restringe a editores:
 * una notificación push llega al teléfono de cada lector y no se puede
 * retirar una vez enviada.
 */
export async function enviarAvisoUltimaHora(
  _prev: AvisoState,
  formData: FormData,
): Promise<AvisoState> {
  await requirePermiso("avisos");

  if (!pushConfigurado()) {
    return {
      ok: false,
      message:
        "Faltan las claves VAPID. Genera un par con `npx web-push generate-vapid-keys` y define NEXT_PUBLIC_VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY.",
    };
  }

  const articleId = String(formData.get("articleId") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const cuerpo = String(formData.get("cuerpo") ?? "").trim();
  if (!articleId) return { ok: false, message: "Elige la nota que quieres anunciar." };

  const [nota] = await db
    .select({ id: articles.id, slug: articles.slug, title: articles.title, excerpt: articles.excerpt, cover: articles.coverImageUrl })
    .from(articles)
    .where(and(eq(articles.id, articleId), eq(articles.status, "publicado")))
    .limit(1);
  if (!nota) return { ok: false, message: "La nota no existe o todavía no está publicada." };

  const res = await enviarAviso({
    titulo: titulo || nota.title,
    cuerpo: cuerpo || nota.excerpt,
    url: `${siteUrl(`/articulo/${nota.slug}`)}?utm_source=push&utm_medium=notificacion&utm_campaign=ultima-hora`,
    imagen: nota.cover && /^https?:\/\//i.test(nota.cover) ? nota.cover : null,
    tag: `nota-${nota.id.slice(0, 8)}`,
    urgente: true,
  });

  return {
    ok: true,
    message: `Enviado a ${res.enviados} navegador(es). ${res.caducados} suscripción(es) caducada(s) eliminada(s)${
      res.fallidos ? `, ${res.fallidos} con error` : ""
    }.`,
  };
}

/** Notas publicadas recientes, para elegir cuál anunciar. */
export async function notasRecientes() {
  await requirePermiso("avisos");
  return db
    .select({ id: articles.id, title: articles.title })
    .from(articles)
    .where(and(eq(articles.status, "publicado"), sql`${articles.publishedAt} <= now()`))
    .orderBy(desc(articles.publishedAt))
    .limit(20);
}
