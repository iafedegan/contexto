import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { newsletterEditions, newsletterSubscribers } from "@/db/schema";
import { sql } from "drizzle-orm";
import { requirePermiso } from "@/lib/auth";
import { getSelectableArticles } from "@/lib/newsletter/edition";
import { EditionEditor } from "./edition-editor";

// Se calcula en cada petición, nunca durante la compilación.
export const dynamic = "force-dynamic";
// Hasta cinco minutos: el envío por tandas puede tardar.
export const maxDuration = 300;

// Pantalla de una edición del boletín (exige el permiso «newsletter»).
export default async function EditionPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermiso("newsletter");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [edition] = await db.select().from(newsletterEditions).where(eq(newsletterEditions.id, id)).limit(1);
  if (!edition) notFound();
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(newsletterSubscribers)
    .where(sql`confirmed and unsubscribed_at is null`);
  const articles = await getSelectableArticles();
  return (
    <EditionEditor
      id={edition.id}
      status={edition.status}
      recipients={n}
      progress={{ delivered: edition.delivered, total: edition.total, failed: edition.failed }}
      initial={{ subject: edition.subject, preheader: edition.preheader, intro: edition.intro, articleSlugs: (edition.articleSlugs as string[]) ?? [] }}
      articles={articles.map((a) => ({ slug: a.slug, title: a.title, categoryName: a.categoryName, parentName: a.parentName, cover: a.coverImageUrl, publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null }))}
    />
  );
}
