"use client";

import { useState } from "react";
import { Globe, LayoutGrid, Newspaper } from "lucide-react";

type Vista = "nota" | "portada" | "google";

/**
 * Cómo se verá la portada entregada: dentro de la nota, como tarjeta en la portada del sitio y como resultado de Google (Discover).
 * Es una maqueta con el título, el resumen, el pie y el texto alternativo reales de la nota; la vista real está en «Ver la nota».
 */
export function VistaPreviaPortada({ url, titulo, resumen, pie, alt }: { url: string; titulo: string; resumen: string; pie: string; alt: string }) {
  const [vista, setVista] = useState<Vista>("nota");
  const pestanas: { id: Vista; nombre: string; Icono: typeof Newspaper }[] = [
    { id: "nota", nombre: "En la nota", Icono: Newspaper },
    { id: "portada", nombre: "En la portada", Icono: LayoutGrid },
    { id: "google", nombre: "En Google", Icono: Globe },
  ];
  return (
    <section aria-label="Vista previa de la portada" className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)]/40 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Así se verá</h3>
        <div role="tablist" aria-label="Dónde se ve" className="flex gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1">
          {pestanas.map(({ id, nombre, Icono }) => (
            <button key={id} type="button" role="tab" aria-selected={vista === id} onClick={() => setVista(id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${vista === id ? "bg-[var(--accent)] text-[var(--accent-fg,#fff)] shadow-sm" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>
              <Icono size={13} aria-hidden /> {nombre}
            </button>
          ))}
        </div>
      </div>

      {vista === "nota" && (
        <article className="mx-auto w-full max-w-2xl rounded-md bg-white p-4 text-[#1b1b1b] shadow-sm sm:p-6">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#6b756f]">Inicio / Sección</p>
          <h4 className="mt-1.5 text-xl font-bold leading-tight sm:text-2xl">{titulo}</h4>
          {resumen && <p className="mt-2 text-sm leading-snug text-[#3f4a44]">{resumen}</p>}
          <figure className="mt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={alt} className="aspect-[16/9] w-full rounded-sm object-cover" />
            {pie && <figcaption className="mt-1.5 text-xs text-[#6b756f]">{pie}</figcaption>}
          </figure>
        </article>
      )}

      {vista === "portada" && (
        <div className="mx-auto grid w-full max-w-2xl gap-3 sm:grid-cols-2">
          <div className="overflow-hidden rounded-md bg-white text-[#1b1b1b] shadow-sm sm:col-span-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={alt} className="aspect-[16/9] w-full object-cover" />
            <div className="p-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#6b756f]">Sección</p>
              <p className="mt-0.5 text-base font-bold leading-snug">{titulo}</p>
            </div>
          </div>
          <div className="flex gap-3 rounded-md bg-white p-2.5 text-[#1b1b1b] shadow-sm sm:col-span-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="aspect-[4/3] w-28 shrink-0 rounded-sm object-cover" />
            <p className="self-center text-sm font-semibold leading-snug">{titulo}</p>
          </div>
        </div>
      )}

      {vista === "google" && (
        <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-white text-[#1b1b1b] shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={alt} className="aspect-[16/9] w-full object-cover" />
          <div className="p-3.5">
            <p className="text-[0.95rem] font-semibold leading-snug">{titulo}</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[#6b756f]"><span aria-hidden className="size-4 rounded-full bg-[var(--accent)]" /> CONtexto Ganadero · hace un momento</p>
          </div>
        </div>
      )}
      <p className="text-xs text-[var(--fg-muted)]">Maqueta con los datos de la nota; el tamaño y el recorte reales los decide cada plataforma. Para ver la nota real, usa «Ver la nota».</p>
    </section>
  );
}
