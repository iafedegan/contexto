"use client";

import { useState } from "react";
import type { HomeLayoutConfig } from "@/db/schema";
import { AdsEditor } from "@/components/panel/ads-editor";
import type { AdDraft, AdsZoneRow } from "@/components/panel/ads-zone-form";
import { TemplateBlueprint, type AdState } from "@/components/panel/template-blueprint";
import type { AdPosition } from "@/lib/ads-positions";

/**
 * Publicidad de la página: el plano de la plantilla con la posición de cada
 * anuncio y, debajo, la lista para editarlos. `only` limita las posiciones
 * (en una sección solo importan las de sección y el pie).
 */
export function AdsPanel({
  layout,
  zones,
  canManage,
  drafts,
  onDraft,
  view = "portada",
  views,
  only,
}: {
  layout: Required<HomeLayoutConfig>;
  zones: AdsZoneRow[];
  canManage: boolean;
  drafts: Record<string, AdDraft>;
  onDraft: (key: string, draft: AdDraft) => void;
  view?: "portada" | "seccion" | "nota";
  /** Vistas del plano disponibles (por defecto, las tres). */
  views?: Array<"portada" | "seccion" | "nota">;
  only?: AdPosition[];
}) {
  const [focus, setFocus] = useState<string | null>(null);
  const [request, setRequest] = useState<{ key: string; n: number } | null>(null);
  const shown = only ? zones.filter((z) => only.includes(z.position)) : zones;

  const states: Partial<Record<AdPosition, AdState>> = {};
  for (const z of zones) {
    const d = drafts[z.key];
    const image = d ? d.imageUrl : (z.imageUrl ?? "");
    const html = d ? d.html : (z.html ?? "");
    const active = d ? d.active : z.active;
    const has = /^https?:\/\//i.test(image) || !!html;
    const st: AdState = has && active ? "activo" : has ? "borrador" : "vacio";
    const cur = states[z.position];
    if (!cur || st === "activo" || (st === "borrador" && cur === "vacio")) states[z.position] = st;
  }

  return (
    <div className="flex flex-col gap-4">
      <TemplateBlueprint
        layout={layout}
        view={view}
        views={views}
        adStates={states}
        focus={focus ? (focus.split("__")[0] as AdPosition) : null}
        onPick={(pos) => {
          setFocus(pos);
          setRequest((r) => ({ key: pos, n: (r?.n ?? 0) + 1 }));
        }}
      />
      <AdsEditor zones={shown} canManage={canManage} onDraft={onDraft} onFocusZone={setFocus} request={request} />
    </div>
  );
}
