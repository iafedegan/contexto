import Link from "next/link";
import { EnVivoInline } from "@/components/home/en-vivo-inline";
import { LiveBadge } from "@/components/live-badge";
import type { Locale } from "@/lib/i18n";
import type { EnVivoConfig } from "@/lib/en-vivo-types";

/**
 * Transmisión en vivo en el lugar principal de la portada (se enciende en /panel/en-vivo). Va encima de la plantilla, así la nota
 * destacada queda justo debajo. Muestra el video de YouTube: primero su portada en HD y, al cargar la página, el reproductor arrancando solo y sin sonido; el título lleva a /en-vivo.
 */
export function EnVivoBlock({ config, locale }: { config: EnVivoConfig; locale: Locale }) {
  if (!config.activo || !config.videoId) return null;
  const titulo = config.titulo || "Transmisión en vivo";
  return (
    <section aria-label={titulo} className="mb-10">
      <Link href="/en-vivo" className="group mb-3 flex items-center gap-3" aria-label={`Ver la transmisión: ${titulo}`}>
        <LiveBadge locale={locale} />
        <h2 className="lx-display min-w-0 text-xl font-semibold leading-tight group-hover:text-[var(--accent)] md:text-2xl">{titulo}</h2>
      </Link>
      <EnVivoInline videoId={config.videoId} titulo={titulo} />
    </section>
  );
}
