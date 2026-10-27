"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Radio, X } from "lucide-react";

// Cada cuánto se pregunta si hay transmisión mientras la app está visible.
const CADA_MS = 30_000;
// Clave donde se recuerda el video cuyo aviso ya se descartó.
const VISTO_KEY = "cg:en-vivo-visto";

type Estado = { activo: boolean; videoId: string; titulo: string };

/**
 * Avisa dentro de la app abierta (sitio o PWA) cuando empieza un en vivo, sin esperar a recargar.
 * Consulta /api/en-vivo cada 30 s mientras la pestaña está visible y al volver a ella.
 */
export function EnVivoAviso() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [descartado, setDescartado] = useState("");

  useEffect(() => {
    const ruta = window.location.pathname;
    if (ruta.startsWith("/panel") || ruta.startsWith("/vista-") || ruta.startsWith("/en-vivo")) return;
    try {
      setDescartado(localStorage.getItem(VISTO_KEY) ?? "");
    } catch {
      /* sin almacenamiento */
    }
    let vivo = true;
    const consultar = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/en-vivo", { cache: "no-store" });
        if (r.ok && vivo) setEstado((await r.json()) as Estado);
      } catch {
        /* sin conexión: se reintenta en el siguiente ciclo */
      }
    };
    consultar();
    const timer = setInterval(consultar, CADA_MS);
    document.addEventListener("visibilitychange", consultar);
    return () => {
      vivo = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", consultar);
    };
  }, []);

  if (!estado?.activo || descartado === estado.videoId) return null;

  function descartar() {
    try {
      localStorage.setItem(VISTO_KEY, estado!.videoId);
    } catch {
      /* sin almacenamiento */
    }
    setDescartado(estado!.videoId);
  }

  return (
    <div role="status" aria-live="polite" className="fixed inset-x-3 top-3 z-[95] mx-auto flex max-w-md items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--danger)] p-3 pr-2 text-white shadow-2xl">
      <Radio size={18} aria-hidden className="shrink-0 animate-pulse" />
      <Link href="/en-vivo" onClick={descartar} className="min-w-0 flex-1 text-sm font-semibold leading-snug">
        Estamos en vivo{estado.titulo ? `: ${estado.titulo}` : ""} <span className="underline">Ver ahora</span>
      </Link>
      <button type="button" onClick={descartar} aria-label="Cerrar aviso" className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/20">
        <X size={16} />
      </button>
    </div>
  );
}
