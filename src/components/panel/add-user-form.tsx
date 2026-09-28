"use client";

import { useActionState, useState } from "react";
import { Check, Loader2, TriangleAlert, UserPlus, X } from "lucide-react";
import { createUser, type CreateUserState } from "@/app/panel/(app)/configuracion/actions";
import type { UserRole } from "@/db/schema";

const ROLES: UserRole[] = ["redactor", "editor", "administrador"];

/** Genera una contraseña temporal legible, para no dejar el campo en blanco. */
function passwordTemporal(): string {
  const palabras = ["ganado", "pradera", "novillo", "boletin", "vaquero", "trópico"];
  const palabra = palabras[Math.floor(Math.random() * palabras.length)];
  const numero = Math.floor(1000 + Math.random() * 9000);
  return `${palabra}${numero}!`;
}

/** Alta de personas nuevas, con contraseña temporal generada en el navegador
 * (visible en claro solo aquí, para que el administrador la copie y la
 * entregue por un canal seguro — no hay envío de correo configurado). */
export function AddUserForm() {
  const [abierto, setAbierto] = useState(false);
  const [password, setPassword] = useState(passwordTemporal);
  const [state, action, pending] = useActionState<CreateUserState, FormData>(createUser, null);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-[var(--accent-fg)] transition hover:opacity-90"
      >
        <UserPlus size={13} /> Agregar persona
      </button>
    );
  }

  return (
    <form
      action={action}
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Agregar persona</p>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          aria-label="Cerrar"
          className="text-[var(--fg-muted)] transition hover:text-[var(--fg)]"
        >
          <X size={15} />
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Nombre</span>
          <input
            name="name"
            required
            placeholder="Nombre y apellido"
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Correo</span>
          <input
            name="email"
            type="email"
            required
            placeholder="persona@contextoganadero.com"
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Rol</span>
          <select
            name="role"
            defaultValue="redactor"
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
            Contraseña temporal
          </span>
          <div className="flex items-center gap-2">
            <input
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={10}
              required
              className="lx-mono flex-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <button
              type="button"
              onClick={() => setPassword(passwordTemporal())}
              className="shrink-0 rounded-full border border-[var(--border)] px-2.5 py-2 text-[0.68rem] transition hover:border-[var(--accent)]"
            >
              Otra
            </button>
          </div>
        </label>
      </div>

      <p className="mt-2 text-xs text-[var(--fg-muted)]">
        Copia esta contraseña y entrégasela a la persona por un canal seguro — no se envía por correo.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-60"
        >
          {pending && <Loader2 size={13} className="animate-spin" />}
          Crear cuenta
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
