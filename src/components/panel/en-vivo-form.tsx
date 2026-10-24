"use client";

import { useActionState } from "react";
import { guardarEnVivo, type EnVivoState } from "@/app/panel/(app)/en-vivo/actions";
import type { EnVivoConfig } from "@/lib/en-vivo-types";

const campo = "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm";

/** Formulario del panel «En vivo»: interruptor, enlace de YouTube y título opcional. */
export function EnVivoForm({ inicial }: { inicial: EnVivoConfig }) {
  const [estado, accion, pendiente] = useActionState<EnVivoState, FormData>(guardarEnVivo, null);

  return (
    <form action={accion} className="flex max-w-2xl flex-col gap-5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <label className="flex items-center gap-3 text-sm font-semibold">
        <input type="checkbox" name="activo" defaultChecked={inicial.activo} className="size-5 accent-[var(--accent)]" />
        Transmitir en vivo en la portada
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold">Enlace de YouTube</span>
        <input name="url" type="url" defaultValue={inicial.url} placeholder="https://www.youtube.com/watch?v=… o https://www.youtube.com/live/…" className={campo} />
        <span className="text-xs text-[var(--fg-muted)]">Sirve el enlace del directo (watch, live o youtu.be). Se reproduce sin cookies hasta que el lector le da al play.</span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold">Título de la transmisión (opcional)</span>
        <input name="titulo" defaultValue={inicial.titulo} maxLength={140} placeholder="Ej.: Asamblea general de Fedegán" className={campo} />
      </label>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-[var(--radius)] bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-fg)] disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        {estado && (
          <p role="status" className={`text-sm ${estado.ok ? "text-[var(--accent-2)]" : "text-red-400"}`}>
            {estado.message}
          </p>
        )}
      </div>
    </form>
  );
}
