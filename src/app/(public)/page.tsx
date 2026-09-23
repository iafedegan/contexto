import Link from "next/link";
import Image from "next/image";
import { ArticleCard } from "@/components/article-card";
import { getRecentArticles } from "@/lib/content";
import { formatDate } from "@/lib/utils";

/**
 * Home — generación estática con ISR.
 * `revalidate` de respaldo cada 5 min; la revalidación real es *on-demand*,
 * disparada por el panel editorial al publicar.
 */
export const revalidate = 300;

export default async function HomePage() {
  let articles: Awaited<ReturnType<typeof getRecentArticles>> = [];
  try {
    articles = await getRecentArticles(13);
  } catch {
    articles = [];
  }

  if (articles.length === 0) {
    return (
      <div className="rise py-24 text-center">
        <p className="text-lg font-semibold">Aún no hay artículos publicados.</p>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          Configura la base de datos y ejecuta <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5">npm run db:seed</code>.
        </p>
      </div>
    );
  }

  const [lead, second, third, ...rest] = articles;

  return (
    <div className="rise flex flex-col gap-14">
      {/* Hero */}
      <section className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        <Link
          href={`/articulo/${lead.slug}`}
          className="group relative flex min-h-[22rem] flex-col justify-end overflow-hidden rounded-[var(--radius)] border border-[var(--line)] p-6 text-white shadow-[var(--shadow-md)] sm:p-8"
        >
          {lead.coverImageUrl ? (
            <Image
              src={lead.coverImageUrl}
              alt={lead.coverImageAlt ?? lead.title}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 640px"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="img-fallback absolute inset-0" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
          <div className="relative">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/85">
              {lead.categoryName ?? "Portada"}
            </span>
            <h1 className="mt-2 max-w-2xl text-2xl font-extrabold leading-[1.15] tracking-[-0.02em] sm:text-[2rem]">
              {lead.title}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/80 line-clamp-2">{lead.excerpt}</p>
            <p className="mt-3 text-xs text-white/65">
              {lead.authorName ? `${lead.authorName} · ` : ""}
              {lead.publishedAt ? formatDate(lead.publishedAt) : ""}
            </p>
          </div>
        </Link>

        <div className="flex flex-col divide-y divide-[var(--line)]">
          {[second, third].filter(Boolean).map((a, i) => (
            <div key={a.slug} className={i === 0 ? "pb-5" : "py-5"}>
              <ArticleCard a={a} size="sm" />
            </div>
          ))}
          <Link
            href="/asistente"
            className="mt-1 flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--brand-tint)] px-4 py-3 text-sm font-semibold text-[var(--brand-strong)] transition hover:brightness-95"
          >
            Pregúntale al asistente del archivo
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* Lo más reciente */}
      <section>
        <div className="mb-6 flex items-baseline justify-between border-b border-[var(--line-strong)] pb-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.08em]">Lo más reciente</h2>
        </div>
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((a) => (
            <ArticleCard key={a.slug} a={a} />
          ))}
        </div>
      </section>
    </div>
  );
}
