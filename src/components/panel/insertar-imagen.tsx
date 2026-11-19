"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, ImagePlus, Images, Link2, Loader2, Sparkles, Upload, X } from "lucide-react";
import { BibliotecaExplorador } from "@/components/panel/biblioteca-explorador";
import { subirMedia } from "@/components/panel/subir-media";
import { creditoFotoValido, FORMATO_CREDITO, ORIGENES_CREDITO } from "@/lib/credito-foto";
import { pieConCredito, urlImagenValida, type DatosFigura } from "@/components/panel/figura-imagen";

/** De dónde sale la imagen que se pone dentro de la nota. */
export type OrigenImagen = "biblioteca" | "ia" | "subir" | "url";

/** Lo que devuelve la IA al pintar la imagen (la misma acción que la portada). */
export type ResultadoImagenIA = { ok: true; url: string; alt: string; credito: string } | { ok: false; error: string };

const PESTANAS: { id: OrigenImagen; nombre: string; Icono: typeof Images }[] = [
  { id: "biblioteca", nombre: "Biblioteca", Icono: Images },
  { id: "ia", nombre: "Generar con IA", Icono: Sparkles },
  { id: "subir", nombre: "Subir del equipo", Icono: Upload },
  { id: "url", nombre: "Dirección web", Icono: Link2 },
];

const campo = "w-full rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]";

/**
 * Ventana para poner una imagen DENTRO del cuerpo de la nota (no la portada): se elige de la biblioteca, se genera con IA a partir del párrafo
 * donde está el cursor (o de lo que se describa), se sube del equipo o se pega su dirección. Antes de insertarla se ve, y se completan el pie y
 * el crédito: como en la portada, toda foto lleva crédito («Foto: Nombre Apellido / Medio»); las de IA y las de la biblioteca ya lo traen.
 */
export function InsertarImagen({
  inicial,
  parrafo,
  generarIA,
  onInsertar,
  onCerrar,
}: {
  inicial: OrigenImagen;
  /** Texto del párrafo donde estaba el cursor: la IA ilustra esa parte de la nota si no se describe otra cosa. */
  parrafo: string;
  /** Sin esta función (p. ej. sin permiso de IA) no se ofrece «Generar con IA». */
  generarIA?: (escena: string, parrafo: string) => Promise<ResultadoImagenIA>;
  onInsertar: (d: DatosFigura) => void;
  onCerrar: () => void;
}) {
  const pestanas = PESTANAS.filter((p) => p.id !== "ia" || generarIA);
  const [origen, setOrigen] = useState<OrigenImagen>(inicial === "ia" && !generarIA ? "biblioteca" : inicial);
  // La imagen ya elegida (pasa a la vista previa con su pie y su crédito).
  const [elegida, setElegida] = useState<{ url: string; alt: string; credito: string } | null>(null);
  const [pie, setPie] = useState("");
  const [credito, setCredito] = useState("");
  const [alt, setAlt] = useState("");
  const [escena, setEscena] = useState("");
  const [direccion, setDireccion] = useState("https://");
  const [error, setError] = useState("");
  const [ocupado, empezar] = useTransition();
  const archivo = useRef<HTMLInputElement>(null);

  // Escape cierra solo esta ventana: se atiende antes que nadie y no sigue, para no cerrar también la nota ampliada que está debajo.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (!ocupado) onCerrar();
    };
    window.addEventListener("keydown", alTeclear, { capture: true });
    return () => window.removeEventListener("keydown", alTeclear, { capture: true });
  }, [onCerrar, ocupado]);

  const usar = (url: string, a: string, c: string) => {
    setError("");
    setElegida({ url, alt: a, credito: c });
    setAlt(a);
    setCredito(c);
  };

  const generar = () => {
    if (!generarIA) return;
    setError("");
    empezar(async () => {
      const r = await generarIA(escena.trim(), parrafo);
      if (!r.ok) return setError(r.error);
      usar(r.url, r.alt, r.credito);
    });
  };

  const subir = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError("Elige una foto (JPG, PNG o WebP).");
    setError("");
    empezar(async () => {
      try {
        const r = await subirMedia(f);
        if (!r.ok) return setError(r.error);
        if (r.kind !== "imagen") return setError("Ese archivo no es una imagen.");
        usar(r.url, f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " "), "");
      } catch {
        setError("No se pudo subir la foto.");
      }
    });
  };

  const creditoOk = creditoFotoValido(credito);
  const insertar = () => {
    if (!elegida || !creditoOk) return;
    onInsertar({ url: elegida.url, alt: alt.trim() || pie.trim(), pie, credito: credito.trim() });
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Insertar una imagen en la nota" className="fixed inset-0 z-[80] grid place-items-center bg-black/55 p-3 sm:p-6" onClick={(e) => { if (e.target === e.currentTarget && !ocupado) onCerrar(); }}>
      <div className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-white text-[#1b1b1b] shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold"><ImagePlus size={17} aria-hidden className="text-[var(--accent)]" /> Imagen dentro de la nota</h2>
            <p className="text-xs text-[var(--fg-muted)]">Queda donde estaba el cursor, a todo el ancho del texto, con su pie y su crédito.</p>
          </div>
          <button type="button" aria-label="Cerrar" disabled={ocupado} onClick={onCerrar} className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-[var(--surface-2)] disabled:opacity-50"><X size={18} aria-hidden /></button>
        </div>

        {!elegida ? (
          <>
            <div role="tablist" aria-label="De dónde sale la imagen" className="flex flex-wrap gap-1 border-b border-[var(--border)] px-3 pt-2">
              {pestanas.map(({ id, nombre, Icono }) => (
                <button key={id} type="button" role="tab" aria-selected={origen === id} onClick={() => { setOrigen(id); setError(""); }}
                  className={`-mb-px inline-flex items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition ${origen === id ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>
                  <Icono size={15} aria-hidden /> {nombre}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {origen === "biblioteca" && (
                <BibliotecaExplorador modo="selector" onElegir={(a) => usar(a.url, a.description?.trim() || a.name, a.credit ?? "")} />
              )}
              {origen === "ia" && generarIA && (
                <div className="mx-auto flex max-w-2xl flex-col gap-3">
                  <label htmlFor="escena-ia" className="text-sm font-semibold">¿Qué debe mostrar la imagen?</label>
                  <textarea id="escena-ia" value={escena} onChange={(e) => setEscena(e.target.value.slice(0, 600))} rows={4} disabled={ocupado}
                    placeholder="Ej.: un vacunador aplica la vacuna contra la aftosa a una vaca cebú en un corral de los Llanos, a primera hora de la mañana."
                    className={`${campo} resize-y`} />
                  <p className="text-xs text-[var(--fg-muted)]">
                    {parrafo
                      ? <>Si lo dejas vacío, la IA ilustra el párrafo donde está el cursor: «{parrafo.length > 160 ? `${parrafo.slice(0, 160)}…` : parrafo}».</>
                      : "Si lo dejas vacío, la IA ilustra el tema de la nota."}{" "}
                    Sale en 16:9, sin texto ni personas reales reconocibles, y descuenta de tu cuota de IA.
                  </p>
                  <div>
                    <button type="button" onClick={generar} disabled={ocupado} className="lx-btn inline-flex items-center gap-2 disabled:opacity-60">
                      {ocupado ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Sparkles size={15} aria-hidden />}
                      {ocupado ? "Generando… (puede tardar unos 30 segundos)" : "Generar imagen"}
                    </button>
                  </div>
                </div>
              )}
              {origen === "subir" && (
                <div className="mx-auto flex max-w-2xl flex-col items-start gap-3">
                  <p className="text-sm">Elige una foto de tu equipo (JPG, PNG o WebP, hasta 25 MB). Luego le pones el crédito de quien la tomó.</p>
                  <input ref={archivo} type="file" accept="image/*" className="sr-only" onChange={(e) => { subir(e.target.files?.[0]); e.target.value = ""; }} />
                  <button type="button" onClick={() => archivo.current?.click()} disabled={ocupado} className="lx-btn inline-flex items-center gap-2 disabled:opacity-60">
                    {ocupado ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Upload size={15} aria-hidden />}
                    {ocupado ? "Subiendo…" : "Elegir foto"}
                  </button>
                </div>
              )}
              {origen === "url" && (
                <form className="mx-auto flex max-w-2xl flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (urlImagenValida(direccion)) usar(direccion.trim(), "", ""); else setError("Pega la dirección completa de la imagen, que empiece por https://"); }}>
                  <label htmlFor="url-imagen" className="text-sm font-semibold">Dirección de la imagen</label>
                  <input id="url-imagen" value={direccion} onChange={(e) => setDireccion(e.target.value)} className={campo} placeholder="https://…" />
                  <div><button type="submit" className="lx-btn">Usar esta imagen</button></div>
                </form>
              )}
              {error && <p role="alert" className="mx-auto mt-3 max-w-2xl text-sm font-medium text-[var(--danger,#b4442e)]">{error}</p>}
            </div>
          </>
        ) : (
          <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <figure className="m-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- vista previa de una imagen de cualquier origen */}
              <img src={elegida.url} alt={alt} className="max-h-[55dvh] w-full rounded-[var(--radius)] bg-[#f3f4f3] object-contain" />
              <figcaption className="mt-2 text-center text-xs text-[var(--fg-muted)]">{pieConCredito(pie, credito) || "El pie y el crédito se ven aquí."}</figcaption>
            </figure>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pie-imagen" className="text-sm font-semibold">Pie de foto <span className="font-normal text-[var(--fg-muted)]">(opcional)</span></label>
                <input id="pie-imagen" value={pie} onChange={(e) => setPie(e.target.value.slice(0, 300))} placeholder="Qué se ve y dónde" className={campo} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="credito-imagen" className="text-sm font-semibold">Crédito <span className="font-normal text-[var(--fg-muted)]">(obligatorio)</span></label>
                <div className="flex flex-wrap gap-1.5">
                  {ORIGENES_CREDITO.map((o) => (
                    <button key={o.id} type="button" onClick={() => setCredito(o.texto)} className="rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-xs font-medium transition hover:border-[var(--accent)]">{o.etiqueta}</button>
                  ))}
                </div>
                <input id="credito-imagen" value={credito} onChange={(e) => setCredito(e.target.value.slice(0, 300))} placeholder={FORMATO_CREDITO} aria-invalid={!creditoOk} aria-describedby="credito-imagen-ayuda" className={campo} />
                <p id="credito-imagen-ayuda" className={`text-xs ${creditoOk ? "text-[var(--fg-muted)]" : "font-medium text-[#92400e]"}`}>
                  {creditoOk ? "Se muestra bajo la imagen." : `Toda foto lleva crédito. Escríbelo así: «${FORMATO_CREDITO}».`}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="alt-imagen" className="text-sm font-semibold">Texto alternativo</label>
                <textarea id="alt-imagen" value={alt} onChange={(e) => setAlt(e.target.value.slice(0, 300))} rows={2} placeholder="Describe la imagen para quien no la ve" className={`${campo} resize-y`} />
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-2">
                <button type="button" onClick={insertar} disabled={!creditoOk} className="lx-btn disabled:cursor-not-allowed disabled:opacity-50">Insertar en la nota</button>
                <button type="button" onClick={() => setElegida(null)} className="inline-flex items-center gap-1 text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]"><ArrowLeft size={14} aria-hidden /> Elegir otra</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
