"use client";

import Link from "next/link";

/**
 * Pantalla de error del panel. La causa más común es que la persona no tenga
 * el permiso de esa área (ver src/lib/permisos.ts); en producción Next oculta
 * el mensaje real, así que el texto cubre ese caso y el de un fallo puntual.
 */
export default function PanelError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="lx-kicker text-[var(--accent)]">Panel editorial</p>
      <h1 className="lx-display mt-3 text-2xl font-semibold">No se pudo abrir esta pantalla</h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--fg-muted)]">
        Puede que tu cuenta no tenga permiso para esta área. Si crees que deberías tenerlo, pide a un
        administrador que revise tus permisos en Configuración → Personas y roles. Si fue un fallo
        pasajero, vuelve a intentarlo.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/panel" className="lx-btn">Ir al resumen</Link>
        <button type="button" onClick={reset} className="lx-btn-ghost">Reintentar</button>
      </div>
    </div>
  );
}
