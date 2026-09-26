"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { addAdsZone } from "@/app/panel/(app)/configuracion/ads-actions";
import { AdsZoneForm, type AdDraft, type AdsZoneRow } from "@/components/panel/ads-zone-form";
import { AD_ZONE_SPECS, type AdPosition } from "@/lib/ads-positions";

/**
 * Publicidad agrupada por POSICIÓN del sitio. Cada posición admite varios
 * anuncios, que se apilan por orden: «Añadir otro anuncio aquí» crea uno más
 * debajo del último.
 */
export function AdsEditor({
  zones,
  canManage,
  onDraft,
  onFocusZone,
}: {
  zones: AdsZoneRow[];
  canManage: boolean;
  onDraft?: (key: string, draft: AdDraft) => void;
  onFocusZone?: (key: string | null) => void;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const positions = [...new Set(zones.map((z) => z.position))] as AdPosition[];

  function add(position: AdPosition) {
    setMsg("");
    start(async () => {
      const res = await addAdsZone(position);
      if (!res.ok) setMsg(res.message ?? "No se pudo añadir el anuncio.");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {positions.map((position) => {
        const group = zones.filter((z) => z.position === position);
        const spec = AD_ZONE_SPECS[position];
        return (
          <section key={position} className="flex flex-col gap-3">
            <div>
              <p className="meta !text-[0.65rem]">{spec.where}</p>
              <p className="text-xs text-[var(--fg-muted)]">
                {spec.width} × {spec.height} px · {group.length} {group.length === 1 ? "anuncio" : "anuncios"}
              </p>
            </div>
            {group.map((z) => (
              <AdsZoneForm key={z.key} zone={z} canManage={canManage} onDraft={onDraft} onFocusZone={onFocusZone} />
            ))}
            {canManage && (
              <button
                type="button"
                onClick={() => add(position)}
                disabled={pending}
                className="inline-flex w-fit items-center gap-1.5 rounded-full border border-dashed border-[var(--border-strong)] px-3.5 py-1.5 text-xs font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
              >
                {pending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Añadir otro anuncio aquí
              </button>
            )}
          </section>
        );
      })}
      {msg && <p className="text-xs text-[var(--danger,#b4442e)]">{msg}</p>}
      {!canManage && (
        <p className="text-[0.68rem] leading-snug text-[var(--fg-muted)]">Solo un administrador puede cambiar la pauta.</p>
      )}
    </div>
  );
}
