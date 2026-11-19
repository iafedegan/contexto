"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, TriangleAlert } from "lucide-react";
import { actualizarMiPerfil, type MiPerfilState } from "@/app/panel/(app)/configuracion/actions";

/** "Mis datos": cada quien edita su propio nombre, correo y contraseña —
 * separado de la tabla de personas, que solo cambia rol/estado de OTRAS
 * cuentas y no puede tocar la propia (ver actions.ts). */
export function MiPerfilForm({ name, email, debeCambiar = false }: { name: string; email: string; /** Entró con contraseña temporal: el cambio es obligatorio. */ debeCambiar?: boolean }) {
  const [state, action, pending] = useActionState<MiPerfilState, FormData>(actualizarMiPerfil, null);
  const router = useRouter();
  // Al cambiar la contraseña temporal, el aviso y el bloqueo del panel se quitan (vienen del servidor).
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form
      action={action}
      className="mb-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-4"
    >
      <p className="text-sm font-semibold">Mis datos</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[0.72rem] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Nombre</span>
          <input
            name="name"
            defaultValue={name}
            required
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[0.72rem] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Correo</span>
          <input
            name="email"
            type="email"
            defaultValue={email}
            required
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </label>
      </div>

      {/* La contraseña siempre a la vista (antes era un enlace pequeño que nadie encontraba). */}
      <fieldset id="cambiar-contrasena" className={`mt-4 rounded-[var(--radius)] border p-4 ${debeCambiar ? "border-[#d97706] bg-[#d97706]/8" : "border-[var(--border)] bg-[var(--surface)]"}`}>
        <legend className="px-1 text-sm font-semibold">Cambiar contraseña</legend>
        {debeCambiar && (
          <p className="mb-3 text-sm font-medium text-[#92400e]">
            Entraste con una contraseña temporal. Escribe la que te dieron y una nueva de al menos 10 caracteres, y pulsa «Cambiar mi contraseña».
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[0.72rem] uppercase tracking-[0.14em] text-[var(--fg-muted)]">{debeCambiar ? "Contraseña temporal (la que te dieron)" : "Contraseña actual"}</span>
            <input name="currentPassword" type="password" autoComplete="current-password" required={debeCambiar} autoFocus={debeCambiar} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.72rem] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Contraseña nueva (mínimo 10 caracteres)</span>
            <input name="newPassword" type="password" minLength={10} autoComplete="new-password" required={debeCambiar} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          </label>
        </div>
        {!debeCambiar && <p className="mt-2 text-xs text-[var(--fg-muted)]">Déjalas en blanco si solo cambias tu nombre o correo.</p>}
      </fieldset>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-60"
        >
          {pending && <Loader2 size={13} className="animate-spin" />}
          {debeCambiar ? "Cambiar mi contraseña" : "Guardar mis datos"}
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
