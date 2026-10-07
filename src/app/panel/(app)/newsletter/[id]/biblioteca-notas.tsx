"use client";

import { useMemo, useState } from "react";
import { ChevronDown, GripVertical, Plus, Search, Check } from "lucide-react";

/** Nota publicada que se puede arrastrar al boletín. */
export type Nota = { slug: string; title: string; categoryName: string | null; parentName: string | null; cover: string | null; publishedAt: string | null };

const MIME = "application/x-cg-nota";
const fecha = (iso: string | null) => (iso ? new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "America/Bogota" }).format(new Date(iso)) : "");
const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Miniatura de la nota (imagen sencilla: es una lista del panel, no vale la pena optimizarla).
function Portada({ src }: { src: string | null }) {
  if (!src) return <span className="size-11 shrink-0 rounded bg-[var(--surface-2)]" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" loading="lazy" className="size-11 shrink-0 rounded object-cover" />;
}

/**
 * Biblioteca de notas publicadas, agrupadas por sección y subsección en listas que se despliegan. Cada nota se arrastra al
 * boletín (o se añade con el «+», que sirve también en el celular y con teclado). Las que ya están en el boletín quedan marcadas.
 */
export function BibliotecaNotas({ notas, usadas, onAgregar, bloqueada }: { notas: Nota[]; usadas: Set<string>; onAgregar: (slug: string) => void; bloqueada: boolean }) {
  const [q, setQ] = useState("");
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const grupos = useMemo(() => {
    const t = norm(q.trim());
    const m = new Map<string, Map<string, Nota[]>>();
    for (const n of notas) {
      if (t && !norm(`${n.title} ${n.categoryName ?? ""} ${n.parentName ?? ""}`).includes(t)) continue;
      const seccion = n.parentName ?? n.categoryName ?? "Sin sección";
      const sub = n.parentName ? (n.categoryName ?? "General") : "";
      const g = m.get(seccion) ?? new Map<string, Nota[]>();
      g.set(sub, [...(g.get(sub) ?? []), n]);
      m.set(seccion, g);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [notas, q]);
  const buscando = q.trim().length > 0;
  const alternar = (k: string) => setAbiertas((p) => { const s = new Set(p); if (s.has(k)) s.delete(k); else s.add(k); return s; });

  const fila = (n: Nota) => {
    const dentro = usadas.has(n.slug);
    return (
      <li key={n.slug}>
        <div
          draggable={!bloqueada && !dentro}
          onDragStart={(e) => { e.dataTransfer.setData(MIME, n.slug); e.dataTransfer.effectAllowed = "copy"; }}
          className={`group flex items-start gap-2 rounded-[var(--radius)] border p-2 text-sm transition ${dentro ? "border-transparent bg-[var(--surface-2)] opacity-60" : "cursor-grab border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] active:cursor-grabbing"}`}
        >
          <GripVertical size={16} aria-hidden className="mt-0.5 shrink-0 text-[var(--fg-muted)]" />
          <Portada src={n.cover} />
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 font-medium leading-snug">{n.title}</span>
            <span className="text-xs text-[var(--fg-muted)]">{fecha(n.publishedAt)}</span>
          </span>
          {dentro ? <Check size={16} aria-label="Ya está en el boletín" className="mt-0.5 shrink-0 text-[#157a4a]" /> : !bloqueada && (
            <button type="button" onClick={() => onAgregar(n.slug)} aria-label={`Añadir «${n.title}» al boletín`} className="grid size-8 shrink-0 place-items-center rounded-full border border-[var(--border-strong)] hover:bg-[var(--accent)] hover:text-[var(--accent-fg)]"><Plus size={15} aria-hidden /></button>
          )}
        </div>
      </li>
    );
  };

  return (
    <section aria-label="Notas publicadas" className="flex min-h-0 flex-col gap-3">
      <div>
        <h2 className="lx-display text-lg font-semibold">Notas publicadas</h2>
        <p className="text-xs text-[var(--fg-muted)]">Arrástralas al boletín o pulsa «+». {notas.length} disponibles.</p>
      </div>
      <label className="relative block">
        <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nota o sección…" className="lx-input w-full !pl-9" />
      </label>
      <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto pr-1">
        {grupos.length === 0 && <p className="text-sm text-[var(--fg-muted)]">Ninguna nota coincide.</p>}
        {grupos.map(([seccion, subs]) => {
          const total = [...subs.values()].reduce((a, l) => a + l.length, 0);
          const abierta = buscando || abiertas.has(seccion);
          return (
            <div key={seccion} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
              <button type="button" onClick={() => alternar(seccion)} aria-expanded={abierta} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left">
                <span className="font-semibold">{seccion}</span>
                <span className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">{total}<ChevronDown size={16} aria-hidden className={`transition ${abierta ? "rotate-180" : ""}`} /></span>
              </button>
              {abierta && (
                <div className="flex flex-col gap-3 border-t border-[var(--border)] p-2">
                  {[...subs.entries()].sort((a, b) => a[0].localeCompare(b[0], "es")).map(([sub, lista]) => (
                    <div key={sub || "_"}>
                      {sub && <p className="lx-kicker mb-1.5 px-1 text-[var(--accent)]">{sub} · {lista.length}</p>}
                      <ul className="flex flex-col gap-1.5">{lista.map(fila)}</ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export { MIME as MIME_NOTA };
