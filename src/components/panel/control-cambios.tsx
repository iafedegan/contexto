"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, GitCompareArrows, Loader2, Undo2, X } from "lucide-react";
import { aceptarCambiosNota, cambiosDeNota, rechazarCambioNota } from "@/app/panel/(app)/articulos/comentarios-actions";
import type { ControlDeCambios } from "@/lib/versiones-notas";

/**
 * Control de cambios de la nota, como en Word: el texto actual con lo que agregó cada persona resaltado en su color (amarillo la primera) y lo
 * que quitó, tachado. A la derecha, la lista de cambios con «Rechazar» uno por uno, y arriba «Aceptar todos» (deja la versión actual como punto
 * de partida, sin marcas). Al rechazar, el cuerpo de la nota se actualiza también en el editor (`alCambiarCuerpo`).
 */
export const COLORES_PERSONA = ["#fde047", "#7dd3fc", "#f9a8d4", "#c4b5fd", "#86efac", "#fdba74"];

export function ControlCambios({ articleId, alCambiarCuerpo, alCerrar }: { articleId: string; alCambiarCuerpo: (html: string) => void; alCerrar: () => void }) {
  const [control, setControl] = useState<ControlDeCambios | null>(null);
  const [error, setError] = useState("");
  const [elegido, setElegido] = useState<number | null>(null);
  const [ocupado, iniciar] = useTransition();

  useEffect(() => {
    let vigente = true;
    cambiosDeNota(articleId)
      .then((r) => { if (!vigente) return; if (r.ok) setControl(r.control); else setError(r.message); })
      .catch(() => vigente && setError("No se pudo cargar el control de cambios."));
    return () => { vigente = false; };
  }, [articleId]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && alCerrar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [alCerrar]);

  const estilo = useMemo(
    () =>
      COLORES_PERSONA.map(
        (c, i) =>
          `.cc-doc ins[data-persona="${i}"]{background:${c};text-decoration:none;border-radius:2px;box-shadow:0 0 0 1px ${c}}` +
          `.cc-doc del[data-persona="${i}"]{color:#b42318;text-decoration:line-through;text-decoration-color:#b42318;background:${c}55}`,
      ).join("") +
      `.cc-doc ins,.cc-doc del{cursor:pointer}.cc-doc [data-cambio="${elegido ?? -1}"]{outline:2px solid #0b6b67;outline-offset:1px}`,
    [elegido],
  );

  function rechazarUno(id: number) {
    setError("");
    iniciar(async () => {
      const r = await rechazarCambioNota(articleId, id);
      if (!r.ok) return setError(r.message);
      setControl(r.control);
      setElegido(null);
      if (r.cuerpo !== undefined) alCambiarCuerpo(r.cuerpo);
    });
  }
  function aceptarTodos() {
    setError("");
    iniciar(async () => {
      const r = await aceptarCambiosNota(articleId);
      if (!r.ok) return setError(r.message);
      setControl(r.control);
      setElegido(null);
    });
  }

  const persona = (nombre: string) => Math.max(0, control?.personas.indexOf(nombre) ?? 0);

  return (
    <div role="dialog" aria-modal="true" aria-label="Control de cambios" className="fixed inset-0 z-[90] flex bg-black/45 p-2 sm:p-6" onClick={(e) => e.target === e.currentTarget && alCerrar()}>
      <style dangerouslySetInnerHTML={{ __html: estilo }} />
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-[var(--radius-lg)] bg-white text-[#1b1b1b] shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-black/10 px-5 py-3">
          <GitCompareArrows size={18} aria-hidden className="text-[#0b6b67]" />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold leading-tight">Control de cambios</h2>
            <p className="text-xs text-black/55">Lo agregado va resaltado en el color de cada persona; lo quitado, tachado en rojo. Toca un cambio para verlo en la lista.</p>
          </div>
          {control?.hay && control.cambios.length > 0 && (
            <button type="button" disabled={ocupado} onClick={aceptarTodos} className="lx-btn !min-h-9 !px-3 text-xs disabled:opacity-60">
              {ocupado ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Check size={14} aria-hidden />} Aceptar todos
            </button>
          )}
          <button type="button" onClick={alCerrar} aria-label="Cerrar el control de cambios" className="rounded-full p-1.5 text-black/60 hover:bg-black/5"><X size={18} /></button>
        </header>

        {control && control.personas.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-black/10 px-5 py-2 text-xs">
            <span className="font-semibold text-black/60">Quién cambió:</span>
            {control.personas.map((p, i) => (
              <span key={p} className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-3 rounded-sm" style={{ background: COLORES_PERSONA[i % COLORES_PERSONA.length] }} /> {p}
              </span>
            ))}
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-10">
            {error && <p role="alert" className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            {!control && !error && <p className="text-sm text-black/55">Cargando…</p>}
            {control && !control.hay && (
              <p className="rounded bg-black/5 px-4 py-3 text-sm">
                {control.editaronSinVersion.length > 1
                  ? `La editaron ${control.editaronSinVersion.join(", ").replace(/, ([^,]*)$/, " y $1")}, pero antes de que se guardaran versiones del texto, así que esos cambios no se pueden marcar. Desde ahora, cuando otra persona la corrija o se la pasen, cada cambio quedará marcado aquí con el nombre de quien lo hizo.`
                  : "Esta nota todavía no ha pasado de una persona a otra. Cuando alguien la envíe o la corrija otra persona, desde ese momento cada cambio quedará marcado aquí con el nombre de quien lo hizo."}
              </p>
            )}
            {control?.hay && control.cambios.length === 0 && !control.titulo.includes("<ins") && !control.titulo.includes("<del") && (
              <p className="mb-4 rounded bg-[#157a4a]/10 px-4 py-3 text-sm text-[#157a4a]">Sin cambios pendientes desde la última versión aceptada.</p>
            )}
            {control?.hay && (
              <article
                className="cc-doc mx-auto max-w-3xl font-serif text-[1.05rem] leading-relaxed [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:my-3"
                onClick={(e) => {
                  const m = (e.target as HTMLElement).closest("[data-cambio]");
                  if (m) setElegido(Number(m.getAttribute("data-cambio")));
                }}
              >
                <h1 className="mb-4 font-sans text-2xl font-bold leading-tight" dangerouslySetInnerHTML={{ __html: control.titulo }} />
                <div dangerouslySetInnerHTML={{ __html: control.cuerpo }} />
              </article>
            )}
          </div>

          {control?.hay && control.cambios.length > 0 && (
            <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-black/10 bg-[#f6f8f8] p-3 md:block" aria-label="Lista de cambios">
              <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-black/55">{control.cambios.length} {control.cambios.length === 1 ? "cambio" : "cambios"}</p>
              <ol className="flex flex-col gap-2">
                {control.cambios.map((c) => (
                  <li key={c.id}>
                    <div
                      className={`rounded-md border bg-white p-2.5 text-xs shadow-sm ${elegido === c.id ? "border-[#0b6b67] ring-1 ring-[#0b6b67]" : "border-black/10"}`}
                      onMouseEnter={() => setElegido(c.id)}
                    >
                      <p className="flex items-center gap-1.5 font-semibold">
                        <span aria-hidden className="size-2.5 rounded-sm" style={{ background: COLORES_PERSONA[persona(c.autor) % COLORES_PERSONA.length] }} />
                        {c.autor} {c.tipo === "pone" ? "agregó" : "quitó"}
                      </p>
                      <p className={`mt-1 line-clamp-3 ${c.tipo === "quita" ? "text-red-700 line-through" : ""}`}>«{c.texto.trim().slice(0, 220)}»</p>
                      <button type="button" disabled={ocupado} onClick={() => rechazarUno(c.id)} className="mt-1.5 inline-flex items-center gap-1 font-medium text-[#0b6b67] hover:underline disabled:opacity-50">
                        <Undo2 size={12} aria-hidden /> Rechazar
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
