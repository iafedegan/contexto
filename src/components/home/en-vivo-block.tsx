import Link from "next/link";
import { EnVivoInline } from "@/components/home/en-vivo-inline";
import { ArticleCard } from "@/components/article-card";
import type { ArticleListItem } from "@/lib/content";
import { LiveBadge } from "@/components/live-badge";
import type { Locale } from "@/lib/i18n";
import type { EnVivoConfig } from "@/lib/en-vivo-types";

/**
 * Transmisión en vivo en el lugar principal de la portada (se enciende en /panel/en-vivo). Va encima de la plantilla, así la nota
 * destacada queda justo debajo. Muestra el video de YouTube: primero su portada en HD y, al cargar la página, el reproductor arrancando solo y sin sonido; el título lleva a /en-vivo.
 */
export function EnVivoBlock({ config, locale, laterales = [] }: { config: EnVivoConfig; locale: Locale; /** Notas de la portada que van a la derecha del video (en el celular, debajo). */ laterales?: ArticleListItem[] }) {
  if (!config.activo || !config.videoId) return null;
  const titulo = config.titulo || "Transmisión en vivo";
  return (
    <section aria-label={titulo} className="mb-10">
      <Link href="/en-vivo" className="group mb-3 flex items-center gap-3" aria-label={`Ver la transmisión: ${titulo}`}>
        <LiveBadge locale={locale} />
        <h2 className="lx-display min-w-0 text-xl font-semibold leading-tight group-hover:text-[var(--accent)] md:text-2xl">{titulo}</h2>
      </Link>
      {/* El video va a la izquierda (como mucho el 60 % del alto de la pantalla, 16:9) y en el espacio que queda van las notas de la portada. */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="w-full shrink-0 lg:w-[min(100%,calc(60vh_*_16/9))]">
          <EnVivoInline videoId={config.videoId} titulo={titulo} />
        </div>
        {laterales.length > 0 && (
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-1">
            {laterales.map((a) => <ArticleCard key={a.slug} a={a} variant="lead" locale={locale} />)}
          </div>
        )}
      </div>
    </section>
  );
}
