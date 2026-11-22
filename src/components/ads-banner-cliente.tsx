"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { AD_ZONE_SPECS, positionOf, suffixOf, type AdPosition } from "@/lib/ads-positions";
import { SANDBOX_ANUNCIO, documentoPublicitario } from "@/lib/ads-frame";
import { GAM_POR_POSICION } from "@/lib/gam";
import { cn } from "@/lib/utils";
import { useRecurso } from "@/lib/recurso-cliente";
import { GamSlot } from "@/components/gam-slot";

/** Un anuncio propio activo, tal como llega de `/api/anuncios`. */
type Anuncio = { key: string; html: string | null; imageUrl: string | null; clickUrl: string | null };

/**
 * Lo mismo que `AdsBanner`, pero pedido desde el navegador: es el que usan las páginas estáticas (notas, autores, pie del sitio). Así
 * cargar, cambiar o apagar un anuncio no regenera ninguna nota guardada. Mientras llega la respuesta ocupa lo mismo que un espacio de
 * Google Ad Manager vacío (1 px); con anuncio propio se pinta con el tamaño de su posición, y sin él usa Ad Manager (si está activado).
 * La última respuesta queda en la sesión: en la siguiente página el anuncio sale de entrada, sin esperar a la red.
 */
export function AdsBannerCliente({ zone, className, completo = false }: { zone: AdPosition; className?: string; completo?: boolean }) {
  const pathname = usePathname();
  const datos = useRecurso<{ anuncios: Anuncio[] }>("/api/anuncios", pathname);
  // Aún sin respuesta: el mismo hueco mínimo que deja un espacio de Ad Manager mientras espera.
  if (!datos) return <div aria-hidden className="w-full" style={{ minHeight: 1 }} />;
  const spec = AD_ZONE_SPECS[zone];
  const ads = datos.anuncios
    .filter((r) => positionOf(r.key) === zone && (r.html || r.imageUrl))
    .sort((a, b) => suffixOf(a.key) - suffixOf(b.key));
  if (ads.length === 0) {
    // Sin anuncio propio cargado en el panel, la posición usa el espacio de Google Ad Manager del sitio anterior (si está activado).
    const unidad = GAM_POR_POSICION[zone];
    return process.env.NEXT_PUBLIC_GAM_ENABLED === "1" && unidad ? <GamSlot unidad={unidad} grupo={zone.startsWith("sidebar_") ? "lateral" : undefined} className={cn("mx-auto w-full", className)} completo={completo} /> : null;
  }
  return (
    <div className={cn("flex flex-col gap-4", className)} style={{ maxWidth: completo ? undefined : spec.width }}>
      {ads.map((content) => (
        <div key={content.key} className="flex flex-col items-center gap-1">
          <span className="self-start text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--fg-muted)]">Publicidad</span>
          {content.html ? (
            // Creatividad HTML en un iframe con sandbox y documento propio (ver src/lib/ads-frame.ts, H-26), igual que en `AdsBanner`.
            <iframe
              title="Publicidad"
              srcDoc={documentoPublicitario(content.html)}
              sandbox={SANDBOX_ANUNCIO}
              referrerPolicy="no-referrer"
              loading="lazy"
              scrolling="no"
              className="block w-full overflow-hidden rounded-[var(--radius)] border-0"
              style={{ maxWidth: spec.width, height: spec.height }}
            />
          ) : content.imageUrl ? (
            <CreatividadImagen imageUrl={content.imageUrl} clickUrl={content.clickUrl} width={spec.width} height={spec.height} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

// Creatividad de imagen de un anuncio, con enlace patrocinado si lo tiene (misma salida que en `AdsBanner`).
function CreatividadImagen({ imageUrl, clickUrl, width, height }: { imageUrl: string; clickUrl: string | null; width: number; height: number }) {
  // Carga diferida obligatoria del §9.2 y sin optimizar: la imagen del anunciante va tal cual, como en `AdsBanner`.
  const img = <Image src={imageUrl} alt="Publicidad" width={width} height={height} className="h-auto w-full rounded-[var(--radius)] object-contain" loading="lazy" unoptimized />;
  if (!clickUrl) return img;
  return (
    <a href={clickUrl} target="_blank" rel="noopener noreferrer sponsored" className="block">
      {img}
    </a>
  );
}
