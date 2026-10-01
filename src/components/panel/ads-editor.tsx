"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronDown, ImageOff, Loader2, Plus } from "lucide-react";
import { addAdsZone } from "@/app/panel/(app)/configuracion/ads-actions";
import { AdsZoneForm, type AdDraft, type AdsZoneRow } from "@/components/panel/ads-zone-form";
import { AD_ZONE_SPECS, type AdPosition } from "@/lib/ads-positions";

const isHttp = (u: string) => /^https?:\/\//i.test(u);

/**
 * Publicidad como lista, agrupada por POSICIÓN del sitio. Cada anuncio es una
 * fila (miniatura, nombre, estado); al pulsarla se despliega su formulario y,
 * de paso, el lienzo marca dónde va. Solo hay una fila abierta a la vez.
 * Cada posición admite varios anuncios, que se apilan por orden.
 */
export function AdsEditor({
  zones,
  canManage,
  onDraft,
  onFocusZone,
  request,
}: {
  zones: AdsZoneRow[];
  canManage: boolean;
  onDraft?: (key: string, draft: AdDraft) => void;
  onFocusZone?: (key: string | null) => void;
  /** Abre desde fuera el anuncio `key` (p. ej. al pulsarlo en el plano); `n` cambia en cada petición. */
  request?: { key: string; n: number } | null;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, AdDraft>>({});
  // Petición externa (ajuste de estado durante el render, patrón recomendado por React).
  const [seenRequest, setSeenRequest] = useState(request?.n ?? 0);
  if (request && request.n !== seenRequest) {
    setSeenRequest(request.n);
    setOpenKey(request.key);
  }
  useEffect(() => {
    if (request) document.getElementById(`ad-zone-${request.key}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [request]);
  const positions = [...new Set(zones.map((z) => z.position))] as AdPosition[];

  function toggle(key: string) {
    const next = openKey === key ? null : key;
    setOpenKey(next);
    onFocusZone?.(next);
  }

  function add(position: AdPosition) {
    setMsg("");
    start(async () => {
      const res = await addAdsZone(position);
      if (!res.ok) return setMsg(res.message ?? "No se pudo añadir el anuncio.");
      if (res.key) {
        setOpenKey(res.key);
        onFocusZone?.(res.key);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {positions.map((position) => {
        const group = zones.filter((z) => z.position === position);
        const spec = AD_ZONE_SPECS[position];
        return (
          <section key={position}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <p className="meta !text-[0.72rem]">{spec.where}</p>
              <p className="shrink-0 text-[0.74rem] text-[var(--fg-muted)]">
                {spec.width}×{spec.height}
              </p>
            </div>

            <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
              {group.map((z) => {
                const d = drafts[z.key];
                const image = d ? d.imageUrl : z.imageUrl ?? "";
                const html = d ? d.html : z.html ?? "";
                const active = d ? d.active : z.active;
                const hasCreative = (image && isHttp(image)) || !!html;
                const open = openKey === z.key;
                return (
                  <li key={z.key} id={`ad-zone-${z.key}`} className={open ? "bg-[var(--surface-2)]" : ""}>
                    <button
                      type="button"
                      onClick={() => toggle(z.key)}
                      aria-expanded={open}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-[var(--surface-2)]"
                    >
                      <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--fg-muted)]">
                        {image && isHttp(image) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={image} alt="" className="size-full object-cover" />
                        ) : html ? (
                          <span className="text-[0.7rem] font-semibold">HTML</span>
                        ) : (
                          <ImageOff size={16} />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {z.extra ? `Anuncio ${z.key.split("__")[1]}` : "Anuncio principal"}
                        </span>
                        <span className="block truncate text-xs text-[var(--fg-muted)]">{z.name}</span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ${
                          active && hasCreative
                            ? "bg-[#16a34a]/15 text-[#15803d]"
                            : hasCreative
                              ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                              : "bg-[var(--border)] text-[var(--fg-muted)]"
                        }`}
                      >
                        {active && hasCreative ? "Activo" : hasCreative ? "Borrador" : "Vacío"}
                      </span>
                      <ChevronDown size={15} className={`shrink-0 text-[var(--fg-muted)] transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                    {open && (
                      <div className="border-t border-[var(--border)] px-3 pb-4 pt-3">
                        <AdsZoneForm
                          zone={z}
                          canManage={canManage}
                          compact
                          onDraft={(key, draft) => {
                            setDrafts((prev) => ({ ...prev, [key]: draft }));
                            onDraft?.(key, draft);
                          }}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {canManage && (
              <button
                type="button"
                onClick={() => add(position)}
                disabled={pending}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--border-strong)] px-3.5 py-1.5 text-xs font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
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
        <p className="text-[0.74rem] leading-snug text-[var(--fg-muted)]">Solo un administrador puede cambiar la pauta.</p>
      )}
    </div>
  );
}
