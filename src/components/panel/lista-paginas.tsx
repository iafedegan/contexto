"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Eye, EyeOff, FilePlus2, Loader2, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { borrarPagina, crearPagina, duplicarPagina, publicarPagina } from "@/app/panel/(app)/paginas/actions";

export type FilaPagina = { id: string; titulo: string; slug: string; publicada: boolean; actualizada: string; seccion: string | null; seccionId: string | null };
export type OpcionSeccion = { id: string; name: string; slug: string };

type Filtro = "todas" | "publicadas" | "borradores";

const sinTildes = (t: string) => t.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
const slugVista = (t: string) => sinTildes(t).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "nombre-de-la-pagina";
const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });

const boton = "inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold !text-white transition hover:opacity-90 disabled:opacity-60";
const botonSuave = "inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-white px-4 py-2 text-sm font-semibold transition hover:border-[var(--accent)] disabled:opacity-60";

/**
 * Páginas, como en los CMS que mejor lo hacen (el panel «Pages» de Squarespace y Webflow, la lista de WordPress): el mapa del sitio con las
 * páginas agrupadas por sección, el estado a la vista, «+ Añadir página aquí» en cada sección, un botón principal por fila («Editar») y un
 * menú ⋯ con lo demás (ver, duplicar, publicar u ocultar, eliminar con confirmación). Con búsqueda y filtro por estado.
 */
export function ListaPaginas({ paginas, secciones }: { paginas: FilaPagina[]; secciones: OpcionSeccion[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [nueva, setNueva] = useState<{ seccionId: string } | null>(null);
  const [aBorrar, setABorrar] = useState<FilaPagina | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, start] = useTransition();

  const cuenta = useMemo(() => ({ todas: paginas.length, publicadas: paginas.filter((p) => p.publicada).length, borradores: paginas.filter((p) => !p.publicada).length }), [paginas]);

  const grupos = useMemo(() => {
    const buscada = sinTildes(q.trim());
    const visibles = paginas.filter((p) => (filtro === "todas" || (filtro === "publicadas" ? p.publicada : !p.publicada)) && (!buscada || sinTildes(`${p.titulo} ${p.slug}`).includes(buscada)));
    const porSeccion = new Map<string, { nombre: string; id: string; filas: FilaPagina[] }>();
    for (const p of visibles) {
      const clave = p.seccionId ?? "";
      if (!porSeccion.has(clave)) porSeccion.set(clave, { id: clave, nombre: p.seccion ?? "Páginas sueltas", filas: [] });
      porSeccion.get(clave)!.filas.push(p);
    }
    return [...porSeccion.values()].sort((a, b) => (a.id === "" ? 1 : b.id === "" ? -1 : a.nombre.localeCompare(b.nombre, "es")));
  }, [paginas, q, filtro]);

  function accion(fn: () => Promise<{ ok: boolean; error?: string }>, exito: string) {
    setAviso(null);
    start(async () => {
      const r = await fn();
      setAviso(r.ok ? { ok: true, texto: exito } : { ok: false, texto: r.error ?? "No se pudo hacer." });
      router.refresh();
    });
  }

  if (paginas.length === 0)
    return (
      <>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--border-strong)] bg-white/60 px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]"><FilePlus2 size={26} /></span>
          <h2 className="text-lg font-semibold">Crea tu primera página</h2>
          <p className="max-w-md text-sm text-[var(--fg-muted)]">Ponle un nombre, elige en qué parte del sitio va y arma su diseño con filas, columnas, textos, imágenes y notas. Queda en borrador hasta que la publiques.</p>
          <button type="button" onClick={() => setNueva({ seccionId: "" })} className={boton}><Plus size={16} /> Nueva página</button>
        </div>
        {nueva && <DialogoNueva secciones={secciones} inicial={nueva.seccionId} onCerrar={() => setNueva(null)} />}
      </>
    );

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de herramientas: buscar, filtrar y crear. */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[14rem] flex-1">
          <Search size={15} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar una página…" aria-label="Buscar una página" className="w-full rounded-full border border-[var(--border-strong)] bg-white py-2.5 pl-10 pr-4 text-sm" />
        </label>
        <div role="group" aria-label="Filtrar por estado" className="inline-flex rounded-full border border-[var(--border-strong)] bg-white p-0.5">
          {([["todas", "Todas"], ["publicadas", "Publicadas"], ["borradores", "Borradores"]] as const).map(([id, nombre]) => (
            <button key={id} type="button" aria-pressed={filtro === id} onClick={() => setFiltro(id)} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${filtro === id ? "bg-[var(--accent)] !text-white" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>
              {nombre} <span className={`ml-0.5 text-xs ${filtro === id ? "opacity-80" : "opacity-70"}`}>{cuenta[id]}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setNueva({ seccionId: "" })} className={boton}><Plus size={16} /> Nueva página</button>
      </div>

      {aviso && (
        <p role={aviso.ok ? "status" : "alert"} className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm ${aviso.ok ? "border-[#16a34a]/30 bg-[#16a34a]/10 text-[#15803d]" : "border-[#b91c1c]/30 bg-[#b91c1c]/10 text-[#b91c1c]"}`}>
          {aviso.texto}
          <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso"><X size={15} /></button>
        </p>
      )}

      {grupos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-white/60 p-10 text-center text-sm text-[var(--fg-muted)]">Ninguna página coincide con lo que buscas.</p>
      ) : (
        grupos.map((g) => (
          <section key={g.id || "sueltas"} aria-label={g.nombre} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
            <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-2.5">
              <h2 className="text-sm font-bold">
                {g.nombre} <span className="ml-1 text-xs font-medium text-[var(--fg-muted)]">{g.filas.length} {g.filas.length === 1 ? "página" : "páginas"}</span>
              </h2>
              <button type="button" onClick={() => setNueva({ seccionId: g.id })} className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/10">
                <Plus size={13} /> Añadir página aquí
              </button>
            </header>
            <ul className="divide-y divide-[var(--border)]">
              {g.filas.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3 transition hover:bg-[var(--surface-2)]/40">
                  <span aria-hidden title={p.publicada ? "Publicada" : "Borrador"} className={`size-2.5 shrink-0 rounded-full ${p.publicada ? "bg-[#16a34a]" : "bg-[#f2a900]"}`} />
                  <Link href={`/panel/paginas/${p.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.titulo}</span>
                    <span className="block truncate font-mono text-xs text-[var(--fg-muted)]">/{p.slug}</span>
                  </Link>
                  <span className={`hidden rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline ${p.publicada ? "bg-[#16a34a]/15 text-[#15803d]" : "bg-[#f2a900]/20 text-[#8a6200]"}`}>{p.publicada ? "Publicada" : "Borrador"}</span>
                  <span className="hidden text-xs text-[var(--fg-muted)] md:inline">{fecha(p.actualizada)}</span>
                  <Link href={`/panel/paginas/${p.id}`} className={`${boton} !px-3.5 !py-1.5`}><Pencil size={13} /> Editar</Link>
                  <MenuFila
                    fila={p}
                    ocupado={ocupado}
                    onDuplicar={() => accion(() => duplicarPagina(p.id), "Página duplicada: la copia quedó en borrador.")}
                    onPublicar={() => accion(() => publicarPagina(p.id, !p.publicada), p.publicada ? "La página ya no se ve en el sitio." : "Página publicada: ya se ve en el sitio.")}
                    onBorrar={() => setABorrar(p)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {nueva && <DialogoNueva secciones={secciones} inicial={nueva.seccionId} onCerrar={() => setNueva(null)} />}
      {aBorrar && (
        <Modal titulo="¿Eliminar esta página?" onCerrar={() => setABorrar(null)}>
          <p className="text-sm">
            Se borrará <strong>«{aBorrar.titulo}»</strong> con todo su diseño, y la dirección <span className="font-mono">/{aBorrar.slug}</span> dejará de existir en el sitio. <strong>No se puede deshacer.</strong>
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setABorrar(null)} className={botonSuave}>Cancelar</button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => {
                const p = aBorrar;
                setABorrar(null);
                accion(() => borrarPagina(p.id), "Página eliminada.");
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#b91c1c] px-4 py-2 text-sm font-semibold !text-white transition hover:opacity-90"
            >
              <Trash2 size={14} /> Sí, eliminar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// El menú ⋯ de una fila: ver, duplicar, publicar u ocultar y eliminar.
function MenuFila({ fila, ocupado, onDuplicar, onPublicar, onBorrar }: { fila: FilaPagina; ocupado: boolean; onDuplicar: () => void; onPublicar: () => void; onBorrar: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);
  const item = "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition hover:bg-[var(--surface-2)] disabled:opacity-50";
  return (
    <div ref={caja} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={abierto} aria-label={`Más acciones de ${fila.titulo}`} onClick={() => setAbierto((a) => !a)} className="grid size-9 place-items-center rounded-full text-[var(--fg-muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--fg)]">
        {ocupado ? <Loader2 size={16} className="animate-spin" /> : <MoreHorizontal size={18} />}
      </button>
      {abierto && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-[var(--border-strong)] bg-white py-1 shadow-xl">
          {fila.publicada ? (
            <a role="menuitem" href={`/${fila.slug}`} target="_blank" rel="noreferrer" className={item} onClick={() => setAbierto(false)}><ExternalLink size={15} /> Ver en el sitio</a>
          ) : (
            <span className={`${item} cursor-default opacity-60`} title="Publícala para poder verla en el sitio"><ExternalLink size={15} /> Ver en el sitio (publícala primero)</span>
          )}
          <button type="button" role="menuitem" disabled={ocupado} className={item} onClick={() => { setAbierto(false); onDuplicar(); }}><Copy size={15} /> Duplicar</button>
          <button type="button" role="menuitem" disabled={ocupado} className={item} onClick={() => { setAbierto(false); onPublicar(); }}>
            {fila.publicada ? <><EyeOff size={15} /> Ocultar del sitio</> : <><Eye size={15} /> Publicar</>}
          </button>
          <div className="my-1 border-t border-[var(--border)]" />
          <button type="button" role="menuitem" className={`${item} text-[#b91c1c]`} onClick={() => { setAbierto(false); onBorrar(); }}><Trash2 size={15} /> Eliminar…</button>
        </div>
      )}
    </div>
  );
}

// Ventana centrada con fondo atenuado; se cierra con Escape o pulsando fuera.
function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [onCerrar]);
  return (
    <div className="fixed inset-0 z-[300] grid place-items-center bg-black/45 p-4 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div role="dialog" aria-modal="true" aria-label={titulo} className="w-full max-w-md rounded-2xl border border-[var(--border-strong)] bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid size-8 place-items-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Crear una página: nombre, sección y un adelanto de su dirección; al crearla se abre el constructor.
function DialogoNueva({ secciones, inicial, onCerrar }: { secciones: OpcionSeccion[]; inicial: string; onCerrar: () => void }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [seccionId, setSeccionId] = useState(inicial);
  const [error, setError] = useState("");
  const [ocupado, start] = useTransition();
  const seccion = secciones.find((s) => s.id === seccionId);
  const direccion = `/${seccion ? `${seccion.slug}/` : ""}${slugVista(titulo)}`;
  function crear() {
    setError("");
    start(async () => {
      const r = await crearPagina(titulo, seccionId || null);
      if (r.ok && r.id) router.push(`/panel/paginas/${r.id}`);
      else if (!r.ok) setError(r.error);
    });
  }
  return (
    <Modal titulo="Nueva página" onCerrar={onCerrar}>
      <form onSubmit={(e) => { e.preventDefault(); if (titulo.trim()) crear(); }} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Nombre de la página
          <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={160} placeholder="Por ejemplo: Ferias 2027" className="rounded-xl border border-[var(--border-strong)] px-3.5 py-2.5 text-sm font-normal" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          ¿Dónde va en el sitio?
          <select value={seccionId} onChange={(e) => setSeccionId(e.target.value)} className="rounded-xl border border-[var(--border-strong)] px-3.5 py-2.5 text-sm font-normal">
            <option value="">Suelta (sin sección)</option>
            {secciones.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <p className="rounded-lg bg-[var(--surface-2)]/70 px-3 py-2 text-xs text-[var(--fg-muted)]">Su dirección será <span className="font-mono font-semibold text-[var(--fg)]">{direccion}</span>. Queda en borrador hasta que la publiques.</p>
        {error && <p role="alert" className="text-sm text-[#b91c1c]">{error}</p>}
        <div className="mt-1 flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className={botonSuave}>Cancelar</button>
          <button type="submit" disabled={ocupado || !titulo.trim()} className={boton}>
            {ocupado ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />} Crear y diseñar
          </button>
        </div>
      </form>
    </Modal>
  );
}
