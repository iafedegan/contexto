"use client";

import { useActionState, useState } from "react";
import { Check, Loader2, TriangleAlert } from "lucide-react";
import { actualizarMiPerfil, type MiPerfilState } from "@/app/panel/(app)/configuracion/actions";

/** "Mis datos": cada quien edita su propio nombre, correo y contraseña —
 * separado de la tabla de personas, que solo cambia rol/estado de OTRAS
 * cuentas y no puede tocar la propia (ver actions.ts). */
export function MiPerfilForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState<MiPerfilState, FormData>(actualizarMiPerfil, null);
  const [cambiarPassword, setCambiarPassword] = useState(false);

  return (
    <form
      action={action}
      className="mb-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-4"
    >
      <p className="text-sm font-semibold">Mis datos</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Nombre</span>
          <input
            name="name"
            defaultValue={name}
            required
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Correo</span>
          <input
            name="email"
            type="email"
            defaultValue={email}
            required
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </label>
      </div>

      {cambiarPassword ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
              Contraseña actual
            </span>
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
              Contraseña nueva
            </span>
            <input
              name="newPassword"
              type="password"
              minLength={10}
              autoComplete="new-password"
              className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCambiarPassword(true)}
          className="lx-link mt-3 text-xs text-[var(--accent)]"
        >
          Cambiar contraseña
        </button>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-60"
        >
          {pending && <Loader2 size={13} className="animate-spin" />}
          Guardar mis datos
        </button>

        {state && (
          <p
            role="status"
            className={`flex items-center gap-1.5 text-xs ${
              state.ok ? "text-[var(--accent-2)]" : "text-[var(--danger,#b4442e)]"
            }`}
          >
            {state.ok ? <Check size={13} /> : <TriangleAlert size={13} />}
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
