"use client";

import { diferido } from "@/components/diferido";

/** La ventana emergente aparece pasados unos segundos: su código se pide después de la carga, no junto al primer titular. */
export const SitePopupDiferido = diferido(() => import("@/components/site-popup").then((m) => m.SitePopup));
