"use client";

import { useActionState } from "react";
import { Check, Loader2, TriangleAlert, Trash2 } from "lucide-react";
import { clearAdsZone, saveAdsZone, type AdsZoneState } from "@/app/panel/(app)/configuracion/ads-actions";
import type { AdZoneKey } from "@/lib/ads";

export type AdsZoneRow = {
  key: AdZoneKey;
  name: string;
  html: string | null;
  imageUrl: string | null;
  clickUrl: string | null;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  width: number;
  height: number;
};

/** Fecha en el formato que espera un <input type="datetime-local">. */
function paraInput(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AdsZoneForm({ zone, canManage }: { zone: AdsZoneRow; canManage: boolean }) {
  const [state, action, pending] = useActionState<AdsZoneState, FormData>(saveAdsZone, null);
  const vacia = !zone.html && !zone.imageUrl;

  return (
    <form
      action={action}
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] p-4"
    >
      <input type="hidden" name="key" value={zone.key} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{zone.name}</p>
          <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
            {zone.width} × {zone.height} px · <code className="lx-mono">{zone.key}</code>
          </p>
        </div>

        <label className="flex items-center gap-2 text-xs font-medium">
          <input
            type="checkbox"
            name="active"
            value="1"
            defaultChecked={zone.active}
            disabled={!canManage}
            className="size-4 accent-[var(--accent)]"
          />
          Activa en el sitio
        </label>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
            URL de la imagen
          </span>
          <input
            name="imageUrl"
            defaultValue={zone.imageUrl ?? ""}
            placeholder="https://…/banner.jpg"
            disabled={!canManage}
            className="lx-mono rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs outline-none focus:border-[var(--accent)] disabled:opacity-60"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
            Enlace al hacer clic
          </span>
          <input
            name="clickUrl"
            defaultValue={zone.clickUrl ?? ""}
            placeholder="https://anunciante.com/…"
            disabled={!canManage}
            className="lx-mono rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs outline-none focus:border-[var(--accent)] disabled:opacity-60"
          />
        </label>
      </div>

      <label className="mt-3 flex flex-col gap-1">
        <span className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
          O código HTML del anunciante (script de un ad server) · si lo usas, deja la imagen vacía
        </span>
        <textarea
          name="html"
          defaultValue={zone.html ?? ""}
          rows={2}
          placeholder="<script>…</script> o <a>…</a>"
          disabled={!canManage}
          className="lx-mono rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs outline-none focus:border-[var(--accent)] disabled:opacity-60"
        />
      </label>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
            Empieza (opcional)
          </span>
          <input
            type="datetime-local"
            name="startsAt"
            defaultValue={paraInput(zone.startsAt)}
            disabled={!canManage}
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs outline-none focus:border-[var(--accent)] disabled:opacity-60"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
            Termina (opcional)
          </span>
          <input
            type="datetime-local"
            name="endsAt"
            defaultValue={paraInput(zone.endsAt)}
            disabled={!canManage}
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs outline-none focus:border-[var(--accent)] disabled:opacity-60"
          />
        </label>
      </div>

      {canManage && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-60"
          >
            {pending && <Loader2 size={13} className="animate-spin" />}
            Guardar zona
          </button>

          {!vacia && (
            <button
              type="button"
              disabled={pending}
              onClick={() => clearAdsZone(zone.key)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--fg-muted)] transition hover:border-[var(--danger,#b4442e)] hover:text-[var(--danger,#b4442e)]"
            >
              <Trash2 size={12} /> Vaciar
            </button>
          )}

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
      )}
    </form>
  );
}
