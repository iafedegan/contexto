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
      // En el celular espera más: a los 1,5 s tapaba la primera pantalla, justo cuando la persona la está mirando.
      const espera = window.matchMedia("(max-width: 767px)").matches ? 9000 : 1500;
      const id = setTimeout(() => setOpen(true), espera);
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
      // `cg-consent`: se oculta mientras hay un popup abierto (globals.css), para que no se apilen. En el celular es una tira
      // compacta (texto a la izquierda, botones apilados a la derecha) que se apoya sobre la barra de pestañas.
      className="cg-consent fixed inset-x-3 bottom-[calc(var(--cg-barra,0px)+0.5rem)] z-[90] mx-auto grid max-w-xl grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 rounded-2xl border border-[#4a4234] bg-[#141210]/95 p-3 text-[#f7f4ee] shadow-2xl backdrop-blur sm:bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex sm:gap-3 sm:p-4"
    >
      <LocateFixed size={20} className="hidden shrink-0 text-[#d9a05b] sm:block" />
      <p className="flex-1 text-[0.75rem] leading-snug sm:text-sm">
        {msg || (
          <>
            <span className="sm:hidden">¿De qué zona nos lees? Solo para estadísticas; tu navegador te pedirá permiso.</span>
            <span className="hidden sm:inline">¿Nos dejas saber en qué zona te encuentras? Solo lo usamos para entender de dónde nos leen; tu navegador te pedirá permiso.</span>
          </>
        )}
      </p>
      <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:gap-2">
        <button type="button" onClick={permitir} className="min-h-10 rounded-full bg-[#b4622e] px-4 text-xs font-semibold text-white sm:order-2 sm:min-h-11">
          Permitir
        </button>
        <button type="button" onClick={rechazar} className="min-h-9 rounded-full px-4 text-xs font-semibold text-[#d9d2c4] sm:order-1 sm:min-h-11 sm:border sm:border-[#4a4234]">
          Ahora no
        </button>
      </div>
    </div>
  );
}
