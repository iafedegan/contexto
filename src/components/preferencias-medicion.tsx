"use client";

import { useEffect, useState } from "react";
import { MED_EVENT, decidirMedicion, decisionMedicion } from "@/lib/medicion-cliente";

/** Estado de la medición de lectura y los botones para aceptarla o retirarla (política de privacidad). */
export function PreferenciasMedicion({ locale }: { locale: "es" | "en" }) {
  const [estado, setEstado] = useState<"si" | "no" | null | "cargando">("cargando");
  useEffect(() => {
    const leer = () => setEstado(decisionMedicion());
    leer();
    window.addEventListener(MED_EVENT, leer);
    return () => window.removeEventListener(MED_EVENT, leer);
  }, []);
  const es = locale === "es";
  const texto = estado === "si" ? (es ? "La medición está activada en este navegador." : "Measurement is on in this browser.") : estado === "no" ? (es ? "La medición está desactivada en este navegador." : "Measurement is off in this browser.") : estado === "cargando" ? "" : es ? "Todavía no has decidido." : "You have not decided yet.";
  return (
    <div className="lx-card flex flex-wrap items-center gap-3 p-4" aria-live="polite">
      <p className="min-w-0 flex-1 text-sm font-medium">{texto}</p>
      <button type="button" onClick={() => decidirMedicion(true)} disabled={estado === "si"} className="lx-btn min-h-11 disabled:opacity-40">{es ? "Aceptar la medición" : "Accept measurement"}</button>
      <button type="button" onClick={() => decidirMedicion(false)} disabled={estado === "no"} className="lx-btn lx-btn-ghost min-h-11 disabled:opacity-40">{es ? "Retirar el permiso" : "Withdraw permission"}</button>
    </div>
  );
}
