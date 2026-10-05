"use client";

import { useActionState } from "react";
import { BellRing, Check, Loader2, TriangleAlert } from "lucide-react";
import { enviarAvisoUltimaHora, type AvisoState } from "@/app/panel/(app)/avisos/actions";

// Formulario para enviar un aviso de última hora a los lectores.
export function AvisoForm({
  notas,
  suscriptores,
  configurado,
}: {
  notas: { id: string; title: string }[];
  suscriptores: number;
  configurado: boolean;
}) {
  const [estado, accion, pendiente] = useActionState<AvisoState, FormData>(
    enviarAvisoUltimaHora,
    null,
  );

  return (
    <form
      action={accion}
      className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]"
    >
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-[var(--fg-muted)]">
          {suscriptores} navegador(es) suscrito(s)
        </span>
        <span
          className={`rounded-full px-3 py-1 ${
            configurado
              ? "bg-[var(--accent-2)]/15 text-[var(--accent-2)]"
              : "bg-[var(--danger)]/12 text-[var(--danger)]"
          }`}
        >
          {configurado ? "Claves VAPID configuradas" : "Faltan las claves VAPID"}
        </span>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">
          Nota que se anuncia
        </span>
        <select name="articleId" required className="lx-input">
          <option value="">— Elige una nota publicada —</option>
          {notas.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">
            Título del aviso
          </span>
          <input name="titulo" maxLength={120} placeholder="Por defecto, el titular" className="lx-input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">
            Texto
          </span>
          <input name="cuerpo" maxLength={220} placeholder="Por defecto, la entradilla" className="lx-input" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pendiente || !configurado}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-60"
        >
          {pendiente ? <Loader2 size={15} className="animate-spin" /> : <BellRing size={15} />}
          Enviar aviso
        </button>

        {estado && (
          <p
            role="status"
            className={`flex items-start gap-2 text-sm ${
              estado.ok ? "text-[var(--accent-2)]" : "text-[var(--danger)]"
            }`}
          >
            {estado.ok ? <Check size={15} className="mt-0.5 shrink-0" /> : <TriangleAlert size={15} className="mt-0.5 shrink-0" />}
            {estado.message}
          </p>
        )}
      </div>
    </form>
  );
}
