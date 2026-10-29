"use client";

import { useState, useTransition } from "react";
import { crearRol, eliminarRol, guardarRol } from "@/app/panel/(app)/configuracion/roles-actions";
import { PERMISOS, porDefecto, type PermisoId } from "@/lib/permisos";
import { ROLES_BASE, nombreRol, permisoDeRol, type RolPropio } from "@/lib/roles";
import type { UserRole } from "@/db/schema";

// Cantidad de personas por rol, para mostrarla junto al nombre (sin listar a nadie).
type Conteo = Record<string, number>;

/** Pestaña «Roles»: qué da cada rol, edición de los propios y creación de roles nuevos. Aquí no hay personas: se asignan en «Cuentas». */
export function RolesEditor({ propios, conteo }: { propios: RolPropio[]; conteo: Conteo }) {
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

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold">Roles de siempre</p>
        <p className="text-xs text-[var(--fg-muted)]">Vienen fijos. Si necesitas uno parecido con otros permisos, crea un rol propio basado en él.</p>
        {(["redactor", "disenador", "editor", "administrador"] as UserRole[]).map((r) => (
          <details key={r} className="rounded-[var(--radius)] border border-[var(--border)]">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium">
              <span className="capitalize">{nombreRol(r)}</span>
              <span className="text-xs text-[var(--fg-muted)]">{conteo[r] ?? 0} {conteo[r] === 1 ? "persona" : "personas"}</span>
            </summary>
            <ul className="grid gap-x-6 gap-y-1 border-t border-[var(--border)] px-4 py-3 text-sm sm:grid-cols-2">
              {PERMISOS.map((p) => {
                const on = r === "administrador" || porDefecto(r, p.id);
                return (
                  <li key={p.id} className={on ? "" : "text-[var(--fg-muted)] line-through"}>
                    {on ? "✓" : "–"} {p.label}
                  </li>
                );
              })}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
}

// Tarjeta de un rol propio: nombre, casillas de permisos, guardar y eliminar.
function RolPropioCard({ rol, personas }: { rol: RolPropio; personas: number }) {
  const [nombre, setNombre] = useState(rol.nombre);
  const [marcas, setMarcas] = useState<Record<string, boolean>>(Object.fromEntries(PERMISOS.map((p) => [p.id, permisoDeRol(rol, p.id as PermisoId)])));
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} className="lx-input py-1.5 text-sm font-semibold" style={{ width: "14rem" }} />
        <span className="text-xs text-[var(--fg-muted)]">basado en {nombreRol(rol.base)} · {personas} {personas === 1 ? "persona" : "personas"}</span>
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
        <button type="button" className="lx-btn" disabled={pending} onClick={() => start(async () => setMsg((await guardarRol(rol.id, nombre, marcas)).message))}>
          Guardar rol
        </button>
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
        {msg && <span className="text-xs text-[var(--accent)]" role="status">{msg}</span>}
      </div>
    </div>
  );
}
