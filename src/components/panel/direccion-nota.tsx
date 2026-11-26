"use client";

import { useEffect, useState, useTransition } from "react";
import { Link2, Loader2 } from "lucide-react";
import { cambiarDireccion, verDireccion } from "@/app/panel/(app)/articulos/actions";

/** La dirección (URL) con la que sale la nota, con su último tramo editable. `version` obliga a releerla (p. ej. al cambiar de sección). */
export function DireccionNota({ articleId, version, onRuta }: { articleId: string; version?: string; onRuta?: (ruta: string) => void }) {
  const [dir, setDir] = useState<{ ruta: string; publica: boolean } | null>(null);
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();

  useEffect(() => {
    let vivo = true;
    verDireccion(articleId)
      .then((d) => {
        if (!vivo || !d) return;
        setDir(d);
        setTexto(d.ruta.split("/").pop() ?? "");
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [articleId, version]);

  const rutaActual = dir?.ruta;
  useEffect(() => {
    if (rutaActual) onRuta?.(rutaActual);
  }, [rutaActual, onRuta]);

  if (!dir) return null;
  const actual = dir.ruta.split("/").pop() ?? "";
  const base = dir.ruta.slice(0, dir.ruta.length - actual.length);

  function guardar() {
    if (!dir) return;
    if (dir.publica && !window.confirm("La nota ya salió al público. ¿Cambiar su dirección? La anterior seguirá funcionando y llevará a la nueva.")) return;
    setAviso(null);
    iniciar(async () => {
      try {
        const r = await cambiarDireccion(articleId, texto);
        if (!r.ok) return setAviso({ ok: false, texto: r.error });
        setDir({ ...dir, ruta: r.ruta });
        setTexto(r.ruta.split("/").pop() ?? "");
        setAviso({ ok: true, texto: "Dirección guardada." });
      } catch {
        setAviso({ ok: false, texto: "No se pudo cambiar la dirección. Inténtalo de nuevo." });
      }
    });
  }

  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-2 text-xs"
      title={dir.publica ? "Si la cambias, la dirección anterior redirige a la nueva." : "Puedes ajustarla antes de que la nota salga."}
    >
      <label htmlFor="direccion-nota" className="flex items-center gap-1 font-semibold">
        <Link2 size={13} aria-hidden /> URL
      </label>
      <span className="break-all text-[var(--fg-muted)]">{base}</span>
      <input
        id="direccion-nota"
        value={texto}
        onChange={(e) => setTexto(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (!ocupado && texto !== actual) guardar();
          }
        }}
        maxLength={96}
        spellCheck={false}
        className="min-w-[14rem] flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1"
      />
      {texto !== actual && (
        <button
          type="button"
          onClick={guardar}
          disabled={ocupado || texto.length < 3}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1 font-semibold hover:bg-[var(--surface-2)] disabled:opacity-50"
        >
          {ocupado && <Loader2 size={13} className="animate-spin" aria-hidden />} Guardar dirección
        </button>
      )}
      {aviso && <p role="status" className={aviso.ok ? "text-[#15803d]" : "basis-full text-[var(--danger,#b4442e)]"}>{aviso.texto}</p>}
    </div>
  );
}
