"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Rocket, TriangleAlert } from "lucide-react";
import type { ChangeLine } from "@/lib/portada-summary";

/**
 * Estado de la portada y UNA sola forma de publicar. Lo usan el editor y la
 * pestaña «Vista previa», para que se llamen igual y funcionen igual:
 *
 *  - «Publicado»: lo que ves es lo que está en el sitio.
 *  - «Borrador · N cambios»: hay cosas sin publicar. «Publicar cambios» enseña la
 *    lista de lo que cambia y pide confirmar; el sitio no se toca hasta entonces.
 */
export function PublicarControles({
  changes,
  count,
  onPublish,
  onDiscard,
  disabled,
  deshacible = true,
}: {
  changes: ChangeLine[];
  count: number;
  onPublish: () => Promise<{ ok: boolean; message?: string }>;
  /** Si se pasa, aparece «Descartar» junto al botón de publicar. */
  onDiscard?: () => void;
  disabled?: boolean;
  /** Si tras publicar se puede deshacer (cambia el texto de la confirmación). */
  deshacible?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const wrap = useRef<HTMLDivElement>(null);
  const hasChanges = count > 0;

  // Cerrar al pulsar fuera o con Escape.
  useEffect(() => {
    if (!open) return;
    // Cierra el cuadro al pulsar fuera.
    const down = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    // Cierra el cuadro con la tecla Escape.
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  // Publica los cambios del diseño.
  async function publish() {
    setPublishing(true);
    setError("");
    try {
      const r = await onPublish();
      if (r.ok) setOpen(false);
      else setError(r.message ?? "No se pudo publicar.");
    } catch {
      setError("No se pudo publicar. Revisa que tu sesión siga activa e inténtalo otra vez.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div ref={wrap} className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={() => hasChanges && setOpen((v) => !v)}
        disabled={disabled}
        aria-expanded={open}
        title={hasChanges ? "Ver qué cambia al publicar" : "Lo que ves aquí es exactamente lo que está publicado"}
        className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold ${
          hasChanges ? "border-[#c9a227] bg-[#c9a227]/15 hover:bg-[#c9a227]/25" : "cursor-default border-[var(--border)]"
        }`}
      >
        <span className={`size-2.5 rounded-full ${hasChanges ? "bg-[#c9a227]" : "bg-[#16a34a]"}`} aria-hidden />
        {hasChanges ? `Borrador · ${count} ${count === 1 ? "cambio" : "cambios"}` : "Publicado"}
        {hasChanges && <ChevronDown size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} aria-hidden />}
      </button>

      {hasChanges && (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={disabled}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-50"
          >
            <Rocket size={15} /> Publicar cambios
          </button>
          {onDiscard && (
            <button
              type="button"
              onClick={onDiscard}
              disabled={disabled}
              title="Descarta tus cambios y vuelve a lo publicado (puedes deshacerlo)"
              className="inline-flex h-9 items-center rounded-full px-3 text-sm font-medium text-[var(--fg-muted)] transition hover:text-[var(--danger,#b4442e)]"
            >
              Descartar
            </button>
          )}
        </>
      )}

      {open && hasChanges && (
        <div
          role="dialog"
          aria-label="Confirmar publicación"
          className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[min(28rem,86vw)] rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg)] p-4 text-[var(--fg)] shadow-2xl"
        >
          <p className="text-sm font-bold">Vas a publicar estos cambios</p>
          <ul className="mt-2.5 flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1 text-sm">
            {changes.map((c) => (
              <li key={c.id} className={`flex items-start gap-2 ${c.warn ? "text-[#92400e]" : ""}`}>
                {c.warn ? <TriangleAlert size={14} className="mt-0.5 shrink-0" /> : <span className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden />}
                <span>{c.text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-snug text-[var(--fg-muted)]">
            Se verán en el sitio público de inmediato.{deshacible ? " Podrás deshacerlo justo después." : ""}
          </p>
          {error && (
            <p role="alert" className="mt-2 text-xs font-semibold text-[#b4442e]">
              {error}
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={publish}
              disabled={publishing}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-fg)] disabled:opacity-60"
            >
              {publishing ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />} Sí, publicar ahora
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={publishing}
              className="inline-flex h-9 items-center rounded-full border border-[var(--border-strong)] px-4 text-sm font-semibold"
            >
              Seguir editando
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
