"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { ToroBot } from "@/components/toro-bot";
import { AssistantChat } from "@/components/assistant-chat";
import { LogoMark } from "@/components/logo-mark";

/**
 * Avatar flotante del asistente: el toro de caricatura, fijo en la esquina inferior derecha de todo el
 * portal (en el celular no: ahí es la pestaña central de la barra inferior, `MobileTabBar`, y no tapa la lectura).
 * Al tocarlo abre el asistente. No aparece en el propio asistente ni se queda tapando: tiene
 * una «x» para ocultarlo hasta la siguiente carga.
 */
export function ToroFlotante() {
  const pathname = usePathname() ?? "";
  const [oculto, setOculto] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    if (!abierto) return;
    // Cierra el panel con la tecla Escape.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [abierto]);
  const en = pathname === "/en" || pathname.startsWith("/en/");
  if (oculto || /\/asistente(\/|$)/.test(pathname)) return null;
  const etiqueta = en ? "Ask the archive assistant" : "Pregúntale al asistente";

  return (
    <>
      {montado && (
        <div
          id="toro-dialogo"
          role="dialog"
          aria-label={en ? "Archive assistant" : "Asistente del archivo"}
          hidden={!abierto}
          className="toro-dialogo max-md:hidden fixed bottom-[max(9rem,calc(env(safe-area-inset-bottom)+8.5rem))] right-[max(0.75rem,env(safe-area-inset-right))] z-30 flex h-[min(34rem,calc(100dvh-11.5rem))] w-[min(26rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg)] text-[var(--fg)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)] print:hidden"
        >
          <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-2)] px-4 py-3">
            <LogoMark size={26} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">{en ? "Archive assistant" : "Asistente del archivo"}</p>
              <p className="truncate text-[0.72rem] text-[var(--fg-muted)]">{en ? "Answers with cited sources" : "Respuestas con fuente citada"}</p>
            </div>
            <button type="button" onClick={() => setAbierto(false)} aria-label={en ? "Close" : "Cerrar"} className="grid size-9 place-items-center rounded-full border border-[var(--border)] transition hover:bg-[var(--surface-2)]">
              <X size={16} />
            </button>
          </div>
          <div className="min-h-0 flex-1 p-3">
            <AssistantChat compact />
          </div>
        </div>
      )}
    <div className="toro-wrap pointer-events-none max-md:hidden fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] z-30 print:hidden">
      <div className="group pointer-events-auto relative">
        <button
          type="button"
          onClick={() => setOculto(true)}
          aria-label={en ? "Hide the assistant" : "Ocultar el asistente"}
          className="absolute -right-1 -top-1 z-10 grid size-7 place-items-center rounded-full border border-[var(--border-strong)] bg-[var(--bg-2)] text-[var(--fg-muted)] opacity-90 shadow transition hover:text-[var(--fg)] pointer-fine:size-5 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100"
        >
          <X size={12} />
        </button>
        <button
          type="button"
          onClick={() => {
            setMontado(true);
            setAbierto((v) => !v);
          }}
          aria-label={etiqueta}
          aria-expanded={abierto}
          aria-controls="toro-dialogo"
          className="toro-float block w-[5.25rem] transition-transform hover:scale-110 sm:w-28"
        >
          <ToroBot bubble={false} label={etiqueta} />
        </button>
        <span className="pointer-events-none absolute bottom-full right-0 mb-1 hidden whitespace-nowrap rounded-full border border-[var(--border-strong)] bg-[var(--bg-2)] px-3 py-1 text-xs font-medium text-[var(--fg)] opacity-0 shadow transition group-hover:opacity-100 pointer-fine:block">
          {etiqueta}
        </span>
      </div>
    </div>
    </>
  );
}
