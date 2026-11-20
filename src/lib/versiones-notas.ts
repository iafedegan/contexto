import "server-only";
import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/db";
import { articleActivity, articleVersions, articles, users } from "@/db/schema";
import { actual, atribuir, marcar, rechazar, type Cambio, type Version } from "@/lib/control-cambios";

/**
 * Versiones de una nota para el control de cambios (ver `control-cambios.ts`). Se guarda una foto cada vez que la nota pasa de una persona a otra
 * (al enviarla o devolverla), al publicarla y al aceptar los cambios. Lo que cambió entre una foto y la siguiente lo hizo quien tenía la nota.
 * Si la tabla aún no existe (migración 0044 sin aplicar), nada falla: simplemente no hay control de cambios.
 */
export type MotivoVersion = "envio" | "devolvio" | "publico" | "aceptado" | "corte" | "rechazo";

export async function guardarVersion(articleId: string, userId: string | null, motivo: MotivoVersion): Promise<void> {
  try {
    const [n] = await db.select({ title: articles.title, excerpt: articles.excerpt, body: articles.body }).from(articles).where(eq(articles.id, articleId)).limit(1);
    if (!n) return;
    const [ultima] = await db.select({ title: articleVersions.title, excerpt: articleVersions.excerpt, body: articleVersions.body }).from(articleVersions).where(eq(articleVersions.articleId, articleId)).orderBy(desc(articleVersions.createdAt)).limit(1);
    // Sin cambios desde la última foto no se guarda otra (salvo al aceptar, que marca el nuevo punto de partida).
    if (ultima && motivo !== "aceptado" && ultima.body === n.body && ultima.title === n.title && ultima.excerpt === n.excerpt) return;
    await db.insert(articleVersions).values({ articleId, userId, motivo, title: n.title, excerpt: n.excerpt, body: n.body });
  } catch (e) {
    console.warn("guardarVersion:", (e as Error)?.message ?? e);
  }
}

export type ControlDeCambios = {
  /** Hay al menos una versión: la nota ya pasó por más de una persona. */
  hay: boolean;
  /** Cuerpo y título actuales con los cambios marcados (`<ins>` / `<del>`). */
  cuerpo: string;
  titulo: string;
  cambios: Cambio[];
  /** Personas que hicieron cambios, en orden (el índice es su color). */
  personas: string[];
  desde: string | null;
};

// Versiones desde la última aceptación (la aceptación es el nuevo punto de partida), con su autor, más el estado actual si hay cambios sin foto.
async function cadena(articleId: string): Promise<{ versiones: (Version & { titulo: string })[]; desde: Date | null } | null> {
  const todas = await db
    .select({ id: articleVersions.id, motivo: articleVersions.motivo, title: articleVersions.title, body: articleVersions.body, createdAt: articleVersions.createdAt, quien: users.name })
    .from(articleVersions)
    .leftJoin(users, eq(users.id, articleVersions.userId))
    .where(eq(articleVersions.articleId, articleId))
    .orderBy(asc(articleVersions.createdAt));
  if (!todas.length) return null;
  let inicio = 0;
  todas.forEach((v, i) => {
    if (v.motivo === "aceptado") inicio = i;
  });
  const tramo = todas.slice(inicio);
  const [n] = await db.select({ title: articles.title, body: articles.body }).from(articles).where(eq(articles.id, articleId)).limit(1);
  if (!n) return null;
  const versiones: (Version & { titulo: string })[] = tramo.map((v, i) => ({ html: v.body, titulo: v.title, autor: i === 0 ? "" : v.quien ?? "Alguien", limpia: v.motivo === "rechazo" }));
  const ultima = tramo[tramo.length - 1];
  if (n.body !== ultima.body || n.title !== ultima.title) {
    // Lo que cambió después de la última foto lo hizo quien la editó después (según el registro de actividad).
    const [editor] = await db
      .select({ quien: users.name })
      .from(articleActivity)
      .innerJoin(users, eq(users.id, articleActivity.userId))
      .where(and(eq(articleActivity.articleId, articleId), inArray(articleActivity.tipo, ["edito"]), gt(articleActivity.ultima, ultima.createdAt)))
      .orderBy(desc(articleActivity.ultima))
      .limit(1);
    versiones.push({ html: n.body, titulo: n.title, autor: editor?.quien ?? "Quien la tiene ahora" });
  }
  return { versiones, desde: tramo[0].createdAt };
}

export async function controlDeCambios(articleId: string): Promise<ControlDeCambios> {
  try {
    const c = await cadena(articleId);
    if (!c) return { hay: false, cuerpo: "", titulo: "", cambios: [], personas: [], desde: null };
    const personas = [...new Set(c.versiones.slice(1).map((v) => v.autor))];
    const cuerpo = marcar(atribuir(c.versiones), personas);
    const titulo = marcar(atribuir(c.versiones.map((v) => ({ html: v.titulo, autor: v.autor, limpia: v.limpia }))), personas);
    const usadas = personas.filter((p) => cuerpo.lista.some((x) => x.autor === p) || titulo.lista.some((x) => x.autor === p));
    return { hay: true, cuerpo: cuerpo.html, titulo: titulo.html, cambios: cuerpo.lista, personas: usadas.length ? personas : [], desde: c.desde?.toISOString() ?? null };
  } catch (e) {
    console.warn("controlDeCambios:", (e as Error)?.message ?? e);
    return { hay: false, cuerpo: "", titulo: "", cambios: [], personas: [], desde: null };
  }
}

/** Deshace un cambio del cuerpo: guarda lo pendiente de quien la edita, aplica el rechazo y lo deja como versión «limpia» (sin rastro). */
export async function rechazarCambio(articleId: string, userId: string, idCambio: number): Promise<string | null> {
  const c = await cadena(articleId);
  if (!c) return null;
  const nuevo = rechazar(atribuir(c.versiones), idCambio);
  if (nuevo === actual(atribuir(c.versiones))) return null;
  await guardarVersion(articleId, userId, "corte");
  await db.update(articles).set({ body: nuevo, updatedAt: new Date() }).where(eq(articles.id, articleId));
  await guardarVersion(articleId, userId, "rechazo");
  return nuevo;
}
