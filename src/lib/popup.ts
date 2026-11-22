import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { DEFAULT_POPUP, sanitizePopup, type PopupConfig } from "@/lib/popup-types";
import { getPreviewDraft } from "@/lib/preview-draft";
import { cachear, TAG_SITIO, TTL_LARGO } from "@/lib/data-cache";

// Clave de la fila de site_settings donde se guarda la ventana emergente.
export const POPUP_KEY = "site_popup";

// Fila de la ventana emergente leída de la base y cacheada 30 días entre peticiones (la pintan todas las páginas; el panel la invalida solo si cambió).
const leerPopup = cachear(
  "popup",
  async () => {
    const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, POPUP_KEY)).limit(1);
    return row ? { valor: row.value } : null;
  },
  { tags: [TAG_SITIO], segundos: TTL_LARGO },
);

// Lee la ventana emergente: en vista previa usa el borrador del editor; si no, la guardada (con caché entre peticiones).
/** Popup configurado en /panel/portada (fila `site_popup` de site_settings). */
export const getSitePopup = cache(async (): Promise<PopupConfig> => {
  // Vista previa del editor: el popup sin publicar, mostrado siempre y casi sin espera.
  const draft = getPreviewDraft();
  if (draft) return { ...draft.popup, frequency: "always", delay: Math.min(draft.popup.delay, 1) };
  try {
    const guardado = await leerPopup();
    return guardado ? sanitizePopup(guardado.valor) : DEFAULT_POPUP;
  } catch {
    return DEFAULT_POPUP;
  }
});
