import { lectorToken } from "@/lib/lectores-suscriptor";
import "server-only";
import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors, categories, newsletterEditions } from "@/db/schema";
import { getSiteIdentity } from "@/lib/site-identity";
import { getNewsletterSettings } from "@/lib/newsletter/settings";
import { renderNewsletterHtml, renderNewsletterText, type EmailArticle } from "@/lib/newsletter/template";
import { unsubscribeToken } from "@/lib/newsletter/token";
import type { Outgoing } from "@/lib/newsletter/send";
import { siteUrl } from "@/lib/utils";

// Contenido editable de una edición: asunto, texto previo, introducción y notas elegidas.
export type EditionContent = { subject: string; preheader: string; intro: string; articleSlugs: string[] };

// Condición SQL: nota publicada y ya vigente.
const published = and(eq(articles.status, "publicado"), lte(articles.publishedAt, sql`now()`));

/** Notas publicadas para el selector del editor: las 40 más recientes. */
export async function getSelectableArticles() {
  return db
    .select({
      slug: articles.slug,
      title: articles.title,
      excerpt: articles.excerpt,
      coverImageUrl: articles.coverImageUrl,
      categoryName: categories.name,
      publishedAt: articles.publishedAt,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(published)
    .orderBy(desc(articles.publishedAt))
    .limit(40);
}

/** Las notas elegidas, en el orden elegido (la primera es la destacada). */
export async function loadEmailArticles(slugs: string[]): Promise<EmailArticle[]> {
  if (slugs.length === 0) return [];
  const rows = await db
    .select({
      slug: articles.slug,
      title: articles.title,
      excerpt: articles.excerpt,
      coverImageUrl: articles.coverImageUrl,
      categoryName: categories.name,
      authorName: authors.name,
      publishedAt: articles.publishedAt,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .where(and(published, inArray(articles.slug, slugs)));
  const by = new Map(rows.map((r) => [r.slug, r]));
  return slugs.flatMap((s) => (by.has(s) ? [by.get(s)!] : []));
}

/** Número de la próxima edición (las enviadas o en curso + 1). */
export async function nextIssueNumber(): Promise<number> {
  const [row] = await db.select({ max: sql<number>`coalesce(max(${newsletterEditions.issue}), 0)::int` }).from(newsletterEditions);
  return (row?.max ?? 0) + 1;
}

// Asunto completo: el prefijo configurado seguido del asunto de la edición.
export function fullSubject(prefix: string, subject: string): string {
  const p = prefix.trim();
  return p ? `${p} ${subject}` : subject;
}

/** Datos comunes para pintar el correo de una edición. */
export async function prepareRender(content: EditionContent, issue: number | null) {
  const [settings, identity, list] = await Promise.all([
    getNewsletterSettings(),
    getSiteIdentity(),
    loadEmailArticles(content.articleSlugs),
  ]);
  return { settings, identity, list, issue, content };
}

// Edición ya preparada para dibujar y enviar.
export type Prepared = Awaited<ReturnType<typeof prepareRender>>;

/** El correo de UN lector (enlace de baja propio) o una prueba/vista previa (`subscriberId` null). */
export function buildMessage(p: Prepared, to: string, subscriberId: string | null, isTest = false, autorizoLectura = false): Outgoing {
  const unsub = subscriberId
    ? siteUrl(`/boletin/baja?s=${subscriberId}&t=${unsubscribeToken(subscriberId)}`)
    : siteUrl("/boletin/baja");
  const subject = fullSubject(p.settings.subjectPrefix, p.content.subject);
  const input = {
    siteName: p.identity.name,
    settings: p.settings,
    subject: p.content.subject,
    preheader: p.content.preheader,
    intro: p.content.intro,
    articles: p.list,
    issue: p.issue,
    unsubscribeUrl: unsub,
    // Solo quien autorizó expresamente que se relacione su lectura recibe enlaces con su firma.
    ...(autorizoLectura && subscriberId ? { lector: { id: subscriberId, token: lectorToken(subscriberId) } } : {}),
    isTest,
  };
  return {
    to,
    subject: isTest ? `[Prueba] ${subject}` : subject,
    html: renderNewsletterHtml(input),
    text: renderNewsletterText(input),
    // Baja con un clic desde el propio cliente de correo (Gmail, Apple Mail…):
    // hoy es requisito de los grandes proveedores para envíos masivos.
    ...(subscriberId
      ? {
          headers: {
            "List-Unsubscribe": `<${siteUrl(`/api/boletin/baja?s=${subscriberId}&t=${unsubscribeToken(subscriberId)}`)}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }
      : {}),
  };
}
