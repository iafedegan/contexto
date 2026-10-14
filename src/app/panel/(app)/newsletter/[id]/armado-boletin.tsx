"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Inbox, LayoutList, Plus, X, Zap } from "lucide-react";
import { MIME_NOTA, type Nota } from "./biblioteca-notas";
import {
  MAX_NOTAS,
  MAX_SECCIONES,
  MAX_TITULO,
  anadirSeccion,
  colocarNota,
  moverItem,
  notasDeSeccion,
  notasDeUltimaHora,
  quitarItem,
  renombrarSeccion,
  slugsDeItems,
  type ItemEdicion,
  type NotaElegible,
} from "@/lib/newsletter/items";

/** Valor de la opción «Última hora» en el selector de secciones (no puede chocar con el nombre de una sección real). */
const ULTIMA_HORA = "__ultima_hora__";
const EN_BLANCO = "__en_blanco__";

/**
 * Armado del boletín: una lista donde se mezclan encabezados de sección y notas. Las notas se arrastran (desde la biblioteca o dentro de la
 * lista) o se mueven con los botones; las secciones se traen del sitio («Última hora», «Colombia»…) con sus notas más recientes y se editan.
 */
export function ArmadoBoletin({ items, alCambiar, notas, elegibles, bloqueado }: { items: ItemEdicion[]; alCambiar: (items: ItemEdicion[]) => void; notas: Nota[]; elegibles: NotaElegible[]; bloqueado: boolean }) {
  // Posición de la línea de inserción mientras se arrastra, y renglón que se está moviendo.
  const [sobre, setSobre] = useState<number | null>(null);
  const [moviendo, setMoviendo] = useState<string | null>(null);
  const [eleccion, setEleccion] = useState(EN_BLANCO);

  const nNotas = slugsDeItems(items).length;
  const nSecciones = items.filter((x) => x.t === "s").length;
  const secciones = [...new Set(elegibles.map((e) => e.seccion))].sort((a, b) => a.localeCompare(b, "es"));
  const primeraNota = items.findIndex((x) => x.t === "n");

  const soltar = (e: React.DragEvent, pos: number) => {
    e.preventDefault();
    const slug = e.dataTransfer.getData(MIME_NOTA);
    setSobre(null);
    setMoviendo(null);
    if (slug && !bloqueado) alCambiar(colocarNota(items, slug, pos));
  };

  const traer = () => {
    if (eleccion === EN_BLANCO) alCambiar(anadirSeccion(items, "", []));
    else if (eleccion === ULTIMA_HORA) alCambiar(anadirSeccion(items, "Última hora", notasDeUltimaHora(elegibles, items)));
    else alCambiar(anadirSeccion(items, eleccion, notasDeSeccion(elegibles, eleccion, items)));
    setEleccion(EN_BLANCO);
  };

  let numero = 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">
          Armado del boletín ({nNotas}/{MAX_NOTAS} notas{nSecciones ? ` · ${nSecciones} ${nSecciones === 1 ? "sección" : "secciones"}` : ""}) — la primera nota es la destacada
        </span>
      </div>

      {!bloqueado && (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-2">
          <LayoutList size={15} aria-hidden className="ml-1 shrink-0 text-[var(--accent)]" />
          <label className="sr-only" htmlFor="traer-seccion">Sección que se añade al boletín</label>
          <select id="traer-seccion" value={eleccion} onChange={(e) => setEleccion(e.target.value)} className="lx-input min-w-0 flex-1 !py-1.5 text-sm">
            <option value={EN_BLANCO}>Sección en blanco</option>
            <option value={ULTIMA_HORA}>⚡ Última hora (las marcadas y las más recientes)</option>
            <optgroup label="Secciones del sitio (sus 3 notas más recientes)">
              {secciones.map((s) => <option key={s} value={s}>{s}</option>)}
            </optgroup>
          </select>
          <button type="button" onClick={traer} disabled={nSecciones >= MAX_SECCIONES} className="lx-btn-ghost !px-3 !py-1.5 text-xs disabled:opacity-50">
            <Plus size={14} aria-hidden /> Añadir sección
          </button>
        </div>
      )}

      <ol
        aria-label="Armado del boletín, en orden"
        onDragOver={(e) => { if (!bloqueado) { e.preventDefault(); setSobre((v) => v ?? items.length); } }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSobre(null); }}
        onDrop={(e) => soltar(e, sobre ?? items.length)}
        className={`flex min-h-40 flex-col gap-1.5 rounded-[var(--radius-lg)] border-2 border-dashed p-2 transition ${sobre !== null ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border-strong)]"}`}
      >
        {items.length === 0 && (
          <li className="grid flex-1 place-items-center gap-1 py-8 text-center text-sm text-[var(--fg-muted)]"><Inbox size={22} aria-hidden /> Arrastra aquí las notas<span className="text-xs">o pulsa «+» en la lista de la izquierda, o añade una sección completa arriba</span></li>
        )}
        {items.map((it, k) => {
          const clave = it.t === "s" ? `s-${k}` : `n-${it.slug}`;
          const posicion = (e: React.DragEvent) => {
            if (bloqueado) return;
            e.preventDefault();
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            setSobre(e.clientY < r.top + r.height / 2 ? k : k + 1);
          };
          const botones = !bloqueado && (
            <span className="flex shrink-0 items-center">
              <button type="button" aria-label="Subir" disabled={k === 0} onClick={() => alCambiar(moverItem(items, k, -1))} className="grid size-8 place-items-center rounded-full hover:bg-[var(--surface-2)] disabled:opacity-30"><ArrowUp size={15} aria-hidden /></button>
              <button type="button" aria-label="Bajar" disabled={k === items.length - 1} onClick={() => alCambiar(moverItem(items, k, 1))} className="grid size-8 place-items-center rounded-full hover:bg-[var(--surface-2)] disabled:opacity-30"><ArrowDown size={15} aria-hidden /></button>
              <button type="button" aria-label={it.t === "s" ? "Quitar la sección (sus notas se quedan)" : "Quitar del boletín"} onClick={() => alCambiar(quitarItem(items, k))} className="grid size-8 place-items-center rounded-full hover:bg-[#b4232a]/10 hover:text-[#b4232a]"><X size={15} aria-hidden /></button>
            </span>
          );

          if (it.t === "s") {
            const ultima = /última hora/i.test(it.titulo);
            return (
              <li key={clave} onDragOver={posicion} onDrop={(e) => { e.stopPropagation(); soltar(e, sobre ?? k); }} className="relative mt-1">
                {sobre === k && <span aria-hidden className="absolute -top-1 left-0 right-0 h-0.5 rounded bg-[var(--accent)]" />}
                <div className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--accent)]/40 border-l-4 border-l-[var(--accent)] bg-[var(--accent)]/8 p-1.5 pl-2.5">
                  {ultima ? <Zap size={15} aria-hidden className="shrink-0 text-[var(--accent)]" /> : <LayoutList size={15} aria-hidden className="shrink-0 text-[var(--accent)]" />}
                  <input
                    value={it.titulo}
                    disabled={bloqueado}
                    maxLength={MAX_TITULO}
                    aria-label="Título de la sección"
                    onChange={(e) => alCambiar(renombrarSeccion(items, k, e.target.value))}
                    className="min-w-0 flex-1 bg-transparent px-1 text-sm font-bold uppercase tracking-wide outline-none focus:underline"
                  />
                  {botones}
                </div>
                {sobre === k + 1 && k === items.length - 1 && <span aria-hidden className="absolute -bottom-1 left-0 right-0 h-0.5 rounded bg-[var(--accent)]" />}
              </li>
            );
          }

          const a = notas.find((x) => x.slug === it.slug);
          numero++;
          return (
            <li key={clave} onDragOver={posicion} onDrop={(e) => { e.stopPropagation(); soltar(e, sobre ?? k); }} className="relative">
              {sobre === k && <span aria-hidden className="absolute -top-1 left-0 right-0 h-0.5 rounded bg-[var(--accent)]" />}
              <div
                draggable={!bloqueado}
                onDragStart={(e) => { e.dataTransfer.setData(MIME_NOTA, it.slug); e.dataTransfer.effectAllowed = "move"; setMoviendo(clave); }}
                onDragEnd={() => { setMoviendo(null); setSobre(null); }}
                className={`flex items-center gap-2 rounded-[var(--radius)] border bg-[var(--surface)] p-2 text-sm ${moviendo === clave ? "opacity-40" : ""} ${k === primeraNota ? "border-[var(--accent)]" : "border-[var(--border)]"} ${bloqueado ? "" : "cursor-grab active:cursor-grabbing"}`}
              >
                {!bloqueado && <GripVertical size={16} aria-hidden className="shrink-0 text-[var(--fg-muted)]" />}
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-xs font-bold tabular-nums">{numero}</span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-medium leading-snug">{a?.title ?? it.slug}</span>
                  <span className="text-xs text-[var(--fg-muted)]">{k === primeraNota ? "Destacada · " : ""}{a?.parentName ? `${a.parentName} › ` : ""}{a?.categoryName ?? ""}</span>
                </span>
                {botones}
              </div>
              {sobre === k + 1 && k === items.length - 1 && <span aria-hidden className="absolute -bottom-1 left-0 right-0 h-0.5 rounded bg-[var(--accent)]" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
