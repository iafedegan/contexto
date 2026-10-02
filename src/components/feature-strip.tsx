import Link from "next/link";
import Image from "next/image";
import type { ArticleListItem } from "@/lib/content";
import { formatDate } from "@/lib/utils";
import { CoverArt } from "@/components/cover-art";
import { DEFAULT_LOCALE, INTL_LOCALE, localePath, t, type Locale } from "@/lib/i18n";

type Item = { label: string; article: ArticleListItem };

/**
 * Cinta de tres destacados bajo la navegación (Actualidad · Especiales ·
 * Columna destacada), al estilo de la portada del medio.
 */
export function FeatureStrip({ locale = DEFAULT_LOCALE, items }: { locale?: Locale; items: Item[] }) {
  if (items.length === 0) return null;

  return (
    <section
      aria-label="Destacados"
      className="grid grid-cols-1 gap-x-8 gap-y-6 border-b-2 border-[var(--rule-strong)] pb-8 sm:grid-cols-2 lg:grid-cols-3 lg:divide-x lg:divide-[var(--rule)]"
    >
      {items.map(({ label, article: a }) => (
        <article key={a.slug} className="group flex gap-4 lg:px-6 lg:first:pl-0 lg:last:pr-0">
          <Link
            href={localePath(locale, `/articulo/${a.slug}`)}
            className="media-frame aspect-square w-24 shrink-0 self-start sm:w-28"
          >
            {a.coverImageUrl ? (
              <Image
                src={a.coverImageUrl}
                alt={a.coverImageAlt ?? a.title}
                width={120}
                height={120}
                sizes="120px"
              />
            ) : (
              <CoverArt seed={a.slug} label={a.categoryName ?? a.title} className="text-[2.2rem]" />
            )}
          </Link>
          <div className="min-w-0">
            <span className="kicker">{label}</span>
            <h3 className="entry-title mt-1 text-[1.05rem] leading-snug">
              <Link href={localePath(locale, `/articulo/${a.slug}`)} className="hover:underline">
                {a.title}
              </Link>
            </h3>
            <p className="meta mt-1.5">
              {a.authorName ? `${t(locale, "card.by")}: ${a.authorName}` : t(locale, "card.newsroom")}
              {a.publishedAt ? ` · ${formatDate(a.publishedAt, INTL_LOCALE[locale])}` : ""}
            </p>
          </div>
        </article>
      ))}
    </section>
  );
}
