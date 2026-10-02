"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { ToroBot } from "@/components/toro-bot";

/**
 * Avatar flotante del asistente: el toro de caricatura, fijo en la esquina inferior derecha de todo el
 * portal. Al tocarlo abre el asistente. No aparece en el propio asistente ni se queda tapando: tiene
 * una «x» para ocultarlo hasta la siguiente carga.
 */
export function ToroFlotante() {
  const pathname = usePathname() ?? "";
  const [oculto, setOculto] = useState(false);
  const en = pathname === "/en" || pathname.startsWith("/en/");
  if (oculto || /\/asistente(\/|$)/.test(pathname)) return null;
  const etiqueta = en ? "Ask the archive assistant" : "Pregúntale al asistente";

  return (
    <div className="toro-wrap pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] z-30 print:hidden">
      <div className="group pointer-events-auto relative">
        <button
          type="button"
          onClick={() => setOculto(true)}
          aria-label={en ? "Hide the assistant" : "Ocultar el asistente"}
          className="absolute -right-1 -top-1 z-10 grid size-7 place-items-center rounded-full border border-[var(--border-strong)] bg-[var(--bg-2)] text-[var(--fg-muted)] opacity-90 shadow transition hover:text-[var(--fg)] pointer-fine:size-5 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100"
        >
          <X size={12} />
        </button>
        <Link
          href={en ? "/en/asistente" : "/asistente"}
          aria-label={etiqueta}
          className="toro-float block w-[5.25rem] transition-transform hover:scale-110 sm:w-28"
        >
          <ToroBot bubble={false} label={etiqueta} />
        </Link>
        <span className="pointer-events-none absolute bottom-full right-0 mb-1 hidden whitespace-nowrap rounded-full border border-[var(--border-strong)] bg-[var(--bg-2)] px-3 py-1 text-xs font-medium text-[var(--fg)] opacity-0 shadow transition group-hover:opacity-100 pointer-fine:block">
          {etiqueta}
        </span>
      </div>
    </div>
  );
}
