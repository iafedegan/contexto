import type { AdDraft, AdsZoneRow } from "@/components/panel/ads-zone-form";
import { AD_ZONE_SPECS, type AdPosition } from "@/lib/ads-positions";

const isHttp = (u: string) => /^https?:\/\//i.test(u);

/**
 * Los anuncios de una posición tal como se verán en el sitio, dentro del
 * lienzo del editor y con lo que se está escribiendo (aunque no se haya
 * guardado). Un anuncio sin activar se ve con la etiqueta «Borrador»; y la
 * posición que se está editando, si está vacía, se marca con un recuadro.
 */
export function AdsPreview({
  position,
  zones,
  drafts,
  focusKey,
  className = "",
}: {
  position: AdPosition;
  zones: AdsZoneRow[];
  drafts: Record<string, AdDraft>;
  /** Anuncio que se está editando ahora. */
  focusKey: string | null;
  className?: string;
}) {
  const spec = AD_ZONE_SPECS[position];
  const items = zones
    .filter((z) => z.position === position)
    .map((z) => {
      const d = drafts[z.key];
      return {
        key: z.key,
        name: z.name,
        imageUrl: d ? d.imageUrl : z.imageUrl ?? "",
        html: d ? d.html : z.html ?? "",
        active: d ? d.active : z.active,
      };
    });

  const shown = items.filter((i) => (i.imageUrl && isHttp(i.imageUrl)) || i.html);
  const editing = items.find((i) => i.key === focusKey);
  if (shown.length === 0 && !editing) return null;

  return (
    <div className={`flex flex-col gap-4 ${className}`} style={{ maxWidth: spec.width }}>
      {items
        .filter((i) => shown.includes(i) || i.key === focusKey)
        .map((i) => {
          const focused = i.key === focusKey;
          return (
            <div key={i.key} className="flex flex-col items-center gap-1">
              <span className="flex w-full items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-[var(--fg-muted)]">
                Publicidad
                {!i.active && (
                  <span className="rounded bg-[var(--accent)] px-1.5 py-px text-[9px] text-white">Borrador · no visible en el sitio</span>
                )}
              </span>
              <div
                className={`w-full overflow-hidden rounded-[var(--radius)] ${focused ? "outline outline-2 outline-offset-2 outline-[var(--accent)]" : ""}`}
                style={{ aspectRatio: `${spec.width} / ${spec.height}` }}
              >
                {i.imageUrl && isHttp(i.imageUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.imageUrl} alt="" className="size-full object-contain" />
                ) : i.html ? (
                  <div className="grid size-full place-items-center border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] p-2 text-center text-xs text-[var(--fg-muted)]">
                    Código HTML del anunciante
                    <br />
                    (se ve en el sitio publicado)
                  </div>
                ) : (
                  <div className="grid size-full place-items-center border-2 border-dashed border-[var(--accent)] bg-[var(--surface-2)] p-2 text-center text-xs font-medium text-[var(--accent)]">
                    {i.name}
                    <br />
                    <span className="font-normal opacity-80">
                      {spec.width}×{spec.height}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}
