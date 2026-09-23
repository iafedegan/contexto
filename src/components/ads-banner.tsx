import Image from "next/image";
import { AD_ZONE_SPECS, getAdsZone, type AdZoneKey } from "@/lib/ads";
import { cn } from "@/lib/utils";

/**
 * Pinta una zona de `ads_zones` (home top, sidebar de artículo, …). No renderiza
 * nada si la zona no existe, está inactiva o fuera de su ventana de vigencia.
 */
export async function AdsBanner({ zone, className }: { zone: AdZoneKey; className?: string }) {
  const spec = AD_ZONE_SPECS[zone];
  const content = await getAdsZone(zone).catch(() => null);
  if (!content) return null;

  return (
    <div className={cn("flex flex-col items-center gap-1", className)} style={{ maxWidth: spec.width }}>
      <span className="self-start text-[10px] font-medium uppercase tracking-wide text-[var(--fg-muted)]">
        Publicidad
      </span>
      {content.html ? (
        // Creatividad HTML cargada por un editor en el panel; mismo criterio de
        // confianza que el cuerpo de artículo (ver articulo/[slug]/page.tsx).
        <div className="w-full overflow-hidden rounded-[var(--radius)]" dangerouslySetInnerHTML={{ __html: content.html }} />
      ) : content.imageUrl ? (
        <AdsCreative imageUrl={content.imageUrl} clickUrl={content.clickUrl} width={spec.width} height={spec.height} />
      ) : null}
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
