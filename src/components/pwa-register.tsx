"use client";

import { useEffect } from "react";

/**
 * Registra el Service Worker del portal público. Se omite en /panel: el
 * editorial no debe quedar cacheado ni funcionar offline.
 */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (window.location.pathname.startsWith("/panel")) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registro best-effort: si falla, el sitio sigue funcionando sin PWA.
    });
  }, []);

  return null;
}
