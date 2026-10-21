"use client";

import { useState, useTransition } from "react";
import { Cpu, Loader2 } from "lucide-react";
import { guardarModeloFavorito } from "@/app/panel/(app)/articulos/ai-actions";

/**
 * «Con qué IA quieres redactar»: el modelo con el que la IA propone títulos y escribe esta nota. Con varios habilitados la persona elige y la
 * elección se recuerda como su favorita para las próximas notas; con uno solo se muestra cuál es y se explica cómo habilitar más.
 */
export function TarjetaModelo({
  modelos,
  valor,
  onCambiar,
  esAdmin,
  deshabilitado = false,
}: {
  modelos: { ref: string; etiqueta: string }[];
  valor: string;
  onCambiar: (ref: string) => void;
  esAdmin: boolean;
  deshabilitado?: boolean;
}) {
  const [pendiente, empezar] = useTransition();
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  if (modelos.length === 0) return null;

  const elegir = (ref: string) => {
    onCambiar(ref);
    setAviso(null);
    empezar(async () => {
      try {
        const r = await guardarModeloFavorito(ref);
        setAviso({ ok: r.ok, texto: r.message });
      } catch {
        setAviso({ ok: false, texto: "No se pudo recordar tu elección." });
      }
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--border)] px-3.5 py-3">
      <p className="flex items-start gap-2 text-sm font-semibold">
        <Cpu size={16} aria-hidden className="mt-0.5 shrink-0 text-[var(--accent)]" />
        <span>Con qué IA quieres redactar</span>
      </p>
      {modelos.length > 1 ? (
        <>
          <select value={valor} onChange={(e) => elegir(e.target.value)} disabled={deshabilitado} aria-label="Modelo de IA para redactar" className="lx-input lx-mono text-xs">
            {modelos.map((m) => (
              <option key={m.ref} value={m.ref}>
                {m.etiqueta}
              </option>
            ))}
          </select>
          <p className="text-xs leading-snug text-[var(--fg-muted)]">La IA propone los títulos y escribe la nota con el modelo que elijas. Se recuerda como tu favorita para las próximas.</p>
        </>
      ) : (
        <p className="text-xs leading-snug text-[var(--fg-muted)]">
          Se redacta con <strong className="lx-mono text-[var(--fg)]">{modelos[0].etiqueta}</strong>.{" "}
          {esAdmin ? (
            <a href="/panel/configuracion#asistente" target="_blank" rel="noopener" className="lx-link">Habilita más modelos en Configuración → Inteligencia artificial</a>
          ) : (
            "Si quieres poder elegir otra IA, pídele a un administrador que habilite más modelos."
          )}
        </p>
      )}
      {(pendiente || aviso) && (
        <p className={`flex items-center gap-1.5 text-xs ${aviso && !aviso.ok ? "text-[var(--danger)]" : "text-[var(--accent-2)]"}`} role="status">
          {pendiente ? <Loader2 size={12} className="animate-spin" /> : null}
          {pendiente ? "Guardando…" : aviso?.texto}
        </p>
      )}
    </div>
  );
}
