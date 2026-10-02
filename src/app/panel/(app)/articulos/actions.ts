"use server";

import { revalidatePath } from "next/cache";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors, categories } from "@/db/schema";
import { canPublish, requirePermiso } from "@/lib/auth";
import { embed } from "@/lib/embeddings";
import { slugify } from "@/lib/utils";
import { autorDeUsuario } from "@/lib/user-authors";
import { guardarBorradorCore, type BorradorInput } from "@/lib/article-ops";

/** Recalcula y persiste el embedding del artículo (= reindexación para el asistente). */
async function reindex(articleId: string) {
  const [a] = await db
    .select({ title: articles.title, excerpt: articles.excerpt, body: articles.body })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!a) return;
  const vec = await embed(`${a.title}\n\n${a.excerpt}\n\n${a.body.replace(/<[^>]+>/g, " ").slice(0, 6000)}`);
  if (vec) await db.update(articles).set({ embedding: vec }).where(eq(articles.id, articleId));
}

async function revalidateArticle(articleId: string) {
  const [a] = await db
    .select({
      slug: articles.slug,
      categorySlug: categories.slug,
      authorSlug: authors.slug,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!a) return;
  revalidatePath("/");
  revalidatePath("/sitemap.xml");
  revalidatePath("/feed.xml");
  revalidatePath(`/articulo/${a.slug}`);
  if (a.categorySlug) revalidatePath(`/categoria/${a.categorySlug}`);
  if (a.authorSlug) revalidatePath(`/autor/${a.authorSlug}`);
}

export async function saveArticle(formData: FormData) {
  const user = await requirePermiso("articulos");
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const body = sanitizeArticleHtml(String(formData.get("body") ?? ""));
  const categoryId = (formData.get("categoryId") as string) || null;
  // La firma es siempre quien escribe: si la nota no tiene autor, es la persona con sesión iniciada.
  const authorId = ((formData.get("authorId") as string) || null) ?? (await autorDeUsuario(user.id));
  const isBreaking = String(formData.get("isBreaking") ?? "0") === "1";
  const isLive = String(formData.get("isLive") ?? "0") === "1";
  const coverImageUrl = String(formData.get("coverImageUrl") ?? "").trim() || null;
  const coverImageAlt = String(formData.get("coverImageAlt") ?? "").trim() || null;
  const metaTitle = String(formData.get("metaTitle") ?? "").trim() || null;
  const metaDescription = String(formData.get("metaDescription") ?? "").trim() || null;
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (!title || !excerpt) throw new Error("Título y resumen son obligatorios.");

  const values = {
    title,
    excerpt,
    body,
    categoryId,
    authorId,
    coverImageUrl,
    coverImageAlt,
    isBreaking,
    isLive,
    metaTitle,
    metaDescription,
    tags,
    updatedAt: sql`now()`,
  };

  let articleId = id;
  if (id) {
    await db.update(articles).set(values).where(eq(articles.id, id));
  } else {
    const [row] = await db
      .insert(articles)
      .values({
        ...values,
        slug: slugify(title) || slugify(`nota-${Date.now()}`),
        status: "borrador",
        createdBy: user.id,
      })
      .returning({ id: articles.id });
    articleId = row.id;
  }

  await reindex(articleId);
  // Los distintivos (última hora, directo) salen en la cabecera y en las
  // tarjetas de todo el portal, así que se refresca el layout completo.
  revalidatePath("/", "layout");
  revalidatePath("/panel/articulos");
  // El asistente paso a paso puede, además de guardar, publicar o enviar a
  // revisión en el mismo clic (el permiso se comprueba dentro de cada acción).
  const intent = String(formData.get("intent") ?? "");
  if (intent === "publicar") await publishArticle(articleId);
  else if (intent === "revision") await submitForReview(articleId);
  else if (intent === "programar") {
    // «YYYY-MM-DDTHH:mm» llega en hora de Colombia (UTC-5, sin horario de verano).
    const v = String(formData.get("programarPara") ?? "");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) throw new Error("Elige la fecha y la hora de publicación.");
    await scheduleArticle(articleId, new Date(`${v}:00-05:00`).toISOString());
  }

  // Desde el asistente se vuelve al asistente, en su vista previa.
  const desde = String(formData.get("desde") ?? "");
  if (desde === "ia" || desde === "manual") {
    redirect(`/panel/articulos/${articleId}?modo=${desde}&paso=vista&guardado=${intent || "borrador"}`);
  }
  redirect(`/panel/articulos/${articleId}?guardado=1`);
}

export async function submitForReview(articleId: string) {
  await requirePermiso("articulos");
  await db
    .update(articles)
    .set({ status: "en_revision", updatedAt: sql`now()` })
    .where(eq(articles.id, articleId));
  revalidatePath(`/panel/articulos/${articleId}`);
}

export async function publishArticle(articleId: string) {
  const user = await requirePermiso("publicar");
  if (!canPublish(user.role)) throw new Error("Rol sin permiso de publicación.");

  await db
    .update(articles)
    .set({
      status: "publicado",
      publishedAt: sql`coalesce(${articles.publishedAt}, now())`,
      scheduledFor: null,
      updatedAt: sql`now()`,
    })
    .where(eq(articles.id, articleId));

  await reindex(articleId);
  await revalidateArticle(articleId);
  revalidatePath(`/panel/articulos/${articleId}`);
}

export async function scheduleArticle(articleId: string, isoDateTime: string) {
  await requirePermiso("publicar");
  const when = new Date(isoDateTime);
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now()) {
    throw new Error("La fecha de programación debe ser futura.");
  }
  await db
    .update(articles)
    .set({ status: "programado", scheduledFor: when, updatedAt: sql`now()` })
    .where(eq(articles.id, articleId));
  revalidatePath(`/panel/articulos/${articleId}`);
}

export async function unpublishArticle(articleId: string) {
  await requirePermiso("publicar");
  await db
    .update(articles)
    .set({ status: "archivado", updatedAt: sql`now()` })
    .where(eq(articles.id, articleId));
  await revalidateArticle(articleId);
  revalidatePath(`/panel/articulos/${articleId}`);
}

/**
 * Borra el artículo para siempre (sus lecturas diarias se van con él; un
 * borrador de IA que lo originó solo pierde el enlace). Quitarlo del sitio
 * sin perderlo es «archivar» (unpublishArticle).
 */
export async function deleteArticle(articleId: string): Promise<{ ok: boolean; message: string }> {
  await requirePermiso("publicar");
  const [a] = await db.select({ id: articles.id }).from(articles).where(eq(articles.id, articleId)).limit(1);
  if (!a) return { ok: false, message: "Ese artículo ya no existe." };

  // Las rutas se invalidan ANTES: después ya no hay fila de la que leer slug, sección y autor.
  await revalidateArticle(articleId);
  await db.delete(articles).where(eq(articles.id, articleId));
  revalidatePath("/panel/articulos");
  revalidatePath("/panel");
  return { ok: true, message: "Artículo eliminado." };
}

export type AutosaveResult =
  | { ok: true; id: string; savedAt: string }
  | { ok: false; skipped?: boolean; error?: string };

/**
 * Autoguardado del asistente: crea o actualiza el BORRADOR a cada paso, sin redirigir ni publicar. La lógica está en
 * `guardarBorradorCore` (la comparte el bot de Telegram).
 */
export async function autosaveDraft(input: BorradorInput): Promise<AutosaveResult> {
  const user = await requirePermiso("articulos");
  return guardarBorradorCore(user.id, input);
}
