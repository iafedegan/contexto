import Image from "next/image";
import type { CSSProperties } from "react";

/** Los mismos dominios que `images.remotePatterns` en next.config.ts: solo esas fotos las puede optimizar Next. */
const OPTIMIZABLE = /^(\/(?!\/)|https:\/\/([a-z0-9-]+\.)*(supabase\.co|contextoganadero\.com)\/)/i;

export function esOptimizable(src: string): boolean {
  return OPTIMIZABLE.test(src) && !/\.svg(\?|$)/i.test(src);
}

/**
 * Foto del sitio público. Si viene de nuestra biblioteca (Supabase) o del sitio, pasa por `next/image`: AVIF/WebP al tamaño de la pantalla
 * en vez del archivo original. Si es de otro dominio (en los bloques del constructor se puede pegar cualquier https://…), se muestra tal
 * cual, porque Next no la puede optimizar. El tamaño real lo dan las clases; `ancho`/`alto` solo fijan la proporción de la descarga.
 */
export function ImagenSitio({
  src, alt, className, style, sizes = "(min-width: 1024px) 50vw, 100vw", ancho = 1600, alto = 900, prioridad = false,
}: {
  src: string; alt: string; className?: string; style?: CSSProperties; sizes?: string; ancho?: number; alto?: number; prioridad?: boolean;
}) {
  if (!esOptimizable(src)) {
    // eslint-disable-next-line @next/next/no-img-element -- foto de otro dominio: Next no la puede optimizar
    return <img src={src} alt={alt} className={className} style={style} loading={prioridad ? "eager" : "lazy"} decoding="async" />;
  }
  return <Image src={src} alt={alt} width={ancho} height={alto} sizes={sizes} className={className} style={style} priority={prioridad} />;
}
