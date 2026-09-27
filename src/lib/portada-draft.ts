import type { AdDraft } from "@/components/panel/ads-zone-form";
import type { HomeLayoutConfig, HomeStyle } from "@/db/schema";
import type { PopupConfig } from "@/lib/popup-types";

/**
 * Borrador de diseño de la portada. El editor lo escribe en el navegador
 * (localStorage) cada vez que cambia algo, y la vista previa a tamaño real
 * abierta en otra pestaña lo lee y se actualiza sola (evento `storage`).
 * Solo vive en el navegador de quien edita; no se envía a ningún sitio hasta
 * que se pulsa «Aceptar y publicar».
 */
export const DRAFT_KEY = "cg-portada-borrador";
export const ACCEPTED_KEY = "cg-portada-aceptado";

export type PortadaDraft = {
  layout: Required<HomeLayoutConfig>;
  /** Orden de las notas y su estilo individual. */
  items: { id: string; homeStyle: HomeStyle | null }[];
  popup: PopupConfig;
  adDrafts: Record<string, AdDraft>;
};

export function parseDraft(raw: string | null): PortadaDraft | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as PortadaDraft;
    return d && d.layout && Array.isArray(d.items) && d.popup ? d : null;
  } catch {
    return null;
  }
}
