import { LiveBadge } from "@/components/live-badge";
import type { Locale } from "@/lib/i18n";
import type { EnVivoConfig } from "@/lib/en-vivo-types";

/**
 * Transmisión en vivo de YouTube en el lugar principal de la portada (se enciende en /panel/en-vivo). Va encima de la plantilla, así la
 * nota destacada queda justo debajo. Se sirve por youtube-nocookie y con `loading="lazy"` para no hundir el LCP.
 */
export function EnVivoBlock({ config, locale }: { config: EnVivoConfig; locale: Locale }) {
  if (!config.activo || !config.videoId) return null;
  const titulo = config.titulo || "Transmisión en vivo";
  return (
    <section aria-label={titulo} className="mb-10">
      <div className="mb-3 flex items-center gap-3">
        <LiveBadge locale={locale} />
        <h2 className="lx-display min-w-0 text-xl font-semibold leading-tight md:text-2xl">{titulo}</h2>
      </div>
      <div className="aspect-video w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${config.videoId}?rel=0`}
          title={titulo}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="size-full border-0"
        />
      </div>
    </section>
  );
}
