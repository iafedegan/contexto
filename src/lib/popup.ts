import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { DEFAULT_POPUP, sanitizePopup, type PopupConfig } from "@/lib/popup-types";
import { getPreviewDraft } from "@/lib/preview-draft";

export const POPUP_KEY = "site_popup";

/** Popup configurado en /panel/portada (fila `site_popup` de site_settings). */
export const getSitePopup = cache(async (): Promise<PopupConfig> => {
  // Vista previa del editor: el popup sin publicar, mostrado siempre y casi sin espera.
  const draft = getPreviewDraft();
  if (draft) return { ...draft.popup, frequency: "always", delay: Math.min(draft.popup.delay, 1) };
  try {
    const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, POPUP_KEY)).limit(1);
    return row ? sanitizePopup(row.value) : DEFAULT_POPUP;
  } catch {
    return DEFAULT_POPUP;
  }
});
