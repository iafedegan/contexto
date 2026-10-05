/**
 * Vista previa editorial: muestra un artículo en CUALQUIER estado con el mismo
 * diseño del portal público.
 *
 * Dos formas de entrar, ninguna indexable:
 *  - con sesión del panel (`requireRole`), como antes;
 *  - con un token firmado y caducable en `?t=`, que es lo que permite a
 *    PageSpeed Insights auditar la nota ANTES de publicarla.
 * Está excluida del sitemap y bloqueada en robots.txt.
 */
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArticleDocument } from "@/app/(public)/_pages/articulo";
import { SiteShell } from "@/components/site-shell";
import { getSiteTheme } from "@/lib/site-theme";
import { getArticleForPreview } from "@/lib/content";
import { relatedContent } from "@/lib/search";
import { auth } from "@/lib/auth";
import { verifyPreviewToken } from "@/lib/preview-token";
import { redirect } from "next/navigation";

// Se calcula en cada petición, nunca durante la compilación.
export const dynamic = "force-dynamic";
// Título de la vista previa; no se indexa.
export const metadata: Metadata = {
  title: "Vista previa",
  robots: { index: false, follow: false },
};

const ESTADO: Record<string, string> = {
  borrador: "Borrador",
  en_revision: "En revisión",
  programado: "Programado",
  publicado: "Publicado",
  archivado: "Archivado",
};

export default async function VistaPreviaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;

  if (!verifyPreviewToken(id, t)) {
    const session = await auth();
    if (!session?.user) redirect(`/panel/login?next=/vista-previa/${id}`);
  }
  const a = await getArticleForPreview(id).catch(() => null);
  if (!a) notFound();

  const [related, site] = await Promise.all([
    relatedContent(a.title, a.id, 4, a.categorySlug).catch(() => []),
    getSiteTheme(),
  ]);

  return (
    <SiteShell theme={site.theme} style={site.style} locale="es" variant="articulo">
      <div className="mb-8 flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--accent)]/40 bg-[var(--surface-2)] px-4 py-3 text-sm">
        <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent-fg)]">
          Vista previa
        </span>
        <span className="text-[var(--fg-muted)]">
          Estado: {ESTADO[a.status] ?? a.status}. Así se verá una vez publicado; esta dirección no es
          pública ni la indexan los buscadores.
        </span>
        <a
          href={`/panel/articulos/${a.id}`}
          className="ml-auto font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
        >
          Volver al editor
        </a>
      </div>
      <ArticleDocument a={a} related={related} locale="es" preview theme={site.parts.body} />
    </SiteShell>
  );
}
