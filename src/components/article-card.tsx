import Link from "next/link";
import Image from "next/image";
import type { ArticleListItem } from "@/lib/content";
import { formatDate } from "@/lib/utils";

export function ArticleCard({
  a,
  priority = false,
  size = "md",
}: {
  a: ArticleListItem;
  priority?: boolean;
  size?: "md" | "sm";
}) {
  return (
    <article className="group flex flex-col gap-3">
      <Link
        href={`/articulo/${a.slug}`}
        className="block overflow-hidden rounded-[var(--radius)] border border-[var(--line)] shadow-[var(--shadow-sm)] transition-shadow group-hover:shadow-[var(--shadow-md)]"
      >
        <div className={`relative ${size === "sm" ? "aspect-[16/10]" : "aspect-[3/2]"}`}>
          {a.coverImageUrl ? (
            <Image
              src={a.coverImageUrl}
              alt={a.coverImageAlt ?? a.title}
              fill
              sizes="(max-width: 640px) 100vw, 400px"
              priority={priority}
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="img-fallback grid h-full w-full place-items-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--ink-faint)]">
                {a.categoryName ?? "CONtexto Ganadero"}
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-col gap-1.5">
        {a.categorySlug && (
          <Link href={`/categoria/${a.categorySlug}`} className="kicker w-fit hover:text-[var(--accent)]">
            {a.categoryName}
          </Link>
        )}
        <h3
          className={
            size === "sm"
              ? "text-[15px] font-bold leading-snug tracking-[-0.01em]"
              : "text-lg font-bold leading-snug tracking-[-0.01em]"
          }
        >
          <Link href={`/articulo/${a.slug}`} className="decoration-[var(--brand)] hover:underline hover:underline-offset-2">
            {a.title}
          </Link>
        </h3>
        {size === "md" && (
          <p className="line-clamp-2 text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
            {a.excerpt}
          </p>
        )}
        <p className="mt-0.5 text-xs text-[var(--ink-faint)]">
          {a.authorName ? `${a.authorName} · ` : ""}
          {a.publishedAt ? formatDate(a.publishedAt) : ""}
        </p>
      </div>
    </article>
  );
}
