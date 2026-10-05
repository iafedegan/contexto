"use client";

import { useEffect, useState } from "react";
import { LocateFixed } from "lucide-react";
import { captureGeo, LOC_COOKIE, readCookie, readGeo, writeCookie } from "@/lib/geo-consent";

/**
 * Aviso de ubicación, al estilo del de cookies: la decisión (permitir / ahora
 * no) se recuerda en la cookie `cg_loc`. Si la persona permite, el navegador
 * pide su permiso y las coordenadas quedan guardadas en el dispositivo para
 * que el formulario del boletín las envíe al suscribirse.
 */
export function LocationConsent() {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const decision = readCookie(LOC_COOKIE);
    if (!decision) {
      const id = setTimeout(() => setOpen(true), 1500);
      return () => clearTimeout(id);
    }
    // Ya permitió antes: se refresca la posición solo si el navegador no volvería a preguntar.
    if (decision === "granted") {
      const stale = (() => {
        try {
          const g = JSON.parse(readGeo() ?? "null");
          return !g || Date.now() - g.t > 24 * 3600 * 1000;
        } catch {
          return true;
        }
      })();
      if (stale && navigator.permissions) {
        navigator.permissions
          .query({ name: "geolocation" })
          .then((p) => p.state === "granted" && captureGeo())
          .catch(() => {});
      }
    }
  }, []);

  if (!open) return null;

  // Pide la ubicación al navegador y la guarda si la persona acepta.
  async function permitir() {
    writeCookie(LOC_COOKIE, "granted", 365);
    setMsg("Buscando tu ubicación…");
    const ok = await captureGeo();
    if (ok) return setOpen(false);
    setMsg("No pudimos obtener tu ubicación. Revisa el permiso del navegador.");
    setTimeout(() => setOpen(false), 4000);
  }
  // Recuerda que la persona no quiere compartir su ubicación.
  function rechazar() {
    writeCookie(LOC_COOKIE, "denied", 90);
    setOpen(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Permiso de ubicación"
      // `cg-consent`: se oculta mientras hay un popup abierto (globals.css), para que no se apilen.
      className="cg-consent fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[90] mx-auto flex max-w-xl flex-col gap-2.5 rounded-2xl border border-[#4a4234] bg-[#141210] p-3 text-[#f7f4ee] shadow-2xl sm:flex-row sm:items-center sm:gap-3 sm:p-4"
    >
      <LocateFixed size={20} className="hidden shrink-0 text-[#d9a05b] sm:block" />
      <p className="flex-1 text-[0.8125rem] leading-snug sm:text-sm">
        {msg || "¿Nos dejas saber en qué zona te encuentras? Solo lo usamos para entender de dónde nos leen; tu navegador te pedirá permiso."}
      </p>
      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={rechazar} className="min-h-11 flex-1 rounded-full border border-[#4a4234] px-4 text-xs font-semibold sm:flex-none">
          Ahora no
        </button>
        <button type="button" onClick={permitir} className="min-h-11 flex-1 rounded-full bg-[#b4622e] px-4 text-xs font-semibold text-white sm:flex-none">
          Permitir
        </button>
      </div>
    </div>
  );
}
