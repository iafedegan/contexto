import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { getAllPublishedSlugs, getPublishedArticleBySlug } from "@/lib/content";
import { relatedContent } from "@/lib/search";
import { articleMetadata, breadcrumbJsonLd, newsArticleJsonLd } from "@/lib/seo";
import { formatDate } from "@/lib/utils";

export const revalidate = 3600;

type Params = { params: Promise<{ slug: string }> };

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
  const a = await getPublishedArticleBySlug(slug).catch(() => null);
  if (!a) return { title: "Artículo no encontrado", robots: { index: false } };
  return articleMetadata({ ...a, authorName: a.authorName, categoryName: a.categoryName });
}

export default async function ArticlePage({ params }: Params) {
  const { slug } = await params;
  const a = await getPublishedArticleBySlug(slug).catch(() => null);
  if (!a) notFound();

  const related = await relatedContent(a.title, a.id, 4, a.categorySlug).catch(() => []);

  const seo = { ...a, authorName: a.authorName, categoryName: a.categoryName };

  return (
    <article className="mx-auto max-w-2xl">
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

      <nav className="mb-4 text-xs text-[var(--fg-muted)]">
        <Link href="/">Inicio</Link>
        {a.categorySlug && (
          <>
            {" / "}
            <Link href={`/categoria/${a.categorySlug}`}>{a.categoryName}</Link>
          </>
        )}
      </nav>

      <h1 className="text-3xl font-extrabold leading-tight md:text-4xl">{a.title}</h1>
      <p className="mt-3 text-lg text-[var(--fg-muted)]">{a.excerpt}</p>

      <div className="mt-4 flex items-center gap-2 text-sm text-[var(--fg-muted)]">
        {a.authorSlug ? (
          <Link href={`/autor/${a.authorSlug}`} className="font-medium text-[var(--fg)]">
            {a.authorName}
          </Link>
        ) : (
          <span>{a.authorName}</span>
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
          className="mt-6 aspect-video w-full rounded-[var(--radius)] object-cover"
        />
      )}

      {/* El cuerpo llega como HTML ya sanitizado en el panel editorial. */}
      <div className="prose mt-8" dangerouslySetInnerHTML={{ __html: a.body }} />

      {a.tags.length > 0 && (
        <ul className="mt-8 flex flex-wrap gap-2 text-xs">
          {a.tags.map((t) => (
            <li key={t} className="rounded-full bg-[var(--bg-subtle)] px-2 py-1 text-[var(--fg-muted)]">
              {t}
            </li>
          ))}
        </ul>
      )}

      {a.authorBio && (
        <div className="mt-10 rounded-[var(--radius)] bg-[var(--bg-subtle)] p-4 text-sm">
          <p className="font-semibold">{a.authorName}</p>
          <p className="mt-1 text-[var(--fg-muted)]">{a.authorBio}</p>
        </div>
      )}

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-4 border-b border-[var(--border)] pb-2 text-sm font-bold uppercase tracking-wide">
            Contenido relacionado
          </h2>
          <ul className="flex flex-col gap-3">
            {related.map((r) => (
              <li key={`${r.kind}-${r.id}`}>
                <Link
                  href={r.url}
                  className="text-[var(--link)] underline"
                  {...(r.kind === "archivo" ? { rel: "bookmark" } : {})}
                >
                  {r.title}
                </Link>
                {r.kind === "archivo" && (
                  <span className="ml-2 text-xs text-[var(--fg-muted)]">(archivo)</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
