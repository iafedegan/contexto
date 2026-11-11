"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronRight, Folder, FolderOpen, FolderPlus, Home, Loader2, Search, X } from "lucide-react";
import { crearCarpeta } from "@/app/panel/(app)/biblioteca/actions";
import { rutaDe } from "@/lib/biblioteca-acceso";

export type CarpetaNodo = { id: string; parentId: string | null; name: string };

const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Elegir la carpeta de la biblioteca donde se guarda un archivo. Con cientos de carpetas una lista desplegable no sirve, así que se
 * navega por niveles (con migas de pan), se busca por nombre y se puede crear una carpeta nueva en el sitio.
 */
export function SelectorCarpeta({ carpetas: inicial, value, onChange }: { carpetas: CarpetaNodo[]; value: string; onChange: (id: string) => void }) {
  const [carpetas, setCarpetas] = useState(inicial);
  const [abierto, setAbierto] = useState(false);
  const [actual, setActual] = useState<string | null>(null); // carpeta que se está mirando (null = raíz)
  const [q, setQ] = useState("");
  const [nueva, setNueva] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [creando, crear] = useTransition();

  const hijos = useMemo(() => {
    const m = new Map<string | null, CarpetaNodo[]>();
    for (const c of carpetas) m.set(c.parentId, [...(m.get(c.parentId) ?? []), c]);
    for (const l of m.values()) l.sort((a, b) => a.name.localeCompare(b.name, "es"));
    return m;
  }, [carpetas]);
  const nombreRuta = (id: string | null) => rutaDe(carpetas, id).map((c) => c.name);
  const elegida = value ? nombreRuta(value) : [];
  const t = norm(q.trim());
  const resultados = t ? carpetas.filter((c) => norm(c.name).includes(t)).slice(0, 40) : [];
  const migas = rutaDe(carpetas, actual);
  const lista = hijos.get(actual) ?? [];

  const abrir = () => {
    setActual(value ? (carpetas.find((c) => c.id === value)?.parentId ?? null) : null);
    setQ("");
    setNueva(null);
    setError("");
    setAbierto(true);
  };
  const elegir = (id: string) => {
    onChange(id);
    setAbierto(false);
  };
  const crearAqui = () => {
    const nombre = (nueva ?? "").trim();
    if (!nombre) return;
    setError("");
    crear(async () => {
      const r = await crearCarpeta({ parentId: actual, name: nombre });
      if (!r.ok || !r.id) return setError(r.ok ? "No se pudo crear la carpeta." : r.error);
      setCarpetas((c) => [...c, { id: r.id!, parentId: actual, name: nombre }]);
      setNueva(null);
      elegir(r.id);
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="lx-kicker flex items-center gap-1.5 text-[var(--fg-muted)]"><FolderOpen size={13} aria-hidden /> Carpeta donde se guarda</span>

      {/* Lo elegido */}
      <div className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--accent)]/12 text-[var(--accent)]"><Folder size={17} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          {elegida.length ? (
            <p className="flex flex-wrap items-center gap-x-1 text-sm font-semibold leading-snug" title={elegida.join(" › ")}>
              {elegida.map((n, i) => (
                <span key={i} className={`inline-flex items-center gap-1 ${i < elegida.length - 1 ? "font-normal text-[var(--fg-muted)]" : ""}`}>
                  {n}{i < elegida.length - 1 && <ChevronRight size={12} aria-hidden />}
                </span>
              ))}
            </p>
          ) : (
            <p className="text-sm text-[var(--fg-muted)]">Raíz de la biblioteca (sin carpeta)</p>
          )}
        </div>
        {value && <button type="button" onClick={() => onChange("")} className="lx-link shrink-0 text-xs font-medium">Quitar</button>}
        <button type="button" onClick={abierto ? () => setAbierto(false) : abrir} aria-expanded={abierto} className="lx-btn lx-btn-ghost shrink-0 !px-3 !py-1.5 text-xs">{abierto ? "Cerrar" : "Cambiar"}</button>
      </div>

      {abierto && (
        <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
          <div className="relative border-b border-[var(--border)] p-2">
            <Search size={15} aria-hidden className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
            <input
              autoFocus
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
              placeholder={`Buscar entre ${carpetas.length} carpetas…`}
              aria-label="Buscar carpeta"
              className="w-full rounded-full border border-[var(--border)] bg-[var(--bg-2)] py-2 pl-9 pr-4 text-sm outline-none transition focus:border-[var(--accent)]"
            />
          </div>

          {t ? (
            <ul className="max-h-64 overflow-y-auto p-1.5" aria-label="Resultados">
              {resultados.length === 0 && <li className="px-3 py-4 text-center text-sm text-[var(--fg-muted)]">Ninguna carpeta se llama así.</li>}
              {resultados.map((c) => {
                const ruta = nombreRuta(c.id);
                return (
                  <li key={c.id}>
                    <button type="button" onClick={() => elegir(c.id)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-[var(--surface-2)]">
                      <Folder size={15} aria-hidden className="shrink-0 text-[var(--accent)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{c.name}</span>
                        {ruta.length > 1 && <span className="block truncate text-xs text-[var(--fg-muted)]">{ruta.slice(0, -1).join(" › ")}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <>
              {/* Dónde se está mirando: se puede volver a cualquier nivel */}
              <nav aria-label="Ruta" className="flex flex-wrap items-center gap-x-1 gap-y-0.5 border-b border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-xs">
                <button type="button" onClick={() => setActual(null)} className={`inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium hover:text-[var(--accent)] ${actual === null ? "text-[var(--fg)]" : "text-[var(--fg-muted)]"}`}><Home size={12} aria-hidden /> Biblioteca</button>
                {migas.map((m, i) => (
                  <span key={m.id} className="inline-flex items-center gap-1">
                    <ChevronRight size={12} aria-hidden className="text-[var(--fg-muted)]" />
                    <button type="button" onClick={() => setActual(m.id)} className={`rounded px-1 py-0.5 font-medium hover:text-[var(--accent)] ${i === migas.length - 1 ? "text-[var(--fg)]" : "text-[var(--fg-muted)]"}`}>{m.name}</button>
                  </span>
                ))}
              </nav>
              <ul className="max-h-64 overflow-y-auto p-1.5" aria-label="Carpetas">
                {lista.length === 0 && <li className="px-3 py-4 text-center text-sm text-[var(--fg-muted)]">{actual ? "Esta carpeta no tiene subcarpetas." : "Todavía no hay carpetas."}</li>}
                {lista.map((c) => {
                  const n = hijos.get(c.id)?.length ?? 0;
                  return (
                    <li key={c.id} className="flex items-center gap-1">
                      <button type="button" onClick={() => (n ? setActual(c.id) : elegir(c.id))} className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-[var(--surface-2)] ${value === c.id ? "bg-[var(--accent)]/10 font-semibold" : ""}`}>
                        <Folder size={15} aria-hidden className="shrink-0 text-[var(--accent)]" />
                        <span className="min-w-0 flex-1 truncate">{c.name}</span>
                        {n > 0 && <span className="flex shrink-0 items-center gap-0.5 text-xs text-[var(--fg-muted)]">{n}<ChevronRight size={14} aria-hidden /></span>}
                      </button>
                      {n > 0 && <button type="button" onClick={() => elegir(c.id)} className="lx-link shrink-0 px-2 text-xs font-semibold">Elegir</button>}
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* Pie: guardar aquí o crear una carpeta nueva */}
          {!t && (
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] bg-[var(--bg-2)] px-3 py-2">
              {nueva === null ? (
                <>
                  <button type="button" onClick={() => setNueva("")} className="lx-link inline-flex items-center gap-1 text-xs font-semibold"><FolderPlus size={14} aria-hidden /> Carpeta nueva aquí</button>
                  <button type="button" onClick={() => elegir(actual ?? "")} className="lx-btn ml-auto !px-3 !py-1.5 text-xs">{actual ? `Guardar en «${migas[migas.length - 1]?.name}»` : "Guardar en la raíz"}</button>
                </>
              ) : (
                <>
                  <input autoFocus value={nueva} onChange={(e) => setNueva(e.target.value.slice(0, 120))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); crearAqui(); } if (e.key === "Escape") setNueva(null); }} placeholder="Nombre de la carpeta" aria-label="Nombre de la carpeta nueva" className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent)]" />
                  <button type="button" onClick={crearAqui} disabled={creando || !nueva.trim()} className="lx-btn !px-3 !py-1.5 text-xs disabled:opacity-50">{creando ? <Loader2 size={13} className="animate-spin" /> : <FolderPlus size={13} />} Crear y usar</button>
                  <button type="button" onClick={() => setNueva(null)} aria-label="Cancelar" className="text-[var(--fg-muted)] hover:text-[var(--fg)]"><X size={15} /></button>
                </>
              )}
            </div>
          )}
          {error && <p role="alert" className="border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--danger,#b4442e)]">{error}</p>}
        </div>
      )}
    </div>
  );
}
