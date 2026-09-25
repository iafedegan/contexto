"use client";

import { useEffect } from "react";

/** Cada cuánto se renueva lo descargado para leer sin conexión. */
const SYNC_EVERY_MS = 30 * 60 * 1000;
const SYNC_KEY = "cg:offline-sync";

type NetworkInformation = { saveData?: boolean; effectiveType?: string; type?: string };

/**
 * Registra el Service Worker del portal público y, con buena conexión, le
 * pide que descargue las últimas notas para leerlas sin internet. Se omite en
 * /panel: el editorial no debe quedar cacheado ni funcionar offline.
 */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (window.location.pathname.startsWith("/panel")) return;

    const version = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
    navigator.serviceWorker
      .register(`/sw.js?v=${version}`)
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        if (!shouldSync()) return;
        // Tras la carga y en un momento libre: nunca frena la página que se lee.
        const run = () => {
          reg.active?.postMessage({ type: "sync-offline" });
          try {
            localStorage.setItem(SYNC_KEY, String(Date.now()));
          } catch {
            /* sin almacenamiento: se sincroniza en cada visita */
          }
        };
        if ("requestIdleCallback" in window) requestIdleCallback(run, { timeout: 10_000 });
        else setTimeout(run, 5_000);
      })
      .catch(() => {
        // Registro best-effort: si falla, el sitio sigue funcionando sin PWA.
      });
  }, []);

  return null;
}

/** Solo con wifi o conexión desconocida, sin ahorro de datos, y no más de cada 30 min. */
function shouldSync(): boolean {
  if (!navigator.onLine) return false;
  const c = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (c?.saveData) return false;
  if (c?.type === "cellular") return false;
  if (c?.effectiveType && ["slow-2g", "2g"].includes(c.effectiveType)) return false;
  try {
    const last = Number(localStorage.getItem(SYNC_KEY) ?? 0);
    if (Date.now() - last < SYNC_EVERY_MS) return false;
  } catch {
    /* sin almacenamiento: se permite */
  }
  return true;
}
