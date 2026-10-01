import "server-only";
import { cache } from "react";
import type { AdDraft } from "@/components/panel/ads-zone-form";
import { normalizeLayout } from "@/lib/home-layout-normalize";
import { DEFAULT_HOME_LAYOUT } from "@/lib/home-layout";
import { sanitizePopup } from "@/lib/popup-types";
import type { PortadaDraft } from "@/lib/portada-draft";
import { sanitizeHomeStyle } from "@/lib/home-style";

/** Clave de site_settings del borrador de cada editor. */
export const draftKey = (userId: string) => `home_draft:${userId}`;

/**
 * Borrador activo en ESTA petición. `cache()` de React es por petición, así que
 * lo que se fije en la pestaña de vista previa no puede filtrarse a otras
 * visitas. Las consultas del portal (diseño, notas, popup, anuncios) lo
 * consultan y, si existe, lo aplican: es lo que hace que la vista previa sea la
 * portada real y no una aproximación.
 */
const holder = cache(() => ({ draft: null as PortadaDraft | null }));
export const setPreviewDraft = (d: PortadaDraft | null) => {
  holder().draft = d;
};
export const getPreviewDraft = () => holder().draft;

/** Valida lo que llega de la base (o del editor) antes de pintarlo. */
export function sanitizeDraft(input: unknown): PortadaDraft | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  if (!r.layout || typeof r.layout !== "object" || !Array.isArray(r.items)) return null;

  const layout = { ...DEFAULT_HOME_LAYOUT, ...normalizeLayout(r.layout as never) } as PortadaDraft["layout"];
  const items = (r.items as unknown[])
    .map((i) => {
      const o = (i ?? {}) as Record<string, unknown>;
      return typeof o.slug === "string" && o.slug
        ? { slug: o.slug.slice(0, 200), homeStyle: sanitizeHomeStyle(o.homeStyle) }
        : null;
    })
    .filter((i): i is PortadaDraft["items"][number] => i !== null)
    .slice(0, 300);

  const adDrafts: Record<string, AdDraft> = {};
  for (const [key, v] of Object.entries((r.adDrafts ?? {}) as Record<string, Record<string, unknown>>)) {
    if (!/^[a-z_]+(__\d)?$/.test(key)) continue;
    const dt = (u: unknown) => (typeof u === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(u) ? u : "");
    const http = (u: unknown) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u.slice(0, 600) : "");
    adDrafts[key] = {
      imageUrl: http(v?.imageUrl),
      clickUrl: http(v?.clickUrl),
      html: typeof v?.html === "string" ? v.html.slice(0, 8000) : "",
      active: v?.active === true,
      startsAt: dt(v?.startsAt),
      endsAt: dt(v?.endsAt),
    };
  }

  return { layout, items, popup: sanitizePopup(r.popup), adDrafts, ...(r.auto === true ? { auto: true } : {}) };
}
