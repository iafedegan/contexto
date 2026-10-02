"use client";

import { Fragment, useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import type { UserRole } from "@/db/schema";
import {
  changeUserRole,
  deleteUser,
  resetUserPermissions,
  resetUserTotp,
  setAiQuota,
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
  exige2fa = true,
  cuotaIA,
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
  /** ¿Se le exige 2FA? (casilla «Exigir 2FA»). */
  exige2fa?: boolean;
  /** Cuota de IA: la propia (null = usa la predeterminada), la que rige y lo gastado este mes. */
  cuotaIA?: { propia: number | null; efectiva: number | null; gasto: number };
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [marcas, setMarcas] = useState<Record<string, boolean>>(
    Object.fromEntries(permisos.map((p) => [p.id, p.activo])),
  );
  const [exigir, setExigir] = useState(exige2fa);
  const [cuotaTxt, setCuotaTxt] = useState(cuotaIA?.propia == null ? "" : String(cuotaIA.propia));
  const [cuotaMsg, setCuotaMsg] = useState("");
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
            <>
              <p className="text-xs text-[var(--fg-muted)]">
                Un administrador siempre tiene todos los permisos y no se puede restringir.
              </p>
              {cuotaIA && (
                <div className="mt-4 border-t border-[var(--border)] pt-4">
                  <p className="text-sm font-semibold">Cuota mensual de IA</p>
                  <p className="mt-1 text-xs text-[var(--fg-muted)]">
                    Este mes: US$ {cuotaIA.gasto.toFixed(2)}
                    {cuotaIA.efectiva === null ? " · sin tope" : ` de US$ ${cuotaIA.efectiva.toFixed(2)}`}
                    {cuotaIA.propia === null && cuotaIA.efectiva !== null ? " (la predeterminada)" : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm">US$</span>
                    <input type="text" inputMode="decimal" value={cuotaTxt} onChange={(e) => setCuotaTxt(e.target.value)} placeholder="predeterminada" className="lx-input py-1.5 text-sm" style={{ width: "9rem" }} />
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded-full border border-[var(--border-strong)] px-3 py-1 text-xs font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      onClick={() => {
                        const t = cuotaTxt.trim().replace(",", ".");
                        start(async () => setCuotaMsg((await setAiQuota(user.id, t === "" ? null : Number(t))).message));
                      }}
                    >
                      Guardar
                    </button>
                    {cuotaMsg && <span className="text-xs text-[var(--accent)]" role="status">{cuotaMsg}</span>}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
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
              {cuotaIA && (
                <div className="mt-4 border-t border-[var(--border)] pt-4">
                  <p className="text-sm font-semibold">Cuota mensual de IA</p>
                  <p className="mt-1 text-xs text-[var(--fg-muted)]">
                    Este mes: US$ {cuotaIA.gasto.toFixed(2)}
                    {cuotaIA.efectiva === null ? " · sin tope" : ` de US$ ${cuotaIA.efectiva.toFixed(2)}`}
                    {cuotaIA.propia === null && cuotaIA.efectiva !== null ? " (la predeterminada)" : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm">US$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={cuotaTxt}
                      onChange={(e) => setCuotaTxt(e.target.value)}
                      placeholder="predeterminada"
                      className="lx-input py-1.5 text-sm" style={{ width: "9rem" }}
                    />
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded-full border border-[var(--border-strong)] px-3 py-1 text-xs font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      onClick={() => {
                        const t = cuotaTxt.trim().replace(",", ".");
                        start(async () => setCuotaMsg((await setAiQuota(user.id, t === "" ? null : Number(t))).message));
                      }}
                    >
                      Guardar
                    </button>
                    {cuotaMsg && <span className="text-xs text-[var(--accent)]" role="status">{cuotaMsg}</span>}
                  </div>
                  <p className="mt-1 text-xs text-[var(--fg-muted)]">Vacío = usa la cuota predeterminada.</p>
                </div>
              )}
              <div className="mt-4 border-t border-[var(--border)] pt-4">
                <p className="text-sm font-semibold">Verificación en dos pasos (2FA)</p>
                <label className="mt-2 flex cursor-pointer items-start gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={exigir}
                    disabled={pending}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setError(null);
                      setExigir(v);
                      start(async () => {
                        const r = await setUserPermission(user.id, "exigir_2fa", v);
                        if (!r.ok) {
                          setExigir(!v);
                          setError(r.message);
                        }
                      });
                    }}
                    className="mt-0.5 size-4 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="block font-medium">Exigir 2FA a esta persona</span>
                    <span className="block text-xs text-[var(--fg-muted)]">
                      Apagada, entra solo con su contraseña y no se le pide activarlo.
                    </span>
                  </span>
                </label>
                {user.totpEnabled && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!confirm(`¿Quitar el 2FA de ${user.name}? Tendrá que volver a configurarlo (si se le exige) en su próximo ingreso.`)) return;
                      start(async () => {
                        const r = await resetUserTotp(user.id);
                        if (!r.ok) setError(r.message);
                      });
                    }}
                    className="mt-3 rounded-full border border-red-600/40 px-3 py-1 text-xs font-medium text-red-700 transition hover:bg-red-600/10"
                  >
                    Quitar su 2FA actual
                  </button>
                )}
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
