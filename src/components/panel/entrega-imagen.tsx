"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Loader2 } from "lucide-react";
import { entregarImagen } from "@/app/panel/(app)/imagenes/actions";
import { subirMedia } from "./subir-media";

const campo = "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)] placeholder:text-[var(--fg-muted)]/50";

// El diseñador sube la imagen, la describe y la entrega: queda como portada de la nota.
export function EntregaImagen({ articleId }: { articleId: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const [pendiente, empezar] = useTransition();

  async function alElegir(file: File) {
    setError("");
    setSubiendo(true);
    try {
      const r = await subirMedia(file);
      if (!r.ok) return setError(r.error);
      if (r.kind === "video") return setError("La portada debe ser una imagen.");
      setUrl(r.url);
    } catch {
      setError("No se pudo subir la imagen.");
    } finally {
      setSubiendo(false);
    }
  }

  function entregar() {
    setError("");
    empezar(async () => {
      const r = await entregarImagen({ articleId, url, alt });
      if (!r.ok) return setError(r.message);
      router.refresh();
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-[var(--border)] pt-3">
      <div className="flex flex-wrap items-start gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="aspect-[16/9] w-48 rounded-[var(--radius)] border border-[var(--border)] object-cover" />
        ) : (
          <div className="grid aspect-[16/9] w-48 place-items-center rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] text-xs text-[var(--fg-muted)]">Sin imagen</div>
        )}
        <div className="flex min-w-[14rem] flex-1 flex-col gap-2">
          <label className="lx-btn cursor-pointer self-start !px-3 !py-1.5 text-xs">
            {subiendo ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />} {url ? "Cambiar imagen" : "Subir imagen"}
            <input type="file" accept="image/*" disabled={subiendo || pendiente} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void alElegir(f); }} />
          </label>
          <input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Qué se ve en la imagen (texto alternativo)" className={campo} />
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-[var(--danger,#b4442e)]">{error}</p>}
      <button type="button" onClick={entregar} disabled={!url || subiendo || pendiente} className="lx-btn self-start disabled:opacity-50">
        {pendiente ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Entregar y poner en la nota
      </button>
    </div>
  );
}
