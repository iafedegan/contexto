import "server-only";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors, categories } from "@/db/schema";
import { embed } from "@/lib/embeddings";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import { slugify } from "@/lib/utils";
import { autorDeUsuario } from "@/lib/user-authors";

/**
 * Operaciones sobre notas SIN sesión de navegador ni permisos propios: quien las llama (las acciones del panel o el
 * bot de Telegram) debe haber comprobado ya el permiso. Un solo sitio para guardar, enviar a revisión, programar y
 * publicar, así el panel y Telegram hacen exactamente lo mismo.
 */

export type BorradorInput = {
  id?: string;
  title: string;
  excerpt: string;
  body: string;
  tags: string[];
  categoryId?: string | null;
  authorId?: string | null;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
};

export type GuardadoResult = { ok: true; id: string; savedAt: string } | { ok: false; skipped?: boolean; error?: string; detalle?: string };

/** Crea o actualiza el BORRADOR. Solo toca notas en borrador o en revisión (una publicada solo cambia con sus botones). */
export async function guardarBorradorCore(userId: string, input: BorradorInput): Promise<GuardadoResult> {
  const title = input.title.trim();
  if (title.length < 5) return { ok: false, skipped: true };
  const values = {
    title,
    excerpt: input.excerpt.trim(),
    body: sanitizeArticleHtml(input.body ?? ""),
    categoryId: input.categoryId || null,
    authorId: input.authorId || (await autorDeUsuario(userId)),
    coverImageUrl: input.coverImageUrl?.trim() || null,
    coverImageAlt: input.coverImageAlt?.trim() || null,
    metaTitle: input.metaTitle?.trim() || null,
    metaDescription: input.metaDescription?.trim() || null,
    tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
    updatedAt: sql`now()`,
  };
  try {
    if (input.id) {
      const [row] = await db.select({ status: articles.status }).from(articles).where(eq(articles.id, input.id)).limit(1);
      if (!row) return { ok: false, error: "La nota ya no existe." };
      if (row.status !== "borrador" && row.status !== "en_revision") return { ok: false, skipped: true };
      await db.update(articles).set(values).where(eq(articles.id, input.id));
      revalidatePath("/panel/articulos");
      return { ok: true, id: input.id, savedAt: new Date().toISOString() };
    }
    let slug = slugify(title) || slugify(`nota-${Date.now()}`);
    const [dup] = await db.select({ id: articles.id }).from(articles).where(eq(articles.slug, slug)).limit(1);
    if (dup) slug = `${slug}-${Date.now().toString(36)}`;
    const [row] = await db.insert(articles).values({ ...values, slug, status: "borrador", createdBy: userId }).returning({ id: articles.id });
    revalidatePath("/panel/articulos");
    return { ok: true, id: row.id, savedAt: new Date().toISOString() };
  } catch (err) {
    console.error("guardarBorradorCore:", err);
    return { ok: false, error: "No se pudo guardar.", detalle: String((err as Error)?.message ?? err).slice(0, 240) };
  }
}

/** Recalcula y persiste el embedding del artículo (= reindexación para el asistente). */
export async function reindexarNota(articleId: string) {
  const [a] = await db.select({ title: articles.title, excerpt: articles.excerpt, body: articles.body }).from(articles).where(eq(articles.id, articleId)).limit(1);
  if (!a) return;
  const vec = await embed(`${a.title}\n\n${a.excerpt}\n\n${a.body.replace(/<[^>]+>/g, " ").slice(0, 6000)}`);
  if (vec) await db.update(articles).set({ embedding: vec }).where(eq(articles.id, articleId));
}

export async function revalidarNota(articleId: string) {
  const [a] = await db
    .select({ slug: articles.slug, categorySlug: categories.slug, authorSlug: authors.slug })
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

export async function enviarARevisionCore(articleId: string) {
  await db.update(articles).set({ status: "en_revision", updatedAt: sql`now()` }).where(eq(articles.id, articleId));
}

export async function publicarCore(articleId: string) {
  await db
    .update(articles)
    .set({ status: "publicado", publishedAt: sql`coalesce(${articles.publishedAt}, now())`, scheduledFor: null, updatedAt: sql`now()` })
    .where(eq(articles.id, articleId));
  await reindexarNota(articleId);
  await revalidarNota(articleId);
}

/** Programa la publicación; lanza si la fecha no es válida o ya pasó. */
export async function programarCore(articleId: string, isoDateTime: string) {
  const when = new Date(isoDateTime);
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now()) throw new Error("La fecha de programación debe ser futura.");
  await db.update(articles).set({ status: "programado", scheduledFor: when, updatedAt: sql`now()` }).where(eq(articles.id, articleId));
}
