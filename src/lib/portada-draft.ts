import type { HomeLayoutConfig, HomeStyle } from "@/db/schema";
import type { AdDraft } from "@/components/panel/ads-zone-form";
import type { PopupConfig } from "@/lib/popup-types";

/**
 * Borrador de diseño de la portada. El editor lo guarda en el servidor (fila
 * `home_draft:<usuario>` de site_settings) cada vez que cambia algo, y la
 * pestaña «Vista previa» renderiza la portada REAL con ese borrador aplicado,
 * para que se vea exactamente como se verá en producción. No se publica nada
 * hasta pulsar «Aceptar y publicar».
 */
export const DRAFT_PING_KEY = "cg-portada-borrador-ts";
/** La vista previa (otra pestaña) avisa al editor del diseño que se editó allí. */
export const LAYOUT_EDIT_KEY = "cg-portada-diseno-editado";
/** Se editó una sección (nombre, orden…) en otra pestaña: el árbol del editor debe recargarse. */
export const SECCIONES_KEY = "cg-secciones-editadas";
/** La vista previa cambió el orden o el estilo de bloques: el editor debe aplicarlo. */
export const ITEMS_EDIT_KEY = "cg-portada-bloques-editados";
/** La vista previa cambió anuncios: el editor debe aplicarlos. */
export const ADS_EDIT_KEY = "cg-portada-anuncios-editados";
/** La vista previa cambió la ventana emergente: el editor debe aplicarla. */
export const POPUP_EDIT_KEY = "cg-portada-popup-editado";
// Clave del navegador que avisa de que el borrador se aceptó y publicó.
export const ACCEPTED_KEY = "cg-portada-aceptado";

// Contenido completo de un borrador de portada: diseño, orden de notas, ventana emergente y anuncios.
export type PortadaDraft = {
  layout: Required<HomeLayoutConfig>;
  /** Orden de las notas (por slug) y su estilo individual. */
  items: { slug: string; homeStyle: HomeStyle | null }[];
  popup: PopupConfig;
  adDrafts: Record<string, AdDraft>;
  /** «Volver al diseño original»: al publicar, las notas vuelven al orden y estilo automáticos. */
  auto?: boolean;
};
