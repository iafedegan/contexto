"use server";

import { revalidatePath } from "next/cache";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { canPublish, requirePermiso } from "@/lib/auth";
import { avisarSiUltimaHora } from "@/lib/push";
import { slugify } from "@/lib/utils";
import { autorDeUsuario } from "@/lib/user-authors";
import { fijarPortadaCore, guardarBorradorCore, type BorradorInput } from "@/lib/article-ops";
import { tienePermiso } from "@/lib/permisos-server";
import { invalidarCache } from "@/lib/data-cache";
import { reindexarNota, revalidarNota } from "@/lib/article-ops";

/**
 * Quién puede publicar: rol de editor o superior Y permiso «publicar». Es el mismo criterio para
 * publicar, programar, despublicar y borrar; antes solo `publishArticle` lo exigía y un redactor
 * con el permiso concedido podía programar (y el cron publicarlo) o borrar.
 */
async function requirePublicador() {
  const user = await requirePermiso("publicar");
  if (!canPublish(user.role)) throw new Error("Rol sin permiso de publicación.");
  return user;
}

// Guarda una nota desde el formulario: sanea el cuerpo, impide editar notas publicadas a quien no puede publicar, recalcula su embedding y, si se pide, publica, envía a revisión o programa.
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
    // Una nota publicada o programada ya está (o va a estar) a la vista de los lectores: solo quien
    // puede publicar la modifica. Un redactor trabaja sobre borradores y revisión.
    const [actual] = await db.select({ status: articles.status }).from(articles).where(eq(articles.id, id)).limit(1);
    if (!actual) throw new Error("La nota ya no existe.");
    if (actual.status === "publicado" || actual.status === "programado") {
      const puedePublicar = canPublish(user.role) && (await tienePermiso(user.id, user.role, "publicar"));
      if (!puedePublicar) throw new Error("Esta nota ya está publicada o programada: solo un editor puede modificarla.");
    }
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

  await reindexarNota(articleId);
  // Lugar en la portada del sitio (solo con permiso «portada»; «keep» o ausente = no tocar).
  const portadaPos = String(formData.get("portadaPos") ?? "keep");
  if ((portadaPos === "0" || portadaPos === "1" || portadaPos === "none") && (await tienePermiso(user.id, user.role, "portada"))) {
    const [act] = await db.select({ pos: articles.homePosition }).from(articles).where(eq(articles.id, articleId)).limit(1);
    const quiere = portadaPos === "none" ? null : Number(portadaPos);
    if ((act?.pos ?? null) !== quiere) await fijarPortadaCore(articleId, quiere);
  }
  // Los distintivos (última hora, directo) salen en la cabecera y en las
  // tarjetas de todo el portal, así que se refresca el layout completo.
  invalidarCache();
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

// Pasa un borrador a revisión; sobre una nota publicada falla para no sacarla del sitio.
export async function submitForReview(articleId: string) {
  await requirePermiso("articulos");
  // Solo una nota en borrador (o ya en revisión) pasa a revisión: sobre una publicada la sacaría del sitio.
  const [fila] = await db
    .update(articles)
    .set({ status: "en_revision", updatedAt: sql`now()` })
    .where(and(eq(articles.id, articleId), inArray(articles.status, ["borrador", "en_revision"])))
    .returning({ id: articles.id });
  if (!fila) throw new Error("Solo una nota en borrador puede enviarse a revisión.");
  revalidatePath(`/panel/articulos/${articleId}`);
}

// Publica una nota (exige permiso y rol de editor): revalida el sitio y avisa a los lectores si es de última hora.
export async function publishArticle(articleId: string) {
  await requirePublicador();

  await db
    .update(articles)
    .set({
      status: "publicado",
      publishedAt: sql`coalesce(${articles.publishedAt}, now())`,
      scheduledFor: null,
      updatedAt: sql`now()`,
    })
    .where(eq(articles.id, articleId));

  await reindexarNota(articleId);
  await revalidarNota(articleId);
  revalidatePath(`/panel/articulos/${articleId}`);
  avisarSiUltimaHora(articleId);
}

// Programa la publicación de una nota para una fecha futura.
export async function scheduleArticle(articleId: string, isoDateTime: string) {
  await requirePublicador();
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

// Archiva una nota para retirarla del sitio sin borrarla.
export async function unpublishArticle(articleId: string) {
  await requirePublicador();
  await db
    .update(articles)
    .set({ status: "archivado", updatedAt: sql`now()` })
    .where(eq(articles.id, articleId));
  await revalidarNota(articleId);
  revalidatePath(`/panel/articulos/${articleId}`);
}

/**
 * Pone o quita «Última hora» o «En desarrollo» (en vivo) de una nota desde la lista, sin abrir el editor.
 * No envía la notificación push de última hora: ese aviso solo sale al publicar la nota.
 */
export async function setArticleFlag(articleId: string, flag: "isBreaking" | "isLive", value: boolean): Promise<{ ok: boolean; message?: string }> {
  await requirePublicador();
  if (flag !== "isBreaking" && flag !== "isLive") return { ok: false, message: "Marca no válida." };
  const res = await db.update(articles).set({ [flag]: value, updatedAt: sql`now()` }).where(eq(articles.id, articleId)).returning({ id: articles.id });
  if (res.length === 0) return { ok: false, message: "Esa nota ya no existe." };
  await revalidarNota(articleId);
  revalidatePath("/panel/articulos");
  return { ok: true };
}

/**
 * Borra el artículo para siempre (sus lecturas diarias se van con él; un
 * borrador de IA que lo originó solo pierde el enlace). Quitarlo del sitio
 * sin perderlo es «archivar» (unpublishArticle).
 */
export async function deleteArticle(articleId: string): Promise<{ ok: boolean; message: string }> {
  await requirePublicador();
  const [a] = await db.select({ id: articles.id }).from(articles).where(eq(articles.id, articleId)).limit(1);
  if (!a) return { ok: false, message: "Ese artículo ya no existe." };

  // Las rutas se invalidan ANTES: después ya no hay fila de la que leer slug, sección y autor.
  await revalidarNota(articleId);
  await db.delete(articles).where(eq(articles.id, articleId));
  revalidatePath("/panel/articulos");
  revalidatePath("/panel");
  return { ok: true, message: "Artículo eliminado." };
}

// Resultado del autoguardado: el id y la hora, o el motivo por el que no se guardó.
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
