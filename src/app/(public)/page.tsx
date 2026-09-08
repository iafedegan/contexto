import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import { getRecentArticles } from "@/lib/content";

/**
 * Home — generación estática con ISR.
 * `revalidate` de respaldo cada 5 min; la revalidación real es *on-demand*,
 * disparada por el panel editorial al publicar (POST /api/revalidate).
 * Esto elimina el bug de caché que hoy sirve contenido de 2020 en la portada.
 */
export const revalidate = 300;
export const dynamic = "error"; // falla el build si algo fuerza render dinámico

export default async function HomePage() {
  let articles: Awaited<ReturnType<typeof getRecentArticles>> = [];
  try {
    articles = await getRecentArticles(13);
  } catch {
    articles = [];
  }

  if (articles.length === 0) {
    return (
      <div className="py-16 text-center text-[var(--fg-muted)]">
        <p>No hay artículos publicados todavía.</p>
        <p className="mt-2 text-sm">
          Configura la base de datos y ejecuta <code>npm run db:seed</code>.
        </p>
      </div>
    );
  }

  const [lead, ...rest] = articles;

  return (
    <div className="flex flex-col gap-10">
      <section className="grid gap-6 md:grid-cols-2">
        <ArticleCard a={lead} priority />
        <div className="flex flex-col gap-4">
          {rest.slice(0, 3).map((a) => (
            <ArticleCard key={a.slug} a={a} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 border-b border-[var(--border)] pb-2 text-sm font-bold uppercase tracking-wide">
          Lo más reciente
        </h2>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {rest.slice(3).map((a) => (
            <ArticleCard key={a.slug} a={a} />
          ))}
        </div>
      </section>

      <p className="text-sm">
        <Link href="/asistente" className="font-medium text-[var(--link)] underline">
          Pregúntale al asistente
        </Link>{" "}
        sobre cualquier tema del archivo de CONtexto Ganadero.
      </p>
    </div>
  );
}
