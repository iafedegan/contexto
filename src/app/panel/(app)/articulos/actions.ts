"use server";

import { departamentoPorSlug, regionPorSlug } from "@/lib/regiones-colombia";
import { revalidatePath } from "next/cache";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, categories } from "@/db/schema";
import { canPublish, requirePermiso } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { autorDeUsuario } from "@/lib/user-authors";
import { archivarCore, distintivosCore, enviarARevisionCore, fijarPortadaCore, guardarBorradorCore, programarCore, publicarCore, reindexarNota, revalidarNota, type BorradorInput } from "@/lib/article-ops";
import { tienePermiso } from "@/lib/permisos-server";
import { avisarSiUltimaHora } from "@/lib/push";
import { invalidarCache } from "@/lib/data-cache";
import { esNotaPropia, exigirNotaPropia } from "@/lib/propiedad-notas";
import { asignacionDe, destinoActivo, quitarAsignacion, registrarAsignacion } from "@/lib/notas-asignadas";
import { puedeEnviarNota } from "@/lib/notas-asignadas-reglas";
import { piezaParaEscribir, vincularPieza } from "@/app/panel/(app)/pendientes/consultas";

// Variante para las acciones que responden con un mensaje en vez de lanzar.
const esNotaPropiaSegura = esNotaPropia;

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
  // «Enviar» (redactor → editor; editor o administrador → cualquier persona activa): se valida ANTES de guardar, para no dejar la nota a medias.
  const enviarA = String(formData.get("intent") ?? "") === "editor" ? String(formData.get("enviarA") ?? "") : "";
  if (enviarA && !puedeEnviarNota(user.role)) throw new Error("Tu rol no puede enviar notas a otra persona.");
  const editorDestino = enviarA ? await destinoActivo(user.role, user.id, enviarA) : null;
  if (enviarA && !editorDestino) throw new Error("Elige a una persona activa de la lista.");
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

  // Región de Colombia (`region-<slug>` dentro de `secciones`, junto a las demás secciones de la nota). Ausente = no tocar.
  // Otras secciones donde TAMBIÉN aparece la nota (`otras`: direcciones de sección separadas por comas) se guardan en el mismo arreglo. Ausente = no tocar.
  const regionForm = formData.get("region");
  const otrasForm = formData.get("otras");
  let secciones: string[] | undefined;
  if (regionForm !== null || otrasForm !== null) {
    const [prev] = id ? await db.select({ s: articles.secciones }).from(articles).where(eq(articles.id, id)).limit(1) : [];
    const previas = prev?.s ?? [];
    const esDato = (x: string) => x.startsWith("region-") || x.startsWith("depto-");
    let datos = previas.filter(esDato);
    let otras = previas.filter((x) => !esDato(x));
    if (regionForm !== null) {
      const quiere = regionPorSlug(String(regionForm))?.slug;
      // El departamento solo vale si pertenece a la región elegida.
      const d = departamentoPorSlug(String(formData.get("depto") ?? ""));
      const dep = d && d.region === quiere ? d.slug : undefined;
      datos = [...(quiere ? [`region-${quiere}`] : []), ...(dep ? [`depto-${dep}`] : [])];
    }
    if (otrasForm !== null) {
      const pedidas = [...new Set(String(otrasForm).split(",").map((x) => x.trim()).filter((x) => /^[a-z0-9-]+$/.test(x)))].slice(0, 12);
      // Solo secciones que existen, y no la principal (ya es de ella).
      const validas = pedidas.length ? await db.select({ id: categories.id, slug: categories.slug }).from(categories).where(inArray(categories.slug, pedidas)) : [];
      otras = validas.filter((c) => c.id !== categoryId).map((c) => c.slug);
    }
    secciones = [...otras, ...datos];
  }

  const values = {
    ...(secciones ? { secciones } : {}),
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
    await exigirNotaPropia(user, id);
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
  else if (intent === "editor" && editorDestino) {
    // Queda «En revisión» y le aparece al editor en «Artículos» y en «Notas para editores» (la nota cuenta como suya para revisarla).
    await enviarARevisionCore(articleId);
    await registrarAsignacion({ articleId, editorId: editorDestino.id, porId: user.id, mensaje: String(formData.get("mensajeEditor") ?? "").trim().slice(0, 600), fecha: new Date().toISOString() });
    revalidatePath("/panel/asignaciones");
  }
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

/**
 * Cancela el envío de una nota a otra persona: la nota deja de estar en su lista y, si estaba «En revisión» por ese envío, vuelve a borrador.
 * Lo puede hacer quien la envió y los administradores.
 */
export async function cancelarEnvio(articleId: string): Promise<{ ok: boolean; message: string }> {
  const user = await requirePermiso("articulos");
  const id = String(articleId ?? "");
  const envio = await asignacionDe(id);
  if (!envio) return { ok: false, message: "Esta nota no está enviada a nadie." };
  if (user.role !== "administrador" && envio.porId !== user.id) return { ok: false, message: "Solo quien la envió puede cancelar el envío." };
  await quitarAsignacion(id);
  await db.update(articles).set({ status: "borrador", updatedAt: sql`now()` }).where(and(eq(articles.id, id), eq(articles.status, "en_revision")));
  revalidatePath("/panel/asignaciones");
  revalidatePath("/panel/articulos");
  revalidatePath(`/panel/articulos/${id}`);
  return { ok: true, message: "Envío cancelado." };
}

// Pasa un borrador a revisión; sobre una nota publicada falla para no sacarla del sitio (la regla vive en `enviarARevisionCore`).
export async function submitForReview(articleId: string) {
  const user = await requirePermiso("articulos");
  await exigirNotaPropia(user, articleId);
  await enviarARevisionCore(articleId);
  revalidatePath(`/panel/articulos/${articleId}`);
}

// Publica una nota (exige permiso y rol de editor). Todo lo demás —estado, embedding, revalidación y el aviso push de «Última hora» por el evento nota.publicada— lo hace `publicarCore`, la misma máquina de estados que usa Telegram.
export async function publishArticle(articleId: string) {
  const user = await requirePublicador();
  await exigirNotaPropia(user, articleId);
  await publicarCore(articleId);
  revalidatePath(`/panel/articulos/${articleId}`);
}

// Programa la publicación de una nota para una fecha futura (la validación vive en `programarCore`).
export async function scheduleArticle(articleId: string, isoDateTime: string) {
  const user = await requirePublicador();
  await exigirNotaPropia(user, articleId);
  await programarCore(articleId, isoDateTime);
  revalidatePath(`/panel/articulos/${articleId}`);
}

// Archiva una nota para retirarla del sitio sin borrarla.
export async function unpublishArticle(articleId: string) {
  const user = await requirePublicador();
  await exigirNotaPropia(user, articleId);
  await archivarCore(articleId);
  revalidatePath(`/panel/articulos/${articleId}`);
}

/**
 * Pone o quita «Última hora» o «En desarrollo» (en vivo) de una nota desde la lista, sin abrir el editor.
 * Al activar «Última hora» en una nota ya publicada se avisa a los lectores por notificación (una sola vez por nota).
 */
export async function setArticleFlag(articleId: string, flag: "isBreaking" | "isLive", value: boolean): Promise<{ ok: boolean; message?: string }> {
  const user = await requirePublicador();
  if (!(await esNotaPropiaSegura(user, articleId))) return { ok: false, message: "Solo puedes modificar tus propias notas." };
  if (flag !== "isBreaking" && flag !== "isLive") return { ok: false, message: "Marca no válida." };
  if (!(await distintivosCore(articleId, { [flag]: value }))) return { ok: false, message: "Esa nota ya no existe." };
  if (flag === "isBreaking" && value) avisarSiUltimaHora(articleId); // solo avisa si está publicada y no se avisó antes
  revalidatePath("/panel/articulos");
  return { ok: true };
}

/**
 * Borra el artículo para siempre (sus lecturas diarias se van con él; un
 * borrador de IA que lo originó solo pierde el enlace). Quitarlo del sitio
 * sin perderlo es «archivar» (unpublishArticle).
 */
export async function deleteArticle(articleId: string): Promise<{ ok: boolean; message: string }> {
  const user = await requirePublicador();
  if (!(await esNotaPropiaSegura(user, articleId))) return { ok: false, message: "Solo puedes borrar tus propias notas." };
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
export async function autosaveDraft(input: BorradorInput & { piezaId?: string }): Promise<AutosaveResult> {
  const user = await requirePermiso("articulos");
  if (input.id) await exigirNotaPropia(user, input.id);
  const { piezaId, ...borrador } = input;
  // Una pieza del consejo que ya tiene nota (se reabrió el enlace): se sigue guardando en esa nota, no se crea otra.
  if (piezaId && !borrador.id) {
    const pieza = await piezaParaEscribir(user, piezaId).catch(() => null);
    if (pieza?.articleId) {
      await exigirNotaPropia(user, pieza.articleId);
      borrador.id = pieza.articleId;
    }
  }
  const r = await guardarBorradorCore(user.id, borrador);
  // Si la nota se escribe para una pieza del consejo, queda enlazada a ella.
  if (r.ok && piezaId) await vincularPieza(user, piezaId, r.id).catch(() => {});
  return r;
}
