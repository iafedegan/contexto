"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Radio, Zap } from "lucide-react";
import { setArticleFlag } from "@/app/panel/(app)/articulos/actions";

/**
 * Interruptores de «Última hora» y «En vivo» de una nota, directo en la lista. Cambian al instante (y se deshacen si
 * el servidor no lo permite). Solo para quien puede publicar.
 */
export function MarcasNota({ id, breaking, live }: { id: string; breaking: boolean; live: boolean }) {
  const router = useRouter();
  const [estado, setEstado] = useState({ isBreaking: breaking, isLive: live });
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  // Cambia una marca: se ve de inmediato y se revierte si el servidor la rechaza.
  function alternar(flag: "isBreaking" | "isLive") {
    const nuevo = !estado[flag];
    setEstado((s) => ({ ...s, [flag]: nuevo }));
    setError("");
    start(async () => {
      try {
        const res = await setArticleFlag(id, flag, nuevo);
        if (!res.ok) throw new Error(res.message);
        router.refresh();
      } catch (e) {
        setEstado((s) => ({ ...s, [flag]: !nuevo }));
        setError(e instanceof Error && e.message ? e.message : "No se pudo cambiar (¿tu rol lo permite?).");
      }
    });
  }

  const chip = (activo: boolean, color: string) =>
    `inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold transition disabled:opacity-60 ${
      activo ? `${color} text-white` : "border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
    }`;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <button type="button" aria-pressed={estado.isBreaking} disabled={pending} onClick={() => alternar("isBreaking")} title={estado.isBreaking ? "Quitar «Última hora»" : "Marcar como «Última hora» (barra roja en la portada)"} className={chip(estado.isBreaking, "border-[#c0392b] bg-[#c0392b]")}>
        <Zap size={11} aria-hidden /> Última hora
      </button>
      <button type="button" aria-pressed={estado.isLive} disabled={pending} onClick={() => alternar("isLive")} title={estado.isLive ? "Quitar «En vivo»" : "Marcar «En vivo» (etiqueta en la nota y las tarjetas)"} className={chip(estado.isLive, "border-[#b45309] bg-[#b45309]")}>
        <Radio size={11} aria-hidden /> En vivo
      </button>
      {error && <span className="w-full text-xs text-[var(--danger,#b4442e)]">{error}</span>}
    </span>
  );
}
