import Link from "next/link";
import { EnVivoInline } from "@/components/home/en-vivo-inline";
import { EnlaceNota as Enlace } from "@/components/ui/enlace-nota";
import { CardMedia } from "@/components/cover-art";
import { hrefNota } from "@/lib/ruta-nota";
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
          // Junto al video, las notas miden lo mismo que él: la columna no suma alto (sus tarjetas van absolutas) y se reparte en partes iguales.
          <div className="relative min-w-0 flex-1 lg:self-stretch">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:absolute lg:inset-0 lg:grid-cols-1 lg:grid-rows-2">
              {laterales.map((a) => (
                <Enlace key={a.slug} href={hrefNota(locale, a)} className="group relative block aspect-[16/10] min-h-0 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] lg:aspect-auto">
                  <span className="absolute inset-0 block"><CardMedia src={a.coverImageUrl} alt={a.coverImageAlt ?? a.title} seed={a.slug} label={a.categoryName ?? a.title} ratio="h-full" sizes="(min-width: 1024px) 30vw, 100vw" /></span>
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent p-4 pt-16 text-white">
                    {a.categoryName && <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">{a.categoryName}</span>}
                    <span className="lx-display mt-1 line-clamp-3 block text-lg font-semibold leading-snug group-hover:underline xl:text-xl">{a.title}</span>
                  </span>
                </Enlace>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
