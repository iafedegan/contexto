import "server-only";
import { registrarActividad } from "@/lib/actividad-notas";
import { palabrasCambiadas } from "@/lib/actividad-reglas";
import { revalidatePath } from "next/cache";
import { and, eq, gte, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { db, rowsOf as rowsDe } from "@/db";
import { agentDrafts, articles, authors, categories } from "@/db/schema";
import { embed } from "@/lib/embeddings";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import { auditArticle, SEO_MINIMO_PUBLICAR } from "@/lib/seo-audit";
import { emitir } from "@/lib/eventos";
import { slugify } from "@/lib/utils";
import { esDireccionDelTitulo, esSufijoDeFecha, slugLibre, SUFIJO_ANTIGUO } from "@/lib/slug-libre";
import { rutaDeNota } from "@/lib/ruta-nota";
import { versionAlCambiarDeManos } from "@/lib/versiones-notas";
import { redirects } from "@/db/schema";
import { autorDeUsuario } from "@/lib/user-authors";
import { invalidarCache, TAG_CONTENIDO } from "@/lib/data-cache";

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
  /** Crédito de la foto («Foto: Nombre / Medio»). Ausente = no tocar. */
  coverImageCaption?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
};

// Resultado de guardar un borrador: el id y la hora, o el motivo por el que no se guardó.
export type GuardadoResult = { ok: true; id: string; savedAt: string } | { ok: false; skipped?: boolean; error?: string; detalle?: string };

/**
 * Mientras la nota no haya salido nunca, su dirección sigue al título: el primer guardado automático puede ocurrir con un título provisional
 * («Congreso ganadero») y la nota salía con una dirección que no contaba de qué trata. Una dirección ajustada a mano (ya no coincide con el
 * título guardado) se respeta, y una nota publicada nunca cambia sola. Se llama ANTES de guardar el título nuevo.
 */
export async function direccionSigueAlTitulo(articleId: string, tituloNuevo: string) {
  const [a] = await db.select({ title: articles.title, slug: articles.slug, legacyPath: articles.legacyPath, publishedAt: articles.publishedAt }).from(articles).where(eq(articles.id, articleId)).limit(1);
  const base = slugify(tituloNuevo);
  if (!a || a.publishedAt || !base || base === slugify(a.title) || !esDireccionDelTitulo(a.slug, a.title)) return;
  const slug = await slugLibre(base, async (x) => (await db.select({ id: articles.id }).from(articles).where(and(eq(articles.slug, x), ne(articles.id, articleId))).limit(1)).length > 0);
  await db.update(articles).set({ slug, legacyPath: a.legacyPath ? a.legacyPath.replace(/[^/]*$/, slug) : null }).where(eq(articles.id, articleId));
}

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
    ...(input.coverImageCaption !== undefined ? { coverImageCaption: input.coverImageCaption?.trim().slice(0, 300) || null } : {}),
    metaTitle: input.metaTitle?.trim() || null,
    metaDescription: input.metaDescription?.trim() || null,
    tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
    updatedAt: sql`now()`,
  };
  try {
    if (input.id) {
      const [row] = await db.select({ status: articles.status, title: articles.title, excerpt: articles.excerpt, body: articles.body }).from(articles).where(eq(articles.id, input.id)).limit(1);
      if (!row) return { ok: false, error: "La nota ya no existe." };
      if (row.status !== "borrador" && row.status !== "en_revision") return { ok: false, skipped: true };
      await versionAlCambiarDeManos(input.id, userId);
      await direccionSigueAlTitulo(input.id, title);
      await db.update(articles).set(values).where(eq(articles.id, input.id));
      const cambio = palabrasCambiadas(`${row.title} ${row.excerpt} ${row.body}`, `${values.title} ${values.excerpt} ${values.body}`);
      if (cambio > 0) await registrarActividad(input.id, userId, "edito", cambio);
      revalidatePath("/panel/articulos");
      return { ok: true, id: input.id, savedAt: new Date().toISOString() };
    }
    const slug = await slugLibre(slugify(title) || slugify(`nota-${Date.now()}`), async (x) => (await db.select({ id: articles.id }).from(articles).where(eq(articles.slug, x)).limit(1)).length > 0);
    const [row] = await db.insert(articles).values({ ...values, slug, status: "borrador", createdBy: userId }).returning({ id: articles.id });
    await registrarActividad(row.id, userId, "creo");
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

// Descarta la caché de datos y las páginas afectadas por una o varias notas: portada, sitemap, feed y, de cada nota, su página, su categoría y su autor. Es el ÚNICO sitio que lo hace (el panel, Telegram y la publicación programada pasan por aquí).
// Solo «contenido» (listados de portada y secciones): nunca «ajustes» ni el marco del sitio, así las demás notas guardadas no se tocan.
export async function revalidarNotas(articleIds: string[]) {
  if (!articleIds.length) return;
  const filas = await db
    .select({ slug: articles.slug, legacyPath: articles.legacyPath, categorySlug: categories.slug, authorSlug: authors.slug })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .where(inArray(articles.id, articleIds));
  if (!filas.length) return;
  invalidarCache(TAG_CONTENIDO);
  revalidatePath("/");
  revalidatePath("/sitemap.xml");
  revalidatePath("/feed.xml");
  const rutas = new Set<string>();
  for (const a of filas) {
    rutas.add(`/articulo/${a.slug}`);
    if (a.legacyPath) rutas.add(a.legacyPath);
    if (a.categorySlug) rutas.add(`/categoria/${a.categorySlug}`);
    if (a.authorSlug) rutas.add(`/autor/${a.authorSlug}`);
  }
  for (const ruta of rutas) revalidatePath(ruta);
}

/**
 * Quita de las direcciones de las notas PUBLICADAS el sufijo al azar que se les ponía cuando el título ya existía (`…-mwp9bxru`). La nota
 * publicada se queda con la dirección limpia: si la ocupaba un borrador o una nota sin publicar (que nadie ve todavía), es ese el que pasa a
 * `…-2`; si la ocupa otra nota publicada, la limpia queda con número corto (`…-2`). La dirección vieja queda con una redirección 301 a la nueva.
 * Idempotente: sin notas con sufijo no hace nada. Lo corre el cron de cada 5 minutos y la publicación de cada nota.
 */
export async function limpiarSufijosDeDirecciones(soloIds?: string[]): Promise<{ desde: string; hasta: string }[]> {
  const cambios: { desde: string; hasta: string }[] = [];
  const candidatas = await db
    .select({ id: articles.id, slug: articles.slug, legacyPath: articles.legacyPath, categorySlug: categories.slug, createdAt: articles.createdAt })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(and(eq(articles.status, "publicado"), sql`${articles.slug} ~ '-[l-n][0-9a-z]{7}$'`, soloIds?.length ? inArray(articles.id, soloIds) : undefined));
  const existe = async (x: string, salvo: string) => (await db.select({ id: articles.id }).from(articles).where(and(eq(articles.slug, x), ne(articles.id, salvo))).limit(1)).length > 0;
  const cambiaRuta = (ruta: string | null, viejo: string, nuevo: string) => (ruta && ruta.endsWith(viejo) ? ruta.slice(0, -viejo.length) + nuevo : ruta);
  for (const n of candidatas) {
    // Solo el sufijo de fecha de verdad: una palabra final como «-lafaurie» o «-monteria» tiene la misma forma y NO se toca.
    if (!SUFIJO_ANTIGUO.test(n.slug) || !esSufijoDeFecha(n.slug, n.createdAt)) continue;
    const base = n.slug.replace(SUFIJO_ANTIGUO, "");
    if (!base) continue;
    const rutaVieja = rutaDeNota(n);
    const tocadas = [n.id];
    // Si la dirección limpia la tiene una nota SIN publicar, se le cede a la publicada: la otra pasa a la primera libre con número.
    const [duena] = await db.select({ id: articles.id, slug: articles.slug, legacyPath: articles.legacyPath, status: articles.status }).from(articles).where(and(eq(articles.slug, base), ne(articles.id, n.id))).limit(1);
    if (duena && duena.status !== "publicado") {
      const otra = await slugLibre(base, (x) => (x === base ? Promise.resolve(true) : existe(x, duena.id)));
      await db.update(articles).set({ slug: otra, legacyPath: cambiaRuta(duena.legacyPath, duena.slug, otra) }).where(eq(articles.id, duena.id));
    }
    const nuevo = await slugLibre(base, (x) => existe(x, n.id));
    const legacyNuevo = cambiaRuta(n.legacyPath, n.slug, nuevo);
    await db.update(articles).set({ slug: nuevo, legacyPath: legacyNuevo, updatedAt: sql`now()` }).where(eq(articles.id, n.id));
    const rutaNueva = rutaDeNota({ slug: nuevo, legacyPath: legacyNuevo, categorySlug: n.categorySlug });
    for (const desde of new Set([rutaVieja, `/articulo/${n.slug}`])) {
      if (desde === rutaNueva) continue;
      await db.insert(redirects).values({ fromPath: desde, toPath: rutaNueva, statusCode: 301 }).onConflictDoUpdate({ target: redirects.fromPath, set: { toPath: rutaNueva, statusCode: 301 } });
    }
    // La página vieja (ya generada) y la nueva se regeneran: la vieja pasa a redirigir. Si no hay contexto de Next (p. ej. un script), se omite:
    // la dirección ya quedó corregida en la base y la página se rehace en su próxima revalidación.
    try {
      revalidatePath(rutaVieja);
      revalidatePath(`/articulo/${n.slug}`);
      await revalidarNotas(tocadas);
    } catch {
      /* sin contexto de Next: nada que revalidar */
    }
    cambios.push({ desde: rutaVieja, hasta: rutaNueva });
  }
  return cambios;
}

/**
 * Deshace lo que la primera versión de `limpiarSufijosDeDirecciones` hizo por error: le quitó a notas legítimas su última palabra cuando tenía
 * la forma del sufijo («…-lafaurie», «…-monteria») y dejó una redirección de la dirección original a la recortada. Aquí se busca cada una de
 * esas redirecciones (creadas desde el 20 de noviembre de 2026), y si el final quitado NO era un sufijo de fecha, la nota vuelve a su dirección
 * original, se borran esas redirecciones y su «última edición» vuelve a su fecha de publicación. Repite por capas (el error pudo recortar dos
 * veces la misma dirección). Idempotente: cuando no queda nada que deshacer, no hace nada.
 */
export async function restaurarDireccionesRecortadas(): Promise<{ desde: string; hasta: string }[]> {
  const hechas: { desde: string; hasta: string }[] = [];
  for (let capa = 0; capa < 6; capa++) {
    const filas = rowsDe<{ from_path: string; to_path: string }>(
      await db.execute(sql`select from_path, to_path from redirects
        where created_at >= '2026-11-20' and status_code = 301 and from_path ~ '-[l-n][0-9a-z]{7}$' and from_path = to_path || substring(from_path from '-[l-n][0-9a-z]{7}$')`),
    );
    let enEstaCapa = 0;
    for (const r of filas) {
      const sufijo = r.from_path.slice(r.to_path.length);
      const ultimo = r.to_path.split("/").pop() ?? "";
      const [n] = await db
        .select({ id: articles.id, slug: articles.slug, legacyPath: articles.legacyPath, createdAt: articles.createdAt, categorySlug: categories.slug })
        .from(articles)
        .leftJoin(categories, eq(articles.categoryId, categories.id))
        .where(sql`(${articles.legacyPath} = ${r.to_path}) or (${articles.legacyPath} is null and ${articles.slug} = ${ultimo})`)
        .limit(1);
      if (!n || rutaDeNota(n) !== r.to_path) continue;
      const original = `${n.slug}${sufijo}`;
      if (esSufijoDeFecha(original, n.createdAt)) continue; // esa sí era una limpieza correcta
      const [ocupada] = await db.select({ id: articles.id }).from(articles).where(and(eq(articles.slug, original), ne(articles.id, n.id))).limit(1);
      if (ocupada) continue;
      const legacyOriginal = n.legacyPath ? `${n.legacyPath}${sufijo}` : null;
      await db.update(articles).set({ slug: original, legacyPath: legacyOriginal, updatedAt: sql`coalesce(${articles.publishedAt}, ${articles.createdAt})` }).where(eq(articles.id, n.id));
      await db.execute(sql`delete from redirects where to_path = ${r.to_path} and from_path in (${r.from_path}, ${`/articulo/${original}`})`);
      try {
        revalidatePath(r.to_path);
        revalidatePath(r.from_path);
        await revalidarNotas([n.id]);
      } catch {
        /* sin contexto de Next */
      }
      hechas.push({ desde: r.to_path, hasta: r.from_path });
      enEstaCapa++;
    }
    if (!enEstaCapa) break;
  }
  return hechas;
}

// Como `revalidarNotas`, para una sola nota.
export const revalidarNota = (articleId: string) => revalidarNotas([articleId]);

/**
 * Aprueba un borrador de IA: lo pasa de «pendiente» a «aprobado» y crea el artículo en BORRADOR (nunca publicado),
 * atribuido a quien aprueba. Todo en una transacción y con el estado reclamado en la propia sentencia (`UPDATE … WHERE
 * status = 'pendiente' RETURNING`): dos aprobaciones a la vez no pueden crear dos notas, porque solo una gana el reclamo
 * (antes la comprobación del estado y el cambio eran pasos separados; H-23). Devuelve el id de la nota o lanza si el
 * borrador ya no está pendiente.
 */
export async function aprobarBorradorCore(userId: string, draftId: string): Promise<string> {
  // Se resuelve ANTES de abrir la transacción: dentro de ella no debe usarse otra conexión (en PGlite, la de desarrollo,
  // una consulta ajena a la transacción espera a que esta termine y nunca terminaría).
  const authorId = await autorDeUsuario(userId); // la nota se firma con la ficha de quien aprueba, no con el sistema
  return db.transaction(async (tx) => {
    const [d] = await tx
      .update(agentDrafts)
      .set({ status: "aprobado", approvedBy: userId, approvedAt: sql`now()` })
      .where(and(eq(agentDrafts.id, draftId), eq(agentDrafts.status, "pendiente")))
      .returning();
    if (!d) throw new Error("Borrador no disponible.");

    const slug = await slugLibre(slugify(d.title) || slugify(`nota-${Date.now()}`), async (x) => (await tx.select({ id: articles.id }).from(articles).where(eq(articles.slug, x)).limit(1)).length > 0);

    const [article] = await tx
      .insert(articles)
      .values({
        slug,
        title: d.title,
        excerpt: d.excerpt,
        body: sanitizeArticleHtml(d.body),
        categoryId: d.suggestedCategoryId,
        status: "borrador",
        createdBy: userId, // atribución al editor humano
        authorId,
        originDraftId: d.id,
      })
      .returning({ id: articles.id });
    await tx.update(agentDrafts).set({ publishedArticleId: article.id }).where(eq(agentDrafts.id, draftId));
    return article.id;
  });
}

/** Solo una nota en borrador (o ya en revisión) pasa a revisión; sobre una publicada la sacaría del sitio. */
export async function enviarARevisionCore(articleId: string) {
  const [fila] = await db
    .update(articles)
    .set({ status: "en_revision", updatedAt: sql`now()` })
    .where(and(eq(articles.id, articleId), inArray(articles.status, ["borrador", "en_revision"])))
    .returning({ id: articles.id });
  if (!fila) throw new Error("Solo una nota en borrador puede enviarse a revisión.");
}

/**
 * Requisitos para que una nota salga al sitio: su imagen de portada y una puntuación SEO de al menos `SEO_MINIMO_PUBLICAR`. Se calcula
 * con la misma auditoría que ve el redactor en el asistente. Devuelve los motivos legibles si no se cumplen.
 */
export async function requisitosDePublicacion(articleId: string): Promise<{ ok: boolean; score: number; motivos: string[] }> {
  const [a] = await db
    .select({ title: articles.title, excerpt: articles.excerpt, body: articles.body, metaTitle: articles.metaTitle, metaDescription: articles.metaDescription, tags: articles.tags, coverImageUrl: articles.coverImageUrl, coverImageAlt: articles.coverImageAlt, autor: authors.name })
    .from(articles)
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!a) return { ok: false, score: 0, motivos: ["La nota ya no existe."] };
  const r = auditArticle({
    title: a.title,
    excerpt: a.excerpt,
    body: a.body,
    metaTitle: a.metaTitle ?? "",
    metaDescription: a.metaDescription ?? "",
    tags: a.tags ?? [],
    focus: a.tags?.[0] || a.title,
    coverImageUrl: a.coverImageUrl,
    coverImageAlt: a.coverImageAlt,
    authorName: a.autor ?? "",
  });
  const motivos: string[] = [];
  if (!a.coverImageUrl) motivos.push("falta la imagen de portada");
  if (r.score < SEO_MINIMO_PUBLICAR) {
    const fallan = r.items.filter((i) => !i.ok).slice(0, 3).map((i) => i.text);
    motivos.push(`el SEO está en ${r.score}/100 y se necesita ${SEO_MINIMO_PUBLICAR} o más${fallan.length ? ` (falta: ${fallan.join("; ")})` : ""}`);
  }
  return { ok: motivos.length === 0, score: r.score, motivos };
}

/** Lanza si la nota no cumple los requisitos de publicación. */
export async function exigirRequisitosDePublicacion(articleId: string) {
  const r = await requisitosDePublicacion(articleId);
  if (!r.ok) throw new Error(`No se puede publicar todavía: ${r.motivos.join(" y ")}.`);
}

/**
 * Las columnas se sirven en `/columna/<slug>`, igual que las del sitio anterior (no en `/articulo/<slug>`). Se hace dejando esa dirección como la de la
 * nota (`legacy_path`), que es la que usa todo el sitio para enlazarla. Solo si la nota es de la sección Columnas, aún no tiene dirección propia
 * y nadie más la usa.
 */
export async function asegurarRutaDeColumna(articleId: string) {
  await db.execute(sql`
    update articles a set legacy_path = '/columna/' || a.slug
    from categories c
    where a.id = ${articleId} and c.id = a.category_id and c.slug in ('columnas', 'columna')
      and a.legacy_path is null
      and not exists (select 1 from articles o where o.legacy_path = '/columna/' || a.slug)`);
}

// Publica una nota ya autorizada: cambia el estado, recalcula su embedding, revalida el sitio y avisa si es de última hora.
export async function publicarCore(articleId: string) {
  // Una nota que ya está publicada se actualiza sin volver a exigirle los requisitos; las demás los cumplen o no salen.
  const [actual] = await db.select({ status: articles.status }).from(articles).where(eq(articles.id, articleId)).limit(1);
  if (actual?.status !== "publicado") await exigirRequisitosDePublicacion(articleId);
  await db
    .update(articles)
    .set({ status: "publicado", publishedAt: sql`coalesce(${articles.publishedAt}, now())`, scheduledFor: null, updatedAt: sql`now()` })
    .where(eq(articles.id, articleId));
  await limpiarSufijosDeDirecciones([articleId]).catch(() => []);
  await asegurarRutaDeColumna(articleId);
  await reindexarNota(articleId);
  await revalidarNota(articleId);
  emitir("nota.publicada", { ids: [articleId] });
}

/** Programa la publicación; lanza si la fecha no es válida o ya pasó. */
export async function programarCore(articleId: string, isoDateTime: string) {
  const when = new Date(isoDateTime);
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now()) throw new Error("La fecha de programación debe ser futura.");
  await exigirRequisitosDePublicacion(articleId);
  await db.update(articles).set({ status: "programado", scheduledFor: when, updatedAt: sql`now()` }).where(eq(articles.id, articleId));
}

/** Retira la nota del sitio sin borrarla (estado «archivado») y refresca el sitio. */
export async function archivarCore(articleId: string) {
  await db.update(articles).set({ status: "archivado", updatedAt: sql`now()` }).where(eq(articles.id, articleId));
  await revalidarNota(articleId);
}

/**
 * Distintivos de la nota: «Última hora» (insignia, solo la más reciente) y «En vivo / en desarrollo» (etiqueta). Devuelve `false` si la nota ya no existe.
 * «Última hora» no está en el HTML guardado de ninguna nota (la pide el navegador a `/api/ultima-hora`): cambiarla solo renueva los
 * listados y borra de la red esa respuesta, sin regenerar notas. «En vivo» sí va en la página de la nota: esa (y solo esa) se renueva.
 */
export async function distintivosCore(articleId: string, d: { isBreaking?: boolean; isLive?: boolean }): Promise<boolean> {
  const set: { isBreaking?: boolean; isLive?: boolean } = {};
  if (typeof d.isBreaking === "boolean") set.isBreaking = d.isBreaking;
  if (typeof d.isLive === "boolean") set.isLive = d.isLive;
  if (!Object.keys(set).length) return true;
  const filas = await db.update(articles).set({ ...set, updatedAt: sql`now()` }).where(eq(articles.id, articleId)).returning({ id: articles.id });
  if (!filas.length) return false;
  if (set.isLive !== undefined) {
    await revalidarNota(articleId);
  } else {
    invalidarCache(TAG_CONTENIDO);
    revalidatePath("/");
    revalidatePath("/en");
  }
  return true;
}

/**
 * Fija la nota en la portada (0 = principal, 1 = secundaria) o la suelta (null). Las ya fijadas desde esa
 * posición se corren un lugar, igual que al arrastrar en /panel/portada.
 */
export async function fijarPortadaCore(articleId: string, posicion: number | null) {
  if (posicion === null) {
    await db.update(articles).set({ homePosition: null, homeStyle: null }).where(eq(articles.id, articleId));
  } else {
    await db.update(articles).set({ homePosition: sql`${articles.homePosition} + 1` })
      .where(and(isNotNull(articles.homePosition), gte(articles.homePosition, posicion), ne(articles.id, articleId)));
    await db.update(articles).set({ homePosition: posicion }).where(eq(articles.id, articleId));
  }
  invalidarCache();
  revalidatePath("/");
  revalidatePath("/panel/portada");
  await revalidarNota(articleId);
}

/** Dirección actual de una nota, tal como la ven los lectores. */
export async function direccionDeNota(articleId: string): Promise<{ ruta: string; publica: boolean } | null> {
  const [a] = await db
    .select({ slug: articles.slug, legacyPath: articles.legacyPath, categorySlug: categories.slug, publishedAt: articles.publishedAt })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(eq(articles.id, articleId))
    .limit(1);
  return a ? { ruta: rutaDeNota(a), publica: !!a.publishedAt } : null;
}

/**
 * Cambia la dirección de una nota (el último tramo; la sección se conserva). Si la nota ya salió alguna vez, la dirección anterior queda con
 * redirección 301 a la nueva, así no se rompen los enlaces compartidos ni los de buscadores.
 */
export async function cambiarDireccionCore(articleId: string, texto: string): Promise<{ ok: true; ruta: string } | { ok: false; error: string }> {
  const nuevo = slugify(texto);
  if (nuevo.length < 3) return { ok: false, error: "Escribe una dirección de al menos 3 letras o números." };
  const [a] = await db
    .select({ slug: articles.slug, legacyPath: articles.legacyPath, categorySlug: categories.slug, publishedAt: articles.publishedAt })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!a) return { ok: false, error: "La nota ya no existe." };
  const rutaVieja = rutaDeNota(a);
  const legacyNuevo = a.legacyPath ? a.legacyPath.replace(/[^/]*$/, nuevo) : null;
  const rutaNueva = rutaDeNota({ slug: nuevo, legacyPath: legacyNuevo, categorySlug: a.categorySlug });
  if (rutaNueva === rutaVieja && nuevo === a.slug) return { ok: true, ruta: rutaVieja };
  const ocupada = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(ne(articles.id, articleId), or(eq(articles.slug, nuevo), eq(articles.legacyPath, rutaNueva))))
    .limit(1);
  if (ocupada.length) return { ok: false, error: "Otra nota ya usa esa dirección. Prueba con otra." };
  const viejas = [...new Set([rutaVieja, `/articulo/${a.slug}`])].filter((r) => r !== rutaNueva);
  await db.transaction(async (tx) => {
    await tx.update(articles).set({ slug: nuevo, legacyPath: legacyNuevo, updatedAt: sql`now()` }).where(eq(articles.id, articleId));
    // La dirección nueva no puede redirigir a otra parte (volver a una anterior no debe crear un bucle).
    await tx.delete(redirects).where(inArray(redirects.fromPath, [rutaNueva, `/articulo/${nuevo}`]));
    if (!a.publishedAt) return;
    // Las redirecciones que llegaban a la anterior apuntan directo a la nueva: sin cadenas.
    await tx.update(redirects).set({ toPath: rutaNueva }).where(inArray(redirects.toPath, viejas));
    for (const desde of viejas) {
      await tx.insert(redirects).values({ fromPath: desde, toPath: rutaNueva, statusCode: 301 }).onConflictDoUpdate({ target: redirects.fromPath, set: { toPath: rutaNueva, statusCode: 301 } });
    }
  });
  for (const r of viejas) revalidatePath(r);
  await revalidarNotas([articleId]);
  return { ok: true, ruta: rutaNueva };
}
