"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";

/**
 * Video de la transmisión en la portada. Primero sale la portada del video en alta definición (maxresdefault, 1280×720; si el video no la
 * tiene cae a hqdefault) con su play, así el LCP no espera a YouTube; en cuanto la página carga se monta el reproductor y arranca solo, sin
 * sonido (los navegadores no dejan arrancar con sonido sin que la persona toque la página). Llena el ancho que le da su contenedor (EnVivoBlock lo limita al 60 % del alto de la pantalla, siempre 16:9); YouTube sirve HD.
 */
export function EnVivoInline({ videoId, titulo }: { videoId: string; titulo: string }) {
  const [reproductor, setReproductor] = useState(false);
  const [poster, setPoster] = useState(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);

  useEffect(() => {
    const t = window.setTimeout(() => setReproductor(true), 600);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={poster}
        alt=""
        onLoad={(e) => { if (e.currentTarget.naturalWidth <= 120) setPoster(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`); }}
        onError={() => setPoster(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`)}
        fetchPriority="high"
        className="absolute inset-0 size-full object-cover"
      />
      {!reproductor && (
        <span className="absolute inset-0 grid place-items-center bg-black/25">
          <span className="grid size-16 place-items-center rounded-full bg-[var(--danger)] text-white shadow-lg md:size-20">
            <Play size={30} fill="currentColor" aria-hidden />
          </span>
        </span>
      )}
      {reproductor && (
        <iframe
          title={titulo}
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&vq=hd1080&cc_load_policy=1&cc_lang_pref=es`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 size-full border-0"
        />
      )}
      {/* Un clic en la imagen lleva a /en-vivo (el iframe se tragaría el clic); las franjas de arriba y de abajo se dejan libres para el sonido, el título y los controles de YouTube. */}
      <Link href="/en-vivo" aria-label={`Ver la transmisión: ${titulo}`} className="absolute inset-x-0 top-[16%] bottom-[22%] z-10" />
    </div>
  );
}
