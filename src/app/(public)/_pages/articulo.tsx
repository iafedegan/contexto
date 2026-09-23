import { INTL_LOCALE, categoryLabel, localePath, t, type Locale } from "@/lib/i18n";
import { siteUrl } from "@/lib/utils";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { SiteShell } from "@/components/site-shell";
import { getSiteTheme } from "@/lib/site-theme";
import { CoverArt } from "@/components/cover-art";
import { getAllPublishedSlugs, getPublishedArticleBySlug, type FullArticle } from "@/lib/content";
import { relatedContent } from "@/lib/search";
import { articleMetadata, breadcrumbJsonLd, newsArticleJsonLd } from "@/lib/seo";
import { formatDate } from "@/lib/utils";

/** Artículo — plantilla «Marfil & Burdeos». */
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

async function generateMetadataImpl({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const a = await getPublishedArticleBySlug(slug).catch(() => null);
  if (!a) return { title: "Artículo no encontrado", robots: { index: false } };
  return articleMetadata({ ...a, authorName: a.authorName, categoryName: a.categoryName });
}

async function ArticlePage({ params, locale }: Params & { locale: Locale }) {
  const { slug } = await params;
  const a = await getPublishedArticleBySlug(slug).catch(() => null);
  if (!a) notFound();

  const [related, site] = await Promise.all([
    relatedContent(a.title, a.id, 4, a.categorySlug).catch(() => []),
    getSiteTheme(),
  ]);

  return (
    <SiteShell theme={site.theme} style={site.style} locale={locale} variant="articulo">
      <ArticleDocument a={a} related={related} locale={locale} />
    </SiteShell>
  );
}

/**
 * El documento del artículo, sin envoltorio de sitio. Lo comparten la ruta
 * pública y la vista previa del panel; en la vista previa se omiten los datos
 * estructurados porque esa URL nunca la ve un buscador.
 */
export function ArticleDocument({
  a,
  related,
  locale,
  preview = false,
}: {
  a: FullArticle;
  related: Awaited<ReturnType<typeof relatedContent>>;
  locale: Locale;
  preview?: boolean;
}) {
  const seo = { ...a, authorName: a.authorName, categoryName: a.categoryName };
  const readingMinutes = Math.max(1, Math.round(a.body.replace(/<[^>]+>/g, " ").split(/\s+/).length / 220));

  return (
      <article>
        {!preview && <JsonLd data={newsArticleJsonLd(seo)} />}
        {!preview && (
        <JsonLd
          data={breadcrumbJsonLd([
            { name: "Inicio", path: "/" },
            ...(a.categorySlug
              ? [{ name: a.categoryName ?? "", path: `/categoria/${a.categorySlug}` }]
              : []),
            { name: a.title, path: `/articulo/${a.slug}` },
          ])}
        />
        )}

        <nav className="lx-ui flex flex-wrap items-center gap-2 text-[0.68rem] uppercase tracking-[0.2em] text-[var(--fg-muted)]">
          <Link href={localePath(locale, "/")} className="lx-link">
            {t(locale, "article.home")}
          </Link>
          {a.categorySlug && (
            <>
              <span aria-hidden className="text-[var(--accent-2)]">
                /
              </span>
              <Link href={localePath(locale, `/categoria/${a.categorySlug}`)} className="lx-link text-[var(--accent)]">
                {categoryLabel(locale, a.categorySlug, a.categoryName ?? "")}
              </Link>
            </>
          )}
        </nav>

        <h1 className="lx-display mt-6 text-[2rem] font-semibold leading-[1.06] tracking-tight sm:text-[2.4rem] md:text-[3.4rem]">
          {a.title}
        </h1>

        <p className="mt-5 text-xl leading-relaxed text-[var(--fg-muted)] md:text-[1.35rem]">
          {a.excerpt}
        </p>

        <hr className="lx-rule my-8" />

        <div className="flex flex-wrap items-center gap-4">
          <span className="lx-display grid size-11 place-items-center rounded-full bg-[var(--accent)] text-base text-[var(--accent-fg)]">
            {(a.authorName ?? "C").charAt(0)}
          </span>
          <div className="lx-ui text-sm">
            {a.authorSlug ? (
              <Link href={localePath(locale, `/autor/${a.authorSlug}`)} className="lx-link font-semibold">
                {a.authorName}
              </Link>
            ) : (
              <span className="font-semibold">{a.authorName}</span>
            )}
            <p className="mt-0.5 text-xs uppercase tracking-[0.16em] text-[var(--fg-muted)]">
              {a.publishedAt && (
                <time dateTime={a.publishedAt.toISOString()}>{formatDate(a.publishedAt, INTL_LOCALE[locale])}</time>
              )}
              <span aria-hidden> · </span>
              {readingMinutes} {t(locale, "article.readTime")}
            </p>
          </div>
        </div>

        <figure className="lx-media lx-card mt-10 aspect-[16/9] w-full">
          {a.coverImageUrl ? (
            <Image
              src={a.coverImageUrl}
              alt={a.coverImageAlt ?? a.title}
              fill
              priority
              sizes="(min-width: 768px) 48rem, 100vw"
              className="object-cover"
            />
          ) : (
            <CoverArt seed={a.slug} label={a.categoryName ?? a.title} className="text-[7rem]" />
          )}
        </figure>

        {/* El cuerpo llega como HTML ya sanitizado en el panel editorial. */}
        <div
          className="prose prose-drop mx-auto mt-12"
          dangerouslySetInnerHTML={{ __html: a.body }}
        />

        {a.tags.length > 0 && (
          <ul className="mx-auto mt-12 flex max-w-[40rem] flex-wrap gap-2">
            {a.tags.map((t) => (
              <li key={t} className="lx-chip">
                {t}
              </li>
            ))}
          </ul>
        )}

        {a.authorBio && (
          <aside className="lx-card mx-auto mt-14 flex max-w-[40rem] gap-5 p-6">
            <span className="lx-display grid size-14 shrink-0 place-items-center rounded-full border border-[var(--accent)] text-xl text-[var(--accent)]">
              {(a.authorName ?? "C").charAt(0)}
            </span>
            <div>
              <p className="lx-kicker text-[var(--accent-2)]">{t(locale, "article.aboutAuthor")}</p>
              <p className="lx-display mt-1 text-xl">{a.authorName}</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)]">{a.authorBio}</p>
            </div>
          </aside>
        )}

        {related.length > 0 && (
          <section className="mx-auto mt-16 max-w-[40rem]">
            <h2 className="lx-kicker border-b border-[var(--border)] pb-3 text-[var(--accent)]">
              {t(locale, "article.keepReading")}
            </h2>
            <ol className="mt-6 flex flex-col">
              {related.map((r, i) => (
                <li key={`${r.kind}-${r.id}`} className="border-b border-[var(--border)] py-4 last:border-0">
                  <Link
                    href={r.url}
                    className="group flex items-baseline gap-4"
                    {...(r.kind === "archivo" ? { rel: "bookmark" } : {})}
                  >
                    <span className="lx-display text-lg text-[var(--accent-2)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="lx-display flex-1 text-lg leading-snug transition-colors group-hover:text-[var(--accent)]">
                      {r.title}
                      {r.kind === "archivo" && (
                        <span className="lx-ui ml-2 align-middle text-[0.62rem] uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                          archivo
                        </span>
                      )}
                    </span>
                    <span
                      aria-hidden
                      className="text-[var(--accent)] transition-transform duration-500 group-hover:translate-x-1"
                    >
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}
      </article>
  );
}


/** Fábrica: la misma página en cualquier idioma de interfaz. */
export function makePage(locale: Locale) {
  return function Page(props: Parameters<typeof ArticlePage>[0]) {
    return ArticlePage({ ...props, locale } as never);
  };
}

/**
 * En inglés cambia la interfaz, no el contenido: la página es la MISMA nota en
 * español. Se marca `noindex` y se apunta la canónica a la ruta española para
 * no competir contra ella con contenido duplicado.
 */
export function makeMetadata(locale: Locale) {
  return async (props: Parameters<typeof generateMetadataImpl>[0]) => {
    const meta = await generateMetadataImpl({ ...props, locale } as never);
    if (locale === "es") return meta;
    const { slug } = await props.params;
    return {
      ...meta,
      robots: { index: false, follow: true },
      alternates: { canonical: siteUrl(`/articulo/${slug}`) },
    };
  };
}
