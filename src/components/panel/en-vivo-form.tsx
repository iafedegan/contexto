"use client";

import { useActionState, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { guardarEnVivo, revisarEnVivoAhora, type EnVivoState } from "@/app/panel/(app)/en-vivo/actions";
import type { EnVivoConfig } from "@/lib/en-vivo-types";

const campo = "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm";

const fechaHora = (iso: string) =>
  iso ? new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

/** Formulario del panel «En vivo»: modo automático (vigilar el canal), interruptor manual, enlace de YouTube y título opcional. */
export function EnVivoForm({ inicial }: { inicial: EnVivoConfig }) {
  const router = useRouter();
  const [estado, accion, pendiente] = useActionState<EnVivoState, FormData>(guardarEnVivo, null);
  const [auto, setAuto] = useState(inicial.auto);
  const [revision, setRevision] = useState<EnVivoState>(null);
  const [revisando, start] = useTransition();

  const semaforo =
    inicial.estadoCanal === "vivo" ? "🔴 En vivo ahora"
    : inicial.estadoCanal === "programado" ? `🟡 Directo programado${inicial.programado ? ` para el ${fechaHora(inicial.programado)}` : ""}`
    : inicial.estadoCanal === "sin" ? "⚪ Sin transmisión"
    : inicial.estadoCanal === "error" ? "🟡 YouTube no respondió en la última revisión"
    : "⚪ Aún sin revisar";

  return (
    <form action={accion} className="flex max-w-2xl flex-col gap-5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
      {/* Modo automático: lo más cómodo. El canal se revisa solo y la portada se enciende (y apaga) con el directo. */}
      <fieldset className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--border)] p-4">
        <label className="flex items-start gap-3 text-sm font-semibold">
          <input type="checkbox" name="auto" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="mt-0.5 size-5 accent-[var(--accent)]" />
          <span>
            Encender solo cuando el canal empiece a transmitir
            <span className="mt-0.5 block text-xs font-normal text-[var(--fg-muted)]">
              Cada 2 minutos se revisa el canal de YouTube. Si está en vivo, el directo ocupa la portada y se avisa a los suscriptores; cuando termina,
              se apaga solo. Una transmisión encendida a mano nunca se apaga sola.
            </span>
          </span>
        </label>
        {auto && (
          <>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-semibold">Canal de YouTube</span>
              <input name="canal" defaultValue={`https://www.youtube.com/${inicial.canal}`} placeholder="https://www.youtube.com/@ContextoGanadero" className={campo} />
            </label>
            {inicial.auto && (
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="font-semibold">{semaforo}</span>
                {inicial.revisado && <span className="text-[var(--fg-muted)]">Última revisión: {fechaHora(inicial.revisado)}</span>}
                <button
                  type="button"
                  disabled={revisando}
                  onClick={() =>
                    start(async () => {
                      setRevision(await revisarEnVivoAhora());
                      router.refresh();
                    })
                  }
                  className="rounded-full border border-[var(--border)] px-3 py-1 font-semibold hover:border-[var(--accent)] disabled:opacity-60"
                >
                  {revisando ? "Revisando…" : "Revisar ahora"}
                </button>
                {revision && <span role="status" className={revision.ok ? "text-[var(--accent-2)]" : "text-red-400"}>{revision.message}</span>}
              </div>
            )}
          </>
        )}
        {!auto && <input type="hidden" name="canal" value={`https://www.youtube.com/${inicial.canal}`} />}
      </fieldset>

      <label className="flex items-center gap-3 text-sm font-semibold">
        <input type="checkbox" name="activo" defaultChecked={inicial.activo} className="size-5 accent-[var(--accent)]" />
        Transmitir en vivo en la portada {inicial.activo && inicial.origen === "auto" && <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--accent)]">encendida sola</span>}
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold">Enlace de YouTube</span>
        <input name="url" type="url" defaultValue={inicial.url} placeholder="https://www.youtube.com/watch?v=… o https://www.youtube.com/live/…" className={campo} />
        <span className="text-xs text-[var(--fg-muted)]">
          Para encenderla a mano: el enlace del directo (watch, live o youtu.be). Con el modo automático no hace falta: se llena solo. Se reproduce sin
          cookies hasta que el lector le da al play.
        </span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold">Título de la transmisión (opcional)</span>
        <input name="titulo" defaultValue={inicial.titulo} maxLength={140} placeholder="Ej.: Asamblea general de Fedegán" className={campo} />
      </label>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-[var(--radius)] bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-fg)] disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        {estado && (
          <p role="status" className={`text-sm ${estado.ok ? "text-[var(--accent-2)]" : "text-red-400"}`}>
            {estado.message}
          </p>
        )}
      </div>
    </form>
  );
}
