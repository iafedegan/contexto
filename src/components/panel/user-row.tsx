"use client";

import { CuotaBarra } from "@/components/panel/cuota-ia-form";
import { Fragment, useState, useTransition } from "react";
import { ChevronDown, Copy, KeyRound, Loader2, Lock, LockOpen } from "lucide-react";
import type { UserRole } from "@/db/schema";
import {
  deleteUser,
  desbloquearUsuario,
  restablecerClave,
  resetUserPermissions,
  resetUserTotp,
  setAiQuota,
  setUserPermission,
  toggleUserActive,
} from "@/app/panel/(app)/configuracion/actions";
import { ROLES } from "@/lib/permisos";
import { asignarRol } from "@/app/panel/(app)/configuracion/roles-actions";
import { confirmar } from "@/components/panel/confirmar";

/**
 * Fila de persona. El cambio de rol se aplica al instante (sin botón de
 * guardar): son decisiones de una sola variable y confirmarlas dos veces
 * sobra. Un administrador no puede tocarse a sí mismo — ver `actions.ts`.
 */
export type PermisoVista = { id: string; label: string; hint: string; activo: boolean; porDefecto: boolean };

// Fila de una persona del equipo: rol, estado, permisos, segundo factor y cuota de IA.
export function UserRow({
  user,
  canManage,
  isSelf,
  permisos = [],
  exige2fa = true,
  cuotaIA,
  rolesPropios = [],
  rolId,
  ultimoAcceso,
  bloqueadoHasta,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    active: boolean;
    totpEnabled: boolean;
    /** Entró con una contraseña temporal y aún no la cambia. */
    mustChangePassword?: boolean;
  };
  canManage: boolean;
  isSelf: boolean;
  /** Roles propios del sitio, para el selector de rol. */
  rolesPropios?: { id: string; nombre: string }[];
  /** Rol propio que tiene esta persona, si lo tiene. */
  rolId?: string;
  /** Casillas de permisos de esta persona (solo las ve un administrador). */
  permisos?: PermisoVista[];
  /** ¿Se le exige 2FA? (casilla «Exigir 2FA»). */
  exige2fa?: boolean;
  /** Cuota de IA: la propia (null = usa la predeterminada), la que rige y lo gastado este mes. */
  /** Último inicio de sesión ya formateado (hora de Colombia). */
  ultimoAcceso?: string;
  /** Hora (Colombia) hasta la que la cuenta está bloqueada por intentos fallidos; sin valor = no está bloqueada. */
  bloqueadoHasta?: string;
  cuotaIA?: { propia: number | null; efectiva: number | null; gasto: number };
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  // Restablecer la contraseña: el resultado (y la temporal, si el correo no salió) se muestra en la propia fila.
  const [reinicio, setReinicio] = useState<{ ok: boolean; message: string; clave?: string } | null>(null);
  const [reiniciando, reiniciarT] = useTransition();
  const [copiada, setCopiada] = useState(false);
  const [desbloqueo, setDesbloqueo] = useState<{ ok: boolean; message: string } | null>(null);
  const [desbloqueando, desbloquearT] = useTransition();
  const [marcas, setMarcas] = useState<Record<string, boolean>>(
    Object.fromEntries(permisos.map((p) => [p.id, p.activo])),
  );
  const [exigir, setExigir] = useState(exige2fa);
  const [cuotaTxt, setCuotaTxt] = useState(cuotaIA?.propia == null ? "" : String(cuotaIA.propia));
  const [cuotaMsg, setCuotaMsg] = useState("");
  const esAdmin = user.role === "administrador";
  const personalizado = permisos.some((p) => marcas[p.id] !== p.porDefecto);

  // Marca o desmarca un permiso.
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
        <span className="block text-xs text-[var(--fg-muted)]">{ultimoAcceso ? `Último acceso: ${ultimoAcceso}` : "Sin accesos registrados"}</span>
        {/* Estado de la cuenta: bloqueada por intentos fallidos o desactivada por un administrador. */}
        {bloqueadoHasta && (
          <span className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-red-600/12 px-2.5 py-1 text-xs font-semibold text-red-700">
              <Lock size={12} aria-hidden /> Bloqueada por intentos fallidos · hasta las {bloqueadoHasta}
            </span>
            {canManage && (
              <button
                type="button"
                disabled={desbloqueando}
                onClick={() => {
                  setDesbloqueo(null);
                  desbloquearT(async () => setDesbloqueo(await desbloquearUsuario(user.id)));
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#157a4a] px-3 py-1 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {desbloqueando ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <LockOpen size={12} aria-hidden />} Desbloquear
              </button>
            )}
          </span>
        )}
        {desbloqueo && <span role="status" className={`mt-1 block text-xs ${desbloqueo.ok ? "text-[#157a4a]" : "text-red-700"}`}>{desbloqueo.message}</span>}
        {/* Estado SIEMPRE visible: activa (puede entrar), desactivada por un administrador o bloqueada por intentos fallidos (esta última, arriba, con su botón). */}
        {!bloqueadoHasta && (
          user.active ? (
            <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-[#157a4a]/12 px-2.5 py-1 text-xs font-semibold text-[#157a4a]">
              <span className="size-1.5 rounded-full bg-[#157a4a]" aria-hidden /> Activa · no está bloqueada
            </span>
          ) : (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-red-600/12 px-2.5 py-1 text-xs font-semibold text-red-700"><Lock size={12} aria-hidden /> Desactivada: no puede entrar</span>
          )
        )}
        {cuotaIA && <CuotaBarra gasto={cuotaIA.gasto} tope={cuotaIA.efectiva} compacta />}
      </td>

      <td data-etiqueta="Rol" className="border-b border-[var(--border)] px-4 py-3">
        {canManage ? (
          <select
            value={rolId && rolesPropios.some((r) => r.id === rolId) ? `rol:${rolId}` : user.role}
            disabled={pending}
            onChange={(e) => {
              const v = e.target.value;
              setError(null);
              start(async () => {
                const r = await asignarRol(user.id, v);
                if (!r.ok) setError(r.message);
              });
            }}
            className="lx-input py-1.5 text-xs"
          >
            <optgroup label="Roles de siempre">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r === "disenador" ? "diseñador" : r}
                </option>
              ))}
            </optgroup>
            {rolesPropios.length > 0 && (
              <optgroup label="Roles propios">
                {rolesPropios.map((r) => (
                  <option key={r.id} value={`rol:${r.id}`}>
                    {r.nombre}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        ) : (
          <span className="text-xs">{rolId && rolesPropios.find((r) => r.id === rolId)?.nombre || user.role}</span>
        )}
      </td>

      <td data-etiqueta="Contraseña" className="border-b border-[var(--border)] px-4 py-3">
        {user.mustChangePassword ? (
          <span className="inline-block rounded-full bg-[#d97706]/12 px-2.5 py-1 text-xs font-medium leading-snug text-[#92400e]">Primer ingreso: falta cambiar la contraseña</span>
        ) : (
          <span className="text-xs text-[var(--fg-muted)]">Propia</span>
        )}
        {canManage && (
          <div className="mt-2 flex flex-col items-start gap-1.5">
            <button
              type="button"
              disabled={reiniciando}
              onClick={async () => {
                if (!(await confirmar(`¿Restablecer la contraseña de ${user.name}? Se le pondrá una temporal, se le enviará a ${user.email} y tendrá que cambiarla al entrar. La que tiene ahora deja de servir.`))) return;
                setReinicio(null);
                setCopiada(false);
                reiniciarT(async () => setReinicio(await restablecerClave(user.id)));
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3 py-1 text-xs font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-60"
            >
              {reiniciando ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <KeyRound size={12} aria-hidden />} Restablecer contraseña
            </button>
            {reinicio && (
              <div role="status" className={`max-w-xs text-xs leading-snug ${reinicio.ok && !reinicio.clave ? "text-[#157a4a]" : reinicio.ok ? "text-[#92400e]" : "text-red-700"}`}>
                <p>{reinicio.message}</p>
                {reinicio.clave && (
                  <p className="mt-1 flex items-center gap-2">
                    <code className="rounded bg-[var(--surface-2)] px-2 py-1 font-mono text-sm text-[var(--fg)]">{reinicio.clave}</code>
                    <button type="button" onClick={() => { void navigator.clipboard?.writeText(reinicio.clave!).then(() => setCopiada(true)); }} className="inline-flex items-center gap-1 font-medium text-[var(--accent)] hover:underline">
                      <Copy size={12} aria-hidden /> {copiada ? "Copiada" : "Copiar"}
                    </button>
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </td>

      <td data-etiqueta="Estado" className="border-b border-[var(--border)] px-4 py-3">
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
            onClick={async () => {
              if (!(await confirmar(`¿Eliminar la cuenta de ${user.name} (${user.email})? No se puede deshacer. Sus artículos se conservan.`))) return;
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
                  <CuotaBarra gasto={cuotaIA.gasto} tope={cuotaIA.efectiva} />
                  {cuotaIA.propia === null && cuotaIA.efectiva !== null && <p className="mt-1 text-xs text-[var(--fg-muted)]">Usa la cuota predeterminada.</p>}
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
                  <CuotaBarra gasto={cuotaIA.gasto} tope={cuotaIA.efectiva} />
                  {cuotaIA.propia === null && cuotaIA.efectiva !== null && <p className="mt-1 text-xs text-[var(--fg-muted)]">Usa la cuota predeterminada.</p>}
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
                    onClick={async () => {
                      if (!(await confirmar(`¿Quitar el 2FA de ${user.name}? Tendrá que volver a configurarlo (si se le exige) en su próximo ingreso.`))) return;
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
