import Image from "next/image";
import { AD_ZONE_SPECS, getAdsForPosition, type AdPosition } from "@/lib/ads";
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
          <span className="self-start text-[10px] font-medium uppercase tracking-wide text-[var(--fg-muted)]">
            Publicidad
          </span>
          {content.html ? (
            // Creatividad HTML cargada por un administrador en el panel.
            <div className="w-full overflow-hidden rounded-[var(--radius)]" dangerouslySetInnerHTML={{ __html: content.html }} />
          ) : content.imageUrl ? (
            <AdsCreative imageUrl={content.imageUrl} clickUrl={content.clickUrl} width={spec.width} height={spec.height} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

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
