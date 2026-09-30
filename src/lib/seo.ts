/**
 * SEO técnico — corrige explícitamente los hallazgos del diagnóstico:
 *  - datos estructurados NewsArticle (JSON-LD), hoy ausentes
 *  - metadatos por artículo derivados del contenido, sin keyword stuffing
 *  - canonical siempre presente
 */
import type { Metadata } from "next";
import { siteUrl } from "./utils";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "CONtexto Ganadero";
// El logo del NewsArticle/Organization apuntaba a /logo-512.png, un archivo
// que nunca existió en public/ (404): Google Rich Results marcaba el schema
// como inválido en cada nota. Es el logo real que ya usa el resto del sitio.
const ORG_LOGO = siteUrl("/logo/contexto-ganadero-logo.jpg");

type ArticleLike = {
  slug: string;
  title: string;
  excerpt: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  coverImageUrl?: string | null;
  publishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  authorName?: string | null;
  categoryName?: string | null;
  tags?: string[];
};

/** Trunca a longitud de meta description sin cortar palabras. */
function clampDescription(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, clean.lastIndexOf(" ", max)).trimEnd() + "…";
}

export function articleMetadata(a: ArticleLike): Metadata {
  const url = siteUrl(`/articulo/${a.slug}`);
  const title = a.metaTitle?.trim() || a.title;
  // Fuente de la descripción: el resumen editorial, nunca una lista de términos.
  const description = clampDescription(a.metaDescription?.trim() || a.excerpt);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title,
      description,
      siteName: SITE_NAME,
      publishedTime: toIso(a.publishedAt),
      modifiedTime: toIso(a.updatedAt),
      images: a.coverImageUrl ? [{ url: a.coverImageUrl }] : undefined,
      authors: a.authorName ? [a.authorName] : undefined,
      section: a.categoryName ?? undefined,
      tags: a.tags,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: a.coverImageUrl ? [a.coverImageUrl] : undefined,
    },
  };
}

/** JSON-LD NewsArticle — verificable en Rich Results Test. */
export function newsArticleJsonLd(a: ArticleLike) {
  const url = siteUrl(`/articulo/${a.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: (a.metaTitle?.trim() || a.title).slice(0, 110),
    description: clampDescription(a.metaDescription?.trim() || a.excerpt),
    image: a.coverImageUrl ? [a.coverImageUrl] : undefined,
    datePublished: toIso(a.publishedAt),
    dateModified: toIso(a.updatedAt) ?? toIso(a.publishedAt),
    articleSection: a.categoryName ?? undefined,
    keywords: a.tags?.length ? a.tags.join(", ") : undefined,
    author: a.authorName
      ? { "@type": "Person", name: a.authorName }
      : { "@type": "Organization", name: SITE_NAME },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: ORG_LOGO },
    },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    name: SITE_NAME,
    url: siteUrl("/"),
    logo: ORG_LOGO,
    diversityPolicy: siteUrl("/politica-editorial"),
    knowsAbout: ["ganadería", "sector agropecuario", "Colombia", "precios del ganado"],
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: siteUrl(it.path),
    })),
  };
}

function toIso(d?: Date | string | null): string | undefined {
  if (!d) return undefined;
  return (typeof d === "string" ? new Date(d) : d).toISOString();
}

/**
 * Listado de sección: `CollectionPage` + `ItemList`.
 *
 * Google necesita saber que una página de sección es un LISTADO, no un
 * artículo: con esto puede mostrar el conjunto en resultados enriquecidos y
 * entiende la jerarquía portada → sección → nota.
 */
export function collectionJsonLd(input: {
  name: string;
  description?: string | null;
  path: string;
  items: Array<{ title: string; slug: string }>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    url: siteUrl(input.path),
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: siteUrl("/") },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: input.items.length,
      itemListElement: input.items.map((a, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: siteUrl(`/articulo/${a.slug}`),
        name: a.title,
      })),
    },
  };
}

/** Página de firma: `ProfilePage` + `Person`, con sus notas como creaciones. */
export function authorJsonLd(input: {
  name: string;
  bio?: string | null;
  slug: string;
  items: Array<{ title: string; slug: string }>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: input.name,
      ...(input.bio ? { description: input.bio } : {}),
      url: siteUrl(`/autor/${input.slug}`),
      worksFor: { "@type": "NewsMediaOrganization", name: SITE_NAME, url: siteUrl("/") },
    },
    hasPart: input.items.slice(0, 20).map((a) => ({
      "@type": "NewsArticle",
      headline: a.title,
      url: siteUrl(`/articulo/${a.slug}`),
    })),
  };
}
