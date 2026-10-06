import Image from "next/image";
import { AD_ZONE_SPECS, getAdsForPosition, type AdPosition } from "@/lib/ads";
import { SANDBOX_ANUNCIO, documentoPublicitario } from "@/lib/ads-frame";
import { cn } from "@/lib/utils";

/**
 * Pinta los anuncios de una posición (home top, sidebar de artículo, …). Si hay
 * varios activos se apilan por orden. No renderiza nada si la posición no
 * tiene ninguno activo y vigente.
 */
export async function AdsBanner({ zone, className }: { zone: AdPosition; className?: string }) {
  const spec = AD_ZONE_SPECS[zone];
  const ads = await getAdsForPosition(zone).catch(() => []);
  if (ads.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-4", className)} style={{ maxWidth: spec.width }}>
      {ads.map((content) => (
        <div key={content.key} className="flex flex-col items-center gap-1">
          <span className="self-start text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--fg-muted)]">
            Publicidad
          </span>
          {content.html ? (
            // Creatividad HTML cargada por un administrador en el panel. Va en un iframe con sandbox y documento propio, no
            // inyectada en la página: así su JavaScript no toca el DOM ni las cookies del sitio ni puede redirigir a quien
            // lo lee (ver src/lib/ads-frame.ts, H-26). El tamaño es el de la posición (§9 del Anexo comercial).
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
            <AdsCreative imageUrl={content.imageUrl} clickUrl={content.clickUrl} width={spec.width} height={spec.height} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

// Creatividad de imagen de un anuncio, con enlace patrocinado si lo tiene.
function AdsCreative({
  imageUrl,
  clickUrl,
  width,
  height,
}: {
  imageUrl: string;
  clickUrl: string | null;
  width: number;
  height: number;
}) {
  const img = (
    <Image
      src={imageUrl}
      alt="Publicidad"
      width={width}
      height={height}
      className="h-auto w-full rounded-[var(--radius)] object-contain"
      // Carga diferida obligatoria del §9.2: la publicidad nunca debe competir
      // con el contenido por el ancho de banda inicial ni empeorar el LCP.
      loading="lazy"
      unoptimized
    />
  );
  if (!clickUrl) return img;
  return (
    <a href={clickUrl} target="_blank" rel="noopener noreferrer sponsored" className="block">
      {img}
    </a>
  );
}
