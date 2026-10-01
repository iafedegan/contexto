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

  async function permitir() {
    writeCookie(LOC_COOKIE, "granted", 365);
    setMsg("Buscando tu ubicación…");
    const ok = await captureGeo();
    if (ok) return setOpen(false);
    setMsg("No pudimos obtener tu ubicación. Revisa el permiso del navegador.");
    setTimeout(() => setOpen(false), 4000);
  }
  function rechazar() {
    writeCookie(LOC_COOKIE, "denied", 90);
    setOpen(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Permiso de ubicación"
      className="fixed inset-x-3 bottom-3 z-[90] mx-auto flex max-w-xl flex-col gap-3 rounded-2xl border border-[#4a4234] bg-[#141210] p-4 text-[#f7f4ee] shadow-2xl sm:flex-row sm:items-center"
    >
      <LocateFixed size={20} className="hidden shrink-0 text-[#d9a05b] sm:block" />
      <p className="flex-1 text-sm leading-snug">
        {msg || "¿Nos dejas saber en qué zona te encuentras? Solo lo usamos para entender de dónde nos leen; tu navegador te pedirá permiso."}
      </p>
      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={rechazar} className="rounded-full border border-[#4a4234] px-4 py-2 text-xs font-semibold">
          Ahora no
        </button>
        <button type="button" onClick={permitir} className="rounded-full bg-[#b4622e] px-4 py-2 text-xs font-semibold text-white">
          Permitir
        </button>
      </div>
    </div>
  );
}
