import { t, type Locale } from "@/lib/i18n";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SectionGrid } from "@/components/section/section-layout";
import { JsonLd } from "@/components/json-ld";
import { authorJsonLd } from "@/lib/seo";
import { SiteShell } from "@/components/site-shell";
import { getSiteTheme } from "@/lib/site-theme";
import { getAuthorWithArticles } from "@/lib/content";
import { siteUrl } from "@/lib/utils";

/** Autor — plantilla «Champán & Perla». */
export const revalidate = 3600;

// Parámetros de la ruta: la dirección del autor.
type Params = { params: Promise<{ slug: string }> };

// Metadatos de la página del autor.
async function generateMetadataImpl({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await getAuthorWithArticles(slug).catch(() => null);
  if (!data) return { title: "Autor no encontrado", robots: { index: false } };
  return {
    title: data.author.name,
    description: data.author.bio ?? `Artículos de ${data.author.name} en CONtexto Ganadero.`,
    alternates: { canonical: siteUrl(`/autor/${slug}`) },
  };
}

// Página de un autor con sus notas; 404 si no existe.
async function AuthorPage({ params, locale }: Params & { locale: Locale }) {
  const { slug } = await params;
  const data = await getAuthorWithArticles(slug).catch(() => null);
  if (!data) notFound();

  const site = await getSiteTheme();

  return (
    <SiteShell theme={site.theme} style={site.style} locale={locale} variant="autor">
      <JsonLd
        data={authorJsonLd({
          name: data.author.name,
          bio: data.author.bio,
          slug,
          items: data.items.map((a) => ({ title: a.title, slug: a.slug })),
        })}
      />
      <header className="mb-16 text-center">
        <span className="lx-display mx-auto grid size-28 place-items-center rounded-full border border-[var(--border-strong)] bg-[var(--surface)] text-5xl font-light text-[var(--accent)] shadow-[var(--shadow)]">
          {data.author.name.charAt(0)}
        </span>
        <p className="lx-kicker mt-8 text-[var(--accent)]">{t(locale, "author.kicker")}</p>
        <h1 className="lx-display mt-3 text-4xl font-light leading-tight break-words sm:text-5xl md:text-6xl">
          {data.author.name}
        </h1>
        {data.author.bio && (
          <p className="mx-auto mt-6 max-w-xl text-lg font-light leading-relaxed text-[var(--fg-muted)]">
            {data.author.bio}
          </p>
        )}
        <div className="mx-auto mt-10 flex max-w-md items-center gap-4">
          <span className="h-px flex-1 bg-[var(--border-strong)]/50" />
          <span className="lx-kicker text-[var(--fg-muted)]">
            {data.items.length} {t(locale, "author.count")}
          </span>
          <span className="h-px flex-1 bg-[var(--border-strong)]/50" />
        </div>
      </header>

      {data.items.length === 0 ? (
        <p className="py-10 text-center font-light text-[var(--fg-muted)]">
          {t(locale, "author.empty")}
        </p>
      ) : (
        <SectionGrid theme={site.parts.body} items={data.items} locale={locale} />
      )}
    </SiteShell>
  );
}


/** Fábrica: la misma página en cualquier idioma de interfaz. */
export function makePage(locale: Locale) {
  return function Page(props: Parameters<typeof AuthorPage>[0]) {
    return AuthorPage({ ...props, locale } as never);
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
      alternates: { canonical: siteUrl(`/autor/${slug}`) },
    };
  };
}
