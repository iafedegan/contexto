"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CornerUpLeft, Eye, FilePlus2, Inbox, PenLine, Send, Timer, type LucideIcon } from "lucide-react";
import { recorridoDeNota } from "@/app/panel/(app)/articulos/comentarios-actions";
import type { PasoRecorrido } from "@/lib/recorrido-nota";

/** Recorrido de la nota en una línea de tiempo: quién la tuvo, qué hizo y cuándo. Se ve en el paso «Enviar» del asistente. */
const ICONO: Record<string, LucideIcon> = { creo: FilePlus2, recibio: Inbox, reviso: Eye, edito: PenLine, envio: Send, devolvio: CornerUpLeft, publico: CheckCircle2, programo: Timer };
const TONO: Record<string, string> = { edito: "bg-amber-400 text-[#3b2a00]", publico: "bg-[#157a4a] text-white", envio: "bg-[var(--accent)] text-[var(--accent-fg,#fff)]", devolvio: "bg-[var(--accent)] text-[var(--accent-fg,#fff)]" };
const hora = (iso: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Bogota" }).format(new Date(iso));

export function RecorridoNota({ articleId, sinMarco = false }: { articleId: string; /** Dentro de otra tarjeta (la de envío, al girarla): sin borde ni sombra propios. */ sinMarco?: boolean }) {
  const [pasos, setPasos] = useState<PasoRecorrido[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let vigente = true;
    recorridoDeNota(articleId)
      .then((r) => { if (!vigente) return; if (r.ok) setPasos(r.pasos); else setError(r.message); })
      .catch(() => vigente && setError("No se pudo cargar el recorrido."));
    return () => { vigente = false; };
  }, [articleId]);

  return (
    <section aria-label="Recorrido de la nota" className={sinMarco ? "" : "rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)] sm:p-5"}>
      <h3 className="text-base font-semibold">Recorrido de la nota</h3>
      <p className="mt-0.5 text-xs text-[var(--fg-muted)]">Por quién ha pasado y qué hizo cada persona. En amarillo, quien la editó.</p>
      {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
      {!pasos && !error && <p className="mt-3 text-xs text-[var(--fg-muted)]">Cargando…</p>}
      {pasos && pasos.length === 0 && <p className="mt-3 text-xs text-[var(--fg-muted)]">Todavía no hay movimientos registrados.</p>}
      {pasos && pasos.length > 0 && (
        <ol className="relative mt-4 flex flex-col gap-3 border-l border-[var(--border)] pl-5">
          {pasos.map((p, i) => {
            const Icono = ICONO[p.tipo] ?? PenLine;
            return (
              <li key={`${p.tipo}-${p.cuando}-${i}`} className="relative">
                <span aria-hidden className={`absolute -left-[1.95rem] top-0 grid size-6 place-items-center rounded-full ring-4 ring-[var(--surface)] ${TONO[p.tipo] ?? "bg-[var(--surface-2)] text-[var(--fg)]"}`}>
                  <Icono size={12} />
                </span>
                <p className="text-sm leading-snug">
                  <strong className={p.tipo === "edito" ? "rounded bg-amber-300/60 px-1" : undefined}>{p.quien}</strong> {p.texto}
                  {p.veces > 1 && p.tipo === "edito" && <span className="text-[var(--fg-muted)]"> ({p.veces} veces)</span>}
                </p>
                <p className="text-[0.7rem] text-[var(--fg-muted)]">{hora(p.cuando)}</p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
