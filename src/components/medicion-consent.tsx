"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { MED_EVENT, decidirMedicion, decisionMedicion } from "@/lib/medicion-cliente";

/**
 * Aviso de medición, antes que el de ubicación: explica qué se mide y qué no, y deja decidir. «Sí» activa la cookie de código
 * anónimo; «No» la borra y no vuelve a preguntar en 90 días. Quien ya decidió puede cambiarlo desde la política de privacidad.
 */
export function MedicionConsent() {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (decisionMedicion()) return;
    // En el celular espera un poco más: no tapa la primera pantalla mientras se lee.
    const espera = window.matchMedia("(max-width: 767px)").matches ? 3500 : 1200;
    const id = setTimeout(() => setAbierto(true), espera);
    return () => clearTimeout(id);
  }, []);

  if (!abierto) return null;
  const decidir = (acepta: boolean) => {
    decidirMedicion(acepta);
    setAbierto(false);
  };
  return (
    <div
      role="dialog"
      aria-label="Medición de lectura"
      className="cg-consent fixed inset-x-3 bottom-[calc(var(--cg-barra,0px)+0.5rem)] z-[91] mx-auto grid max-w-xl grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 rounded-2xl border border-[#4a4234] bg-[#141210]/95 p-3 text-[#f7f4ee] shadow-2xl backdrop-blur sm:bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex sm:gap-3 sm:p-4"
    >
      <BarChart3 size={20} aria-hidden className="hidden shrink-0 text-[#d9a05b] sm:block" />
      <p className="flex-1 text-[0.75rem] leading-snug sm:text-sm">
        <span className="sm:hidden">¿Nos ayudas a mejorar? Medimos qué se lee, con un código anónimo: sin nombre, correo ni IP.</span>
        <span className="hidden sm:inline">
          ¿Nos ayudas a mejorar? Medimos qué notas se leen, a qué hora y desde qué ciudad, con una cookie propia de código anónimo: sin tu nombre, correo ni IP.
        </span>{" "}
        <Link href="/politica-de-privacidad#medicion" className="underline underline-offset-2">Cómo funciona la medición</Link>
      </p>
      <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:gap-2">
        <button type="button" onClick={() => decidir(true)} className="min-h-10 rounded-full bg-[#a85a28] px-4 text-xs font-semibold text-white sm:order-2 sm:min-h-11">
          Sí, ayudar
        </button>
        <button type="button" onClick={() => decidir(false)} className="min-h-9 rounded-full px-4 text-xs font-semibold text-[#d9d2c4] sm:order-1 sm:min-h-11 sm:border sm:border-[#4a4234]">
          No, gracias
        </button>
      </div>
    </div>
  );
}

/** Para que otros avisos esperen a que se decida (evita apilar dos a la vez). */
export { MED_EVENT };
