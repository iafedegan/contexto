import { INTL_LOCALE, categoryLabel, localePath, t, type Locale } from "@/lib/i18n";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import { ArticleBody } from "@/components/article-body";
import { siteUrl } from "@/lib/utils";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { AdsBanner } from "@/components/ads-banner";
import { ViewCounter } from "@/components/view-counter";
import { LiveBadge } from "@/components/live-badge";
import { ShareButtons } from "@/components/share-buttons";
import { ReaderMode } from "@/components/reader-mode";
import { ArticleHero, ARTICLE_BODY_CLASS } from "@/components/article/article-hero";
import { JsonLd } from "@/components/json-ld";
import { SiteShell } from "@/components/site-shell";
import { getSiteTheme } from "@/lib/site-theme";
import { CoverArt } from "@/components/cover-art";
import { getPublishedArticleBySlug, type FullArticle } from "@/lib/content";
import { relatedContent } from "@/lib/search";
import { articleMetadata, breadcrumbJsonLd, newsArticleJsonLd } from "@/lib/seo";
import { formatDate } from "@/lib/utils";
import { PREFIJO_IMAGEN_IA } from "@/lib/ai-image";

/** Artículo — plantilla «Marfil & Burdeos». */
export const revalidate = 3600;

// Parámetros de la ruta: la dirección de la nota.
type Params = { params: Promise<{ slug: string }> };

/**
 * Ningún artículo se prerenderiza en el build, a propósito.
 *
 * Prerenderizarlos obliga a consultar la base una vez por página y en paralelo,
 * y el pooler de Supabase cancela las consultas por exceso de concurrencia: el
 * despliegue se caía con «took more than 60 seconds» en cada nota. Además no
 * escala — el archivo histórico son 41.000 artículos, imposibles de generar en
 * cada build.
 *
 * Con la lista vacía cada nota se genera en su primera visita y queda cacheada
 * por ISR (`revalidate`), que es el comportamiento que ya tenía a partir de la
 * segunda visita.
 */
export async function generateStaticParams() {
  return [];
}

// Metadatos de la nota: título, descripción, canónica y datos para redes.
async function generateMetadataImpl({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const a = await getPublishedArticleBySlug(slug).catch(() => null);
  if (!a) return { title: "Artículo no encontrado", robots: { index: false } };
  return articleMetadata({ ...a, authorName: a.authorName, categoryName: a.categoryName });
}

// Página de una nota publicada: cuerpo saneado, autor, relacionados y datos estructurados; 404 si no existe.
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
      <ArticleDocument a={a} related={related} locale={locale} theme={site.parts.body} />
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
  theme = "esmeralda",
}: {
  /** Plantilla activa: decide la estructura de la apertura. */
  theme?: string;
  a: FullArticle;
  related: Awaited<ReturnType<typeof relatedContent>>;
  locale: Locale;
  preview?: boolean;
}) {
  const seo = { ...a, authorName: a.authorName, categoryName: a.categoryName };
  const readingMinutes = Math.max(1, Math.round(a.body.replace(/<[^>]+>/g, " ").split(/\s+/).length / 220));

  return (
      <article>
        {/* El contador solo corre en la página pública, no en la vista previa. */}
        {!preview && <ViewCounter slug={a.slug} />}
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

        <ArticleHero
          theme={theme}
          kicker={a.categorySlug ? categoryLabel(locale, a.categorySlug, a.categoryName ?? "") : undefined}
          title={a.title}
          excerpt={a.excerpt}
          live={a.isLive ? <LiveBadge locale={locale} /> : undefined}
          breadcrumb={
        <nav className="lx-ui flex flex-wrap items-center gap-2 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--fg-muted)]">
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
          }
          byline={
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
          }
          actions={
        <div className="flex flex-wrap items-center gap-4">
          <ReaderMode
            title={a.title}
            excerpt={a.excerpt}
            body={sanitizeArticleHtml(a.body)}
            cover={a.coverImageUrl}
            coverAlt={a.coverImageAlt}
            kicker={a.categorySlug ? categoryLabel(locale, a.categorySlug, a.categoryName ?? "") : undefined}
            byline={[a.authorName, a.publishedAt && formatDate(a.publishedAt, INTL_LOCALE[locale]), `${readingMinutes} ${t(locale, "article.readTime")}`]
              .filter(Boolean)
              .join(" · ")}
            lang={locale === "en" ? "en-US" : "es-CO"}
          />
          {!preview && <ShareButtons title={a.title} locale={locale} />}
        </div>
          }
          cover={
        <figure className="lx-media lx-card mt-10 aspect-[16/9] w-full">
          {a.coverImageUrl ? (
            <Image
              src={a.coverImageUrl}
              alt={a.coverImageAlt ?? a.title}
              fill
              priority
              fetchPriority="high"
              sizes="(min-width: 1280px) 1200px, 100vw"
              quality={75}
              className="object-cover"
            />
          ) : (
            <CoverArt seed={a.slug} label={a.categoryName ?? a.title} className="text-[7rem]" />
          )}
          {a.coverImageAlt?.startsWith(PREFIJO_IMAGEN_IA) && (
            <figcaption className="absolute bottom-2 right-2 z-[2] rounded-full bg-black/60 px-2.5 py-1 text-[0.6875rem] font-medium text-white/90 backdrop-blur-sm">
              Imagen generada con IA
            </figcaption>
          )}
        </figure>
          }
        />

        {!preview && <AdsBanner zone="article_top" className="mx-auto mt-10" />}

        {/* El cuerpo llega como HTML ya sanitizado en el panel editorial. */}
        <ArticleBody
          className={ARTICLE_BODY_CLASS[theme] ?? "prose prose-drop mt-12 !max-w-none"}
          html={sanitizeArticleHtml(a.body)}
        />

        {/* Zona comercial del artículo. La plantilla es de una sola columna, así
            que la creatividad de 300×250 va tras el cuerpo, antes de los temas;
            si la zona está vacía o fuera de vigencia no ocupa espacio. */}
        {!preview && <AdsBanner zone="article_sidebar" className="mx-auto mt-14" />}

        {a.tags.length > 0 && (
          <ul className="mx-auto mt-12 flex flex-wrap gap-2">
            {a.tags.map((t) => (
              <li key={t} className="lx-chip">
                {t}
              </li>
            ))}
          </ul>
        )}

        {a.authorBio && (
          <aside className="lx-card mx-auto mt-14 flex gap-5 p-6">
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
          <section className="mx-auto mt-16">
            <h2 className="lx-kicker border-b border-[var(--border)] pb-3 text-[var(--accent)]">
              {t(locale, "article.keepReading")}
            </h2>
            <ol className="mt-6 flex flex-col">
              {related.map((r, i) => (
                <li key={`${r.kind}-${r.id}`} className="border-b border-[var(--border)] last:border-0">
                  <Link
                    href={r.url}
                    className="group flex items-baseline gap-4 py-4"
                    {...(r.kind === "archivo" ? { rel: "bookmark" } : {})}
                  >
                    <span className="lx-display text-lg text-[var(--accent-2)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="lx-display flex-1 text-lg leading-snug transition-colors group-hover:text-[var(--accent)]">
                      {r.title}
                      {r.kind === "archivo" && (
                        <span className="lx-ui ml-2 align-middle text-[0.72rem] uppercase tracking-[0.18em] text-[var(--fg-muted)]">
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
