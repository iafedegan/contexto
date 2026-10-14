import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { newsletterEditions } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";
import { getSelectableArticles } from "@/lib/newsletter/edition";
import { EditionEditor } from "./edition-editor";
import { getNewsletterSettings } from "@/lib/newsletter/settings";
import { contarAudiencia, opcionesAudiencia } from "@/lib/newsletter/audiencia";
import { sanitizarAudiencia } from "@/lib/newsletter/audiencia-tipos";
import { itemsDeSlugs, sanitizarItems } from "@/lib/newsletter/items";

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
  // A quién va: los filtros guardados en la edición y cuántas personas cumplen cada opción.
  const audiencia = sanitizarAudiencia(edition.audience);
  const [n, opciones, articles, ajustes] = await Promise.all([contarAudiencia(audiencia), opcionesAudiencia(), getSelectableArticles(), getNewsletterSettings()]);
  // Una edición anterior a las secciones solo tiene la lista plana de notas.
  const conSecciones = sanitizarItems(edition.items);
  const itemsIniciales = conSecciones.length > 0 ? conSecciones : itemsDeSlugs(sanitizarItems(((edition.articleSlugs as string[]) ?? []).map((slug) => ({ t: "n", slug }))).flatMap((i) => (i.t === "n" ? [i.slug] : [])));
  return (
    <EditionEditor
      diseno={{ ...ajustes.design, acento: ajustes.accentColor }}
      puedeDisenar
      id={edition.id}
      status={edition.status}
      programadaPara={edition.scheduledFor ? edition.scheduledFor.toISOString() : null}
      recipients={n}
      audiencia={audiencia}
      opciones={opciones}
      progress={{ delivered: edition.delivered, total: edition.total, failed: edition.failed }}
      initial={{ subject: edition.subject, preheader: edition.preheader, intro: edition.intro, items: itemsIniciales }}
      articles={articles.map((a) => ({ slug: a.slug, title: a.title, categoryName: a.categoryName, parentName: a.parentName, cover: a.coverImageUrl, publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null, esUltimaHora: a.esUltimaHora }))}
    />
  );
}
