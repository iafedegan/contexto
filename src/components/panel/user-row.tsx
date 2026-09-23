"use client";

import { useTransition } from "react";
import type { UserRole } from "@/db/schema";
import { changeUserRole, toggleUserActive } from "@/app/panel/(app)/configuracion/actions";

const ROLES: UserRole[] = ["redactor", "editor", "administrador"];

/**
 * Fila de persona. El cambio de rol se aplica al instante (sin botón de
 * guardar): son decisiones de una sola variable y confirmarlas dos veces
 * sobra. Un administrador no puede tocarse a sí mismo — ver `actions.ts`.
 */
export function UserRow({
  user,
  canManage,
  isSelf,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    active: boolean;
    totpEnabled: boolean;
  };
  canManage: boolean;
  isSelf: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <tr className={pending ? "opacity-50" : undefined}>
      <td className="border-b border-[var(--border)] px-4 py-3">
        <span className="block font-medium">
          {user.name}
          {isSelf && <span className="ml-2 text-xs text-[var(--fg-muted)]">(tú)</span>}
        </span>
        <span className="block text-xs text-[var(--fg-muted)]">{user.email}</span>
      </td>

      <td className="border-b border-[var(--border)] px-4 py-3">
        {canManage ? (
          <select
            value={user.role}
            disabled={pending}
            onChange={(e) => start(() => changeUserRole(user.id, e.target.value as UserRole))}
            className="lx-input py-1.5 text-xs"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs">{user.role}</span>
        )}
      </td>

      <td className="border-b border-[var(--border)] px-4 py-3">
        <span className={`text-xs ${user.totpEnabled ? "text-[var(--accent-2)]" : "text-[var(--fg-muted)]"}`}>
          {user.totpEnabled ? "Activo" : "—"}
        </span>
      </td>

      <td className="border-b border-[var(--border)] px-4 py-3">
        {canManage ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => start(() => toggleUserActive(user.id, !user.active))}
            className="rounded-full border border-[var(--border-strong)] px-3 py-1 text-xs font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            {user.active ? "Desactivar" : "Activar"}
          </button>
        ) : (
          <span className="text-xs">{user.active ? "Activa" : "Inactiva"}</span>
        )}
      </td>
    </tr>
  );
}
