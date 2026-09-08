import Link from "next/link";
import Image from "next/image";
import type { ArticleListItem } from "@/lib/content";
import { formatDate } from "@/lib/utils";

export function ArticleCard({ a, priority = false }: { a: ArticleListItem; priority?: boolean }) {
  return (
    <article className="group flex flex-col gap-2">
      <Link href={`/articulo/${a.slug}`} className="block overflow-hidden rounded-[var(--radius)]">
        {a.coverImageUrl ? (
          <Image
            src={a.coverImageUrl}
            alt={a.coverImageAlt ?? a.title}
            width={640}
            height={360}
            priority={priority}
            className="aspect-video w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="aspect-video w-full bg-[var(--bg-subtle)]" />
        )}
      </Link>
      <div className="flex flex-col gap-1">
        {a.categorySlug && (
          <Link
            href={`/categoria/${a.categorySlug}`}
            className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)]"
          >
            {a.categoryName}
          </Link>
        )}
        <h3 className="text-lg font-bold leading-snug">
          <Link href={`/articulo/${a.slug}`} className="hover:text-[var(--link)]">
            {a.title}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm text-[var(--fg-muted)]">{a.excerpt}</p>
        <p className="text-xs text-[var(--fg-muted)]">
          {a.authorName ? `${a.authorName} · ` : ""}
          {a.publishedAt ? formatDate(a.publishedAt) : ""}
        </p>
      </div>
    </article>
  );
}
