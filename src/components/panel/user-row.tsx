"use client";

import { Fragment, useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import type { UserRole } from "@/db/schema";
import {
  changeUserRole,
  deleteUser,
  resetUserPermissions,
  setUserPermission,
  toggleUserActive,
} from "@/app/panel/(app)/configuracion/actions";

const ROLES: UserRole[] = ["redactor", "editor", "administrador"];

/**
 * Fila de persona. El cambio de rol se aplica al instante (sin botón de
 * guardar): son decisiones de una sola variable y confirmarlas dos veces
 * sobra. Un administrador no puede tocarse a sí mismo — ver `actions.ts`.
 */
export type PermisoVista = { id: string; label: string; hint: string; activo: boolean; porDefecto: boolean };

export function UserRow({
  user,
  canManage,
  isSelf,
  permisos = [],
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
  /** Casillas de permisos de esta persona (solo las ve un administrador). */
  permisos?: PermisoVista[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [marcas, setMarcas] = useState<Record<string, boolean>>(
    Object.fromEntries(permisos.map((p) => [p.id, p.activo])),
  );
  const esAdmin = user.role === "administrador";
  const personalizado = permisos.some((p) => marcas[p.id] !== p.porDefecto);

  function marcar(id: string, valor: boolean) {
    setError(null);
    setMarcas((m) => ({ ...m, [id]: valor }));
    start(async () => {
      const r = await setUserPermission(user.id, id, valor);
      if (!r.ok) {
        setMarcas((m) => ({ ...m, [id]: !valor }));
        setError(r.message);
      }
    });
  }

  return (
    <Fragment>
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
          <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => start(() => toggleUserActive(user.id, !user.active))}
            className="rounded-full border border-[var(--border-strong)] px-3 py-1 text-xs font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            {user.active ? "Desactivar" : "Activar"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`¿Eliminar la cuenta de ${user.name} (${user.email})? No se puede deshacer. Sus artículos se conservan.`)) return;
              setError(null);
              start(async () => {
                const r = await deleteUser(user.id);
                if (!r.ok) setError(r.message);
              });
            }}
            className="rounded-full border border-red-600/40 px-3 py-1 text-xs font-medium text-red-700 transition hover:bg-red-600/10"
          >
            Eliminar
          </button>
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border-strong)] px-3 py-1 text-xs font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Permisos
            {personalizado && <span className="size-1.5 rounded-full bg-[var(--accent-2)]" title="Personalizado" />}
            <ChevronDown size={12} className={`transition-transform ${abierto ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {error && <span className="basis-full text-xs text-red-700" role="alert">{error}</span>}
          </div>
        ) : (
          <span className="text-xs">{user.active ? "Activa" : "Inactiva"}</span>
        )}
      </td>
    </tr>
    {canManage && abierto && (
      <tr>
        <td colSpan={4} className="border-b border-[var(--border)] bg-[var(--surface-2)]/40 px-4 py-4">
          {esAdmin ? (
            <p className="text-xs text-[var(--fg-muted)]">
              Un administrador siempre tiene todos los permisos y no se puede restringir.
            </p>
          ) : (
            <>
              <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {permisos.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-start gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={marcas[p.id] ?? false}
                      disabled={pending}
                      onChange={(e) => marcar(p.id, e.target.checked)}
                      className="mt-0.5 size-4 accent-[var(--accent)]"
                    />
                    <span>
                      <span className="block font-medium">{p.label}</span>
                      <span className="block text-xs text-[var(--fg-muted)]">{p.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--fg-muted)]">
                <span>
                  {personalizado ? "Permisos personalizados para esta persona." : `Permisos por defecto del rol ${user.role}.`}
                </span>
                {personalizado && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await resetUserPermissions(user.id);
                        setMarcas(Object.fromEntries(permisos.map((p) => [p.id, p.porDefecto])));
                      })
                    }
                    className="underline hover:text-[var(--accent)]"
                  >
                    Restablecer a los del rol
                  </button>
                )}
              </div>
            </>
          )}
        </td>
      </tr>
    )}
    </Fragment>
  );
}
