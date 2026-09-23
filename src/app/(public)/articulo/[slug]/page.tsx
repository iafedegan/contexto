import { notFound } from "next/navigation";
import { draftMode } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import {
  getAllPublishedSlugs,
  getArticleBySlugForPreview,
  getPublishedArticleBySlug,
} from "@/lib/content";
import { relatedContent } from "@/lib/search";
import { articleMetadata, breadcrumbJsonLd, newsArticleJsonLd } from "@/lib/seo";
import { formatDate } from "@/lib/utils";

export const revalidate = 3600;

type Params = { params: Promise<{ slug: string }> };

const STATUS_LABEL: Record<string, string> = {
  borrador: "Borrador",
  en_revision: "En revisión",
  programado: "Programado",
  publicado: "Publicado",
  archivado: "Archivado",
};

export async function generateStaticParams() {
  try {
    const slugs = await getAllPublishedSlugs();
    return slugs.map((s) => ({ slug: s.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const isDraft = (await draftMode()).isEnabled;
  const a = isDraft
    ? await getArticleBySlugForPreview(slug).catch(() => null)
    : await getPublishedArticleBySlug(slug).catch(() => null);
  if (!a) return { title: "Artículo no encontrado", robots: { index: false } };
  const meta = articleMetadata({ ...a, authorName: a.authorName, categoryName: a.categoryName });
  if (isDraft && a.status !== "publicado") meta.robots = { index: false, follow: false };
  return meta;
}

export default async function ArticlePage({ params }: Params) {
  const { slug } = await params;
  const isDraft = (await draftMode()).isEnabled;
  const a = isDraft
    ? await getArticleBySlugForPreview(slug).catch(() => null)
    : await getPublishedArticleBySlug(slug).catch(() => null);
  if (!a) notFound();
  const isUnpublishedPreview = isDraft && a.status !== "publicado";

  const related = await relatedContent(a.title, a.id, 4, a.categorySlug).catch(() => []);

  const seo = { ...a, authorName: a.authorName, categoryName: a.categoryName };

  return (
    <article className="mx-auto max-w-2xl">
      {isUnpublishedPreview && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--danger)] bg-[var(--danger)]/10 px-4 py-2 text-sm text-[var(--danger)]">
          <span>
            Vista previa · estado: <strong>{STATUS_LABEL[a.status] ?? a.status}</strong> · no
            visible públicamente
          </span>
          <a href={`/api/preview/disable?from=/panel/articulos`} className="underline shrink-0">
            Salir de vista previa
          </a>
        </div>
      )}
      <JsonLd data={newsArticleJsonLd(seo)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          ...(a.categorySlug
            ? [{ name: a.categoryName ?? "", path: `/categoria/${a.categorySlug}` }]
            : []),
          { name: a.title, path: `/articulo/${a.slug}` },
        ])}
      />

      <nav className="mb-5 flex items-center gap-1.5 text-xs text-[var(--ink-faint)]">
        <Link href="/" className="hover:text-[var(--brand)]">
          Inicio
        </Link>
        {a.categorySlug && (
          <>
            <span aria-hidden>/</span>
            <Link href={`/categoria/${a.categorySlug}`} className="hover:text-[var(--brand)]">
              {a.categoryName}
            </Link>
          </>
        )}
      </nav>

      {a.categorySlug && <p className="kicker">{a.categoryName}</p>}
      <h1 className="mt-2 text-[2rem] font-extrabold leading-[1.13] tracking-[-0.025em] md:text-[2.6rem]">
        {a.title}
      </h1>
      <p className="mt-4 font-serif text-xl leading-relaxed text-[var(--ink-soft)]">{a.excerpt}</p>

      <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 border-y border-[var(--line)] py-3 text-sm text-[var(--ink-faint)]">
        {a.authorSlug ? (
          <Link
            href={`/autor/${a.authorSlug}`}
            className="font-semibold text-[var(--ink)] hover:text-[var(--brand)]"
          >
            {a.authorName}
          </Link>
        ) : (
          <span className="font-semibold text-[var(--ink)]">{a.authorName}</span>
        )}
        {a.publishedAt && (
          <>
            <span aria-hidden>·</span>
            <time dateTime={a.publishedAt.toISOString()}>{formatDate(a.publishedAt)}</time>
          </>
        )}
      </div>

      {a.coverImageUrl && (
        <Image
          src={a.coverImageUrl}
          alt={a.coverImageAlt ?? a.title}
          width={896}
          height={504}
          priority
          className="mt-7 aspect-video w-full rounded-[var(--radius)] border border-[var(--line)] object-cover shadow-[var(--shadow-sm)]"
        />
      )}

      {/* El cuerpo llega como HTML ya sanitizado en el panel editorial. */}
      <div className="prose mt-9" dangerouslySetInnerHTML={{ __html: a.body }} />

      {a.tags.length > 0 && (
        <ul className="mt-9 flex flex-wrap gap-2 text-xs">
          {a.tags.map((t) => (
            <li
              key={t}
              className="rounded-full border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1 text-[var(--ink-soft)]"
            >
              {t}
            </li>
          ))}
        </ul>
      )}

      {a.authorBio && (
        <div className="mt-12 flex gap-4 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)] p-5 text-sm">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--brand)] text-base font-bold text-[var(--brand-fg)]">
            {(a.authorName ?? "?").slice(0, 1)}
          </div>
          <div>
            <p className="font-semibold text-[var(--ink)]">{a.authorName}</p>
            <p className="mt-1 leading-relaxed text-[var(--ink-soft)]">{a.authorBio}</p>
          </div>
        </div>
      )}

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-5 border-b border-[var(--line-strong)] pb-3 text-sm font-bold uppercase tracking-[0.08em]">
            Contenido relacionado
          </h2>
          <ul className="flex flex-col divide-y divide-[var(--line)]">
            {related.map((r) => (
              <li key={`${r.kind}-${r.id}`} className="py-3.5">
                <Link
                  href={r.url}
                  className="font-serif text-[17px] font-medium leading-snug text-[var(--ink)] transition-colors hover:text-[var(--brand)]"
                  {...(r.kind === "archivo" ? { rel: "bookmark" } : {})}
                >
                  {r.title}
                </Link>
                {r.kind === "archivo" && (
                  <span className="ml-2 align-middle text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                    archivo
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
