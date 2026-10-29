"use client";

import { useState, useTransition } from "react";
import { crearRol, eliminarRol, guardarRol, guardarRolIncorporado } from "@/app/panel/(app)/configuracion/roles-actions";
import { PERMISOS, porDefecto, type PermisoId } from "@/lib/permisos";
import { ROLES_BASE, comoRolPropio, nombreRol, permisoDeRol, type CambiosRoles, type RolPropio } from "@/lib/roles";
import type { UserRole } from "@/db/schema";

// Cantidad de personas por rol, para mostrarla junto al nombre (sin listar a nadie).
type Conteo = Record<string, number>;

/** Pestaña «Roles»: qué da cada rol, edición de los propios y creación de roles nuevos. Aquí no hay personas: se asignan en «Cuentas». */
export function RolesEditor({ propios, conteo, cambios }: { propios: RolPropio[]; conteo: Conteo; cambios: CambiosRoles }) {
  const [nombre, setNombre] = useState("");
  const [base, setBase] = useState<UserRole>("redactor");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)]/40 p-4">
        <p className="text-sm font-semibold">Crear un rol nuevo</p>
        <p className="mt-1 text-xs text-[var(--fg-muted)]">Parte de un rol base y luego enciendes o apagas lo que quieras. Después lo asignas a una persona desde «Cuentas».</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (p. ej. Fotógrafo)" maxLength={40} className="lx-input py-1.5 text-sm" style={{ width: "15rem" }} />
          <select value={base} onChange={(e) => setBase(e.target.value as UserRole)} className="lx-input py-1.5 text-sm">
            {ROLES_BASE.map((r) => (
              <option key={r} value={r}>Basado en {nombreRol(r)}</option>
            ))}
          </select>
          <button
            type="button"
            className="lx-btn"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await crearRol(nombre, base);
                setMsg(r.message);
                if (r.ok) setNombre("");
              })
            }
          >
            Crear rol
          </button>
          {msg && <span className="text-xs text-[var(--accent)]" role="status">{msg}</span>}
        </div>
      </div>

      {propios.length > 0 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-semibold">Roles propios</p>
          {propios.map((r) => (
            <RolPropioCard key={r.id + JSON.stringify(r.permisos) + r.nombre} rol={r} personas={conteo[r.id] ?? 0} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <p className="text-sm font-semibold">Roles de siempre</p>
        <p className="text-xs text-[var(--fg-muted)]">También se pueden ajustar: el cambio se aplica a todas las personas que tengan ese rol. El administrador siempre tiene todo.</p>
        {(["redactor", "disenador", "editor"] as UserRole[]).map((r) => (
          <RolPropioCard key={r + JSON.stringify(cambios[r] ?? {})} rol={comoRolPropio(r, cambios)} personas={conteo[r] ?? 0} incorporado />
        ))}
        <details className="rounded-[var(--radius)] border border-[var(--border)]">
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium">
            <span>Administrador</span>
            <span className="text-xs text-[var(--fg-muted)]">{conteo.administrador ?? 0} {conteo.administrador === 1 ? "persona" : "personas"} · todo, fijo</span>
          </summary>
          <p className="border-t border-[var(--border)] px-4 py-3 text-sm text-[var(--fg-muted)]">Tiene todos los permisos y no se puede restringir, para que el panel nunca se quede sin quien lo gestione.</p>
        </details>
      </div>
    </div>
  );
}

// Tarjeta de un rol propio: nombre, casillas de permisos, guardar y eliminar.
function RolPropioCard({ rol, personas, incorporado = false }: { rol: RolPropio; personas: number; incorporado?: boolean }) {
  const [nombre, setNombre] = useState(rol.nombre);
  const [marcas, setMarcas] = useState<Record<string, boolean>>(Object.fromEntries(PERMISOS.map((p) => [p.id, permisoDeRol(rol, p.id as PermisoId)])));
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        {incorporado ? (
          <span className="text-sm font-semibold capitalize">{rol.nombre}</span>
        ) : (
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} className="lx-input py-1.5 text-sm font-semibold" style={{ width: "14rem" }} />
        )}
        <span className="text-xs text-[var(--fg-muted)]">{incorporado ? "" : `basado en ${nombreRol(rol.base)} · `}{personas} {personas === 1 ? "persona" : "personas"}</span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {PERMISOS.map((p) => (
          <label key={p.id} className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input type="checkbox" checked={marcas[p.id] ?? false} onChange={(e) => setMarcas((m) => ({ ...m, [p.id]: e.target.checked }))} className="mt-0.5 size-4 accent-[var(--accent)]" />
            <span>
              <span className="block font-medium">{p.label}</span>
              <span className="block text-xs text-[var(--fg-muted)]">{p.hint}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="lx-btn" disabled={pending} onClick={() => start(async () => setMsg((incorporado ? await guardarRolIncorporado(rol.id, marcas) : await guardarRol(rol.id, nombre, marcas)).message))}>
          Guardar rol
        </button>
        {incorporado ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setMarcas(Object.fromEntries(PERMISOS.map((p) => [p.id, porDefecto(rol.base, p.id as PermisoId)])));
              start(async () => setMsg((await guardarRolIncorporado(rol.id, {})).message.replace("Rol guardado.", "Restablecido a los de fábrica.")));
            }}
            className="rounded-full border border-[var(--border-strong)] px-3 py-1 text-xs font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Restablecer los de fábrica
          </button>
        ) : (
        <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`¿Eliminar el rol «${rol.nombre}»? ${personas ? `Las ${personas} personas que lo tienen vuelven a ${nombreRol(rol.base)}.` : ""}`)) return;
              start(async () => setMsg((await eliminarRol(rol.id)).message));
            }}
            className="rounded-full border border-red-600/40 px-3 py-1 text-xs font-medium text-red-700 transition hover:bg-red-600/10"
          >
            Eliminar rol
          </button>
        )}
        {msg && <span className="text-xs text-[var(--accent)]" role="status">{msg}</span>}
      </div>
    </div>
  );
}
