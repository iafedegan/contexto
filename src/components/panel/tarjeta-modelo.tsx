"use client";

import { useState, useTransition } from "react";
import { Cpu, Loader2 } from "lucide-react";
import { guardarModeloFavorito } from "@/app/panel/(app)/articulos/ai-actions";

/**
 * «Con qué IA quieres redactar»: el modelo con el que la IA propone títulos, escribe la nota y rehace sus partes. La persona elige de la lista y la
 * elección se recuerda como su favorita para las próximas notas. Las IAs que todavía no tienen clave salen apagadas, con el motivo, para que se vea
 * qué más se puede conectar; un administrador las habilita en Configuración → Inteligencia artificial.
 */
export function TarjetaModelo({
  modelos,
  sinClave = [],
  valor,
  onCambiar,
  esAdmin,
  deshabilitado = false,
}: {
  modelos: { ref: string; etiqueta: string }[];
  sinClave?: string[];
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
      <select value={valor} onChange={(e) => elegir(e.target.value)} disabled={deshabilitado} aria-label="Modelo de IA para redactar" className="lx-input lx-mono text-xs">
        <optgroup label="Disponibles">
          {modelos.map((m) => (
            <option key={m.ref} value={m.ref}>
              {m.etiqueta}
            </option>
          ))}
        </optgroup>
        {sinClave.length > 0 && (
          <optgroup label="Sin conectar">
            {sinClave.map((nombre) => (
              <option key={nombre} disabled>
                {nombre} · falta la clave
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <p className="text-xs leading-snug text-[var(--fg-muted)]">
        La IA que elijas propone los títulos, escribe la nota y rehace sus partes; queda como tu favorita para las próximas.
        {(modelos.length < 2 || sinClave.length > 0) && (
          <>
            {" "}
            {esAdmin ? (
              <a href="/panel/configuracion#asistente" target="_blank" rel="noopener" className="lx-link">Conecta más IAs y habilita modelos en Configuración → Inteligencia artificial.</a>
            ) : (
              "Para poder elegir otras IAs, pídele a un administrador que las conecte."
            )}
          </>
        )}
      </p>
      {(pendiente || aviso) && (
        <p className={`flex items-center gap-1.5 text-xs ${aviso && !aviso.ok ? "text-[var(--danger)]" : "text-[var(--accent-2)]"}`} role="status">
          {pendiente ? <Loader2 size={12} className="animate-spin" /> : null}
          {pendiente ? "Guardando…" : aviso?.texto}
        </p>
      )}
    </div>
  );
}
