"use client";

import { useActionState } from "react";
import { Check, Link2, Loader2, TriangleAlert } from "lucide-react";
import { vincularEsteNavegador, type VinculoState } from "@/app/panel/(app)/analitica/actions";

/** Une el navegador desde el que se mira (celular o computador) con un suscriptor, con la autorización de la propia persona. */
export function VincularNavegador({ codigo }: { codigo: string | null }) {
  const [estado, accion, pendiente] = useActionState<VinculoState, FormData>(vincularEsteNavegador, null);
  return (
    <form action={accion} className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
      <div>
        <p className="lx-kicker text-[var(--accent)]">Unir celular o computador con una cuenta</p>
        <h2 className="lx-display mt-1 text-xl font-semibold">Vincular este navegador con un suscriptor</h2>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          {codigo ? <>Este navegador es el <strong>lector {codigo}</strong>. </> : <>Este navegador aún no tiene lecturas medidas. </>}
          Haz esto en cada aparato (celular, computador) desde el que lee la persona: entra al panel en él y repite.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-xs font-semibold text-[var(--fg-muted)]">
          Correo del suscriptor
          <input name="email" type="email" required autoComplete="email" placeholder="correo@ejemplo.com" className="min-h-11 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm font-normal text-[var(--fg)]" />
        </label>
        <button disabled={pendiente} className="lx-btn inline-flex min-h-11 items-center gap-2 px-4 text-sm">
          {pendiente ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Link2 size={15} aria-hidden />} Vincular
        </button>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirmo" className="mt-1 size-4" />
        <span>Esta persona está aquí, este navegador es suyo y autoriza que lo que lea se relacione con su suscripción.</span>
      </label>
      {estado && (
        <p role="status" className={`flex items-start gap-2 text-sm ${estado.ok ? "text-[#157a4a]" : "text-[#b4232a]"}`}>
          {estado.ok ? <Check size={16} className="mt-0.5 shrink-0" aria-hidden /> : <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />} {estado.mensaje}
        </p>
      )}
    </form>
  );
}
