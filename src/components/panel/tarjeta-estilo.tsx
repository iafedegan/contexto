"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Loader2, PenLine } from "lucide-react";
import { alternarEstilo, estadoEstilo } from "@/app/panel/(app)/configuracion/estilo-actions";

export type EstadoEstilo = "activo" | "apagado" | "sin";

const fecha = (iso: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", timeZone: "America/Bogota" }).format(new Date(iso));

/**
 * Aviso del asistente de redacción sobre el estilo propio de la persona: si la IA lo está usando lo dice con claridad; si todavía no
 * lo ha registrado, ofrece el botón para hacerlo (en otra pestaña, para no perder la nota en curso); si lo apagó, lo reactiva ahí mismo.
 */
export function TarjetaEstilo({
  estado,
  info,
  alCambiar,
}: {
  estado: EstadoEstilo;
  info: { generadoEn: string; muestras: number; palabras: number } | null;
  alCambiar: (e: EstadoEstilo) => void;
}) {
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState("");

  // Al volver de la otra pestaña (donde registró su estilo), se relee para que el aviso cambie solo, sin recargar la nota.
  useEffect(() => {
    if (estado === "activo") return;
    let vivo = true;
    const releer = () => {
      if (document.visibilityState !== "visible") return;
      estadoEstilo()
        .then((v) => { if (vivo && v.diagnostico) alCambiar(v.activo ? "activo" : "apagado"); })
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", releer);
    window.addEventListener("focus", releer);
    return () => { vivo = false; document.removeEventListener("visibilitychange", releer); window.removeEventListener("focus", releer); };
  }, [estado, alCambiar]);

  function cambiar(activo: boolean) {
    setError("");
    empezar(async () => {
      try {
        const r = await alternarEstilo(activo);
        if (r.ok) alCambiar(activo ? "activo" : "apagado");
        else setError(r.message);
      } catch {
        setError("No se pudo cambiar. Inténtalo de nuevo.");
      }
    });
  }

  const marco = "flex flex-col gap-2 rounded-[var(--radius)] border px-3.5 py-3";
  const boton = "lx-btn !px-3 !py-1.5 text-xs";

  if (estado === "activo") {
    return (
      <div role="status" className={`${marco} border-[var(--accent)]/40 bg-[var(--accent)]/8`}>
        <p className="flex items-start gap-2 text-sm font-semibold">
          <CheckCircle2 size={16} aria-hidden className="mt-0.5 shrink-0 text-[var(--accent)]" />
          <span>Se está usando tu estilo propio de escritura</span>
        </p>
        <p className="text-xs leading-snug text-[var(--fg-muted)]">
          La IA propondrá los títulos y redactará la nota como tú{info ? `, según el diagnóstico del ${fecha(info.generadoEn)} (${info.muestras} notas)` : ""}.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/panel/configuracion#estilo" target="_blank" rel="noopener" className={boton}>Ver o actualizar mi estilo</a>
          <button type="button" disabled={pendiente} onClick={() => cambiar(false)} className={boton}>
            {pendiente && <Loader2 size={13} className="animate-spin" />} Apagar
          </button>
        </div>
        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      </div>
    );
  }

  if (estado === "apagado") {
    return (
      <div className={`${marco} border-[var(--border-strong)] bg-[var(--bg-2)]`}>
        <p className="flex items-start gap-2 text-sm font-semibold">
          <PenLine size={16} aria-hidden className="mt-0.5 shrink-0 text-[var(--fg-muted)]" />
          <span>Tu estilo está apagado</span>
        </p>
        <p className="text-xs leading-snug text-[var(--fg-muted)]">Ya lo registraste, pero la IA no lo está usando. Actívalo para que escriba como tú.</p>
        <div>
          <button type="button" disabled={pendiente} onClick={() => cambiar(true)} className={boton}>
            {pendiente ? <Loader2 size={13} className="animate-spin" /> : <PenLine size={13} />} Usar mi estilo
          </button>
        </div>
        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      </div>
    );
  }

  return (
    <div className={`${marco} border-dashed border-[var(--border-strong)] bg-[var(--bg-2)]`}>
      <p className="flex items-start gap-2 text-sm font-semibold">
        <PenLine size={16} aria-hidden className="mt-0.5 shrink-0 text-[var(--accent)]" />
        <span>Aún no registras tu estilo de escritura</span>
      </p>
      <p className="text-xs leading-snug text-[var(--fg-muted)]">
        Carga 3 notas tuyas (enlaces o texto) y la IA aprenderá cómo escribes. Se abre en otra pestaña: aquí no pierdes lo que llevas.
      </p>
      <div>
        <a href="/panel/configuracion#estilo" target="_blank" rel="noopener" className={`${boton} !bg-[var(--accent)] !text-[var(--accent-fg)]`}>
          <PenLine size={13} aria-hidden /> Registrar mi estilo
        </a>
      </div>
    </div>
  );
}
