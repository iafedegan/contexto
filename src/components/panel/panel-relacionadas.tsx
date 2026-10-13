"use client";

import { useState, useTransition } from "react";
import { Check, Link2, Loader2, Search, TriangleAlert } from "lucide-react";
import { buscarRelacionadas, type NotaRelacionada } from "@/app/panel/(app)/articulos/ai-actions";
import { aplicarRelacionadas, contarRemisionesMuertas, limpiarRemisiones } from "@/lib/ai/relacionadas-html";

const fecha = (iso: string | null) => (iso ? new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" }).format(new Date(iso)) : "");

/**
 * Notas relacionadas de CONtexto Ganadero: busca, solo entre las notas del propio medio, las que tratan lo mismo que la que se escribe y
 * las añade al final con su enlace real. También quita las remisiones «Lea en CONtexto ganadero» que no llevan a ninguna parte.
 * Nunca se inserta nada sin que la persona lo elija.
 */
export function PanelRelacionadas({
  title,
  excerpt,
  body,
  excluirId,
  alCambiar,
}: {
  title: string;
  excerpt: string;
  body: string;
  excluirId?: string;
  /** Recibe el cuerpo ya con las remisiones aplicadas. */
  alCambiar: (html: string) => void;
}) {
  const [buscando, buscar] = useTransition();
  const [notas, setNotas] = useState<NotaRelacionada[] | null>(null);
  const [criterio, setCriterio] = useState<"ia" | "palabras">("ia");
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState("");
  const muertas = contarRemisionesMuertas(body);
  // Las ya enlazadas en el cuerpo no se ofrecen otra vez.
  const yaEnlazadas = new Set([...body.matchAll(/href="([^"]+)"/g)].map((m) => m[1]));

  const ejecutar = () => {
    setError("");
    setHecho("");
    buscar(async () => {
      const r = await buscarRelacionadas({ title, excerpt, body, excluirId, limite: 3 });
      if (!r.ok) return setError(r.error);
      const nuevas = r.notas.filter((n) => !yaEnlazadas.has(n.url));
      setNotas(nuevas);
      setCriterio(r.criterio);
      setElegidas(new Set(nuevas.map((n) => n.url)));
    });
  };

  const insertar = () => {
    const lista = (notas ?? []).filter((n) => elegidas.has(n.url));
    alCambiar(aplicarRelacionadas(body, lista));
    setHecho(lista.length ? `Se añadieron ${lista.length} ${lista.length === 1 ? "nota" : "notas"} al final.` : "Quedó sin remisiones.");
    setNotas(null);
  };

  return (
    <div className="shrink-0 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Link2 size={14} className="text-[var(--accent)]" aria-hidden /> Notas relacionadas de CONtexto Ganadero
        </span>
        <button type="button" onClick={ejecutar} disabled={buscando || title.trim().length < 5} className="lx-btn-ghost !py-1 text-xs disabled:opacity-60">
          {buscando ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
          {buscando ? "Buscando…" : "Buscar relacionadas"}
        </button>
        {muertas > 0 && (
          <span className="inline-flex items-center gap-2 text-xs text-[var(--danger,#b4442e)]">
            <TriangleAlert size={13} aria-hidden />
            {muertas === 1 ? "1 remisión «Lea en…» no lleva a ninguna nota" : `${muertas} remisiones «Lea en…» no llevan a ninguna nota`}
            <button type="button" className="lx-link font-semibold" onClick={() => { alCambiar(limpiarRemisiones(body)); setHecho("Se quitaron las remisiones sin destino."); }}>
              Quitar
            </button>
          </span>
        )}
        {hecho && (
          <span role="status" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-2)]">
            <Check size={13} aria-hidden /> {hecho}
          </span>
        )}
        {title.trim().length < 5 && <span className="text-xs text-[var(--fg-muted)]">Escribe antes el título.</span>}
      </div>
      {error && <p className="mt-1.5 text-xs text-[var(--danger,#b4442e)]">{error}</p>}
      {notas && notas.length === 0 && (
        <p className="mt-1.5 text-xs text-[var(--fg-muted)]">
          No hay notas de CONtexto Ganadero que traten lo mismo; por eso no se enlaza ninguna. Solo se enlaza lo que habla del mismo asunto.
        </p>
      )}
      {notas && notas.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          <p className="text-xs text-[var(--fg-muted)]">
            {criterio === "ia" ? "Tratan el mismo asunto:" : "Comparten palabras con tu nota (sin IA no se puede juzgar el asunto; revísalas):"}
          </p>
          {notas.map((n) => (
            <label key={n.url} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 hover:bg-[var(--surface-2)]">
              <input
                type="checkbox"
                className="size-4 shrink-0 accent-[var(--accent)]"
                checked={elegidas.has(n.url)}
                onChange={(e) => setElegidas((s) => { const x = new Set(s); if (e.target.checked) x.add(n.url); else x.delete(n.url); return x; })}
              />
              <span className="min-w-0 flex-1 truncate">{n.title}</span>
              <span className="shrink-0 text-xs text-[var(--fg-muted)]">{n.kind === "archivo" ? "Archivo · " : ""}{fecha(n.publishedAt)}</span>
            </label>
          ))}
          <div>
            <button type="button" onClick={insertar} className="lx-btn !py-1 text-xs">
              <Check size={13} /> {elegidas.size ? `Añadir ${elegidas.size} al final de la nota` : "Quitar remisiones y no añadir ninguna"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
