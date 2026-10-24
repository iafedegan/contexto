import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import { LiveBadge } from "@/components/live-badge";
import type { Locale } from "@/lib/i18n";
import type { EnVivoConfig } from "@/lib/en-vivo-types";

/**
 * Transmisión en vivo en el lugar principal de la portada (se enciende en /panel/en-vivo). Va encima de la plantilla, así la nota
 * destacada queda justo debajo. Muestra la portada del video de YouTube y un play, y todo el bloque lleva a /en-vivo, donde está el
 * reproductor grande; así no se carga el iframe de YouTube en la portada (que hundiría el LCP) y el clic no lo captura el video.
 */
export function EnVivoBlock({ config, locale }: { config: EnVivoConfig; locale: Locale }) {
  if (!config.activo || !config.videoId) return null;
  const titulo = config.titulo || "Transmisión en vivo";
  return (
    <section aria-label={titulo} className="mb-10">
      <Link href="/en-vivo" className="group block" aria-label={`Ver la transmisión: ${titulo}`}>
        <div className="mb-3 flex items-center gap-3">
          <LiveBadge locale={locale} />
          <h2 className="lx-display min-w-0 text-xl font-semibold leading-tight group-hover:text-[var(--accent)] md:text-2xl">{titulo}</h2>
        </div>
        <div className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-black">
          <Image
            src={`https://i.ytimg.com/vi/${config.videoId}/hqdefault.jpg`}
            alt=""
            fill
            unoptimized
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="object-cover transition duration-500 group-hover:scale-[1.02]"
          />
          <span className="absolute inset-0 grid place-items-center bg-black/25 transition group-hover:bg-black/10">
            <span className="grid size-16 place-items-center rounded-full bg-[var(--danger)] text-white shadow-lg transition group-hover:scale-110 md:size-20">
              <Play size={30} fill="currentColor" aria-hidden />
            </span>
          </span>
        </div>
      </Link>
    </section>
  );
}
