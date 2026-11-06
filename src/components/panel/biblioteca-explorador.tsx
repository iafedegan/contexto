"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen, FolderPlus, Home, Link2, Loader2, MoveRight, Pencil, Search, Trash2, Upload, Users, X } from "lucide-react";
import {
  accesosDeCarpeta,
  asignarCarpeta,
  crearCarpeta,
  eliminarActivos,
  eliminarCarpeta,
  explorarBiblioteca,
  moverActivos,
  moverCarpeta,
  registrarActivos,
  renombrarActivo,
  fichaActivo,
  type FichaActivo,
  renombrarCarpeta,
  type ActivoInfo,
  type CarpetaInfo,
} from "@/app/panel/(app)/biblioteca/actions";
import { subirMedia } from "@/components/panel/subir-media";
import { rutaDe } from "@/lib/biblioteca-acceso";

/**
 * Biblioteca de imágenes: árbol de carpetas a la izquierda, archivos a la derecha. Dos usos:
 *  - «gestion» (página del panel): crear carpetas, subir, mover, renombrar, borrar y dar acceso a personas.
 *  - «selector» (paso de imagen de una nota): solo buscar y elegir entre lo que la persona puede ver.
 */
type Modo = "gestion" | "selector";
type Persona = { id: string; name: string; role: string };

const peso = (b: number | null) => (b == null ? "" : b >= 1048576 ? `${(b / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fecha = (iso: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" }).format(new Date(iso));
const ROL: Record<string, string> = { redactor: "Redactor", editor: "Editor", disenador: "Diseñador" };
const boton = "inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] px-3 text-sm font-medium transition hover:border-[var(--accent)] disabled:opacity-50";

export function BibliotecaExplorador({ modo, onElegir }: { modo: Modo; onElegir?: (a: ActivoInfo) => void }) {
  const [carpetas, setCarpetas] = useState<CarpetaInfo[]>([]);
  const [activos, setActivos] = useState<ActivoInfo[]>([]);
  const [gestiona, setGestiona] = useState(false);
  const [hayMas, setHayMas] = useState(false);
  const [actual, setActual] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [pagina, setPagina] = useState(0);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [subida, setSubida] = useState<{ hechos: number; total: number } | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [acceso, setAcceso] = useState<{ personas: Persona[]; marcadas: Set<string>; guardando: boolean } | null>(null);
  const [ficha, setFicha] = useState<FichaActivo | null>(null);
  const [moviendo, setMoviendo] = useState<{ tipo: "archivos" | "carpeta"; destino: string } | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const gestion = modo === "gestion" && gestiona;

  const cargar = useCallback(async (carpeta: string | null, texto: string, pag = 0) => {
    setCargando(true);
    setError("");
    try {
      const r = await explorarBiblioteca({ carpeta, q: texto, pagina: pag });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setCarpetas(r.carpetas);
      setActivos((previos) => (pag > 0 ? [...previos, ...r.activos] : r.activos));
      setGestiona(r.gestiona);
      setHayMas(r.hayMas);
      setPagina(pag);
      if (pag === 0) setSeleccion(new Set());
    } catch {
      setError("No se pudo cargar la biblioteca. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  }, []);

  // Se vuelve a leer al cambiar de carpeta o de búsqueda (la búsqueda espera a que la persona deje de escribir).
  useEffect(() => {
    const id = setTimeout(() => void cargar(actual, busqueda), busqueda ? 250 : 0);
    return () => clearTimeout(id);
  }, [actual, busqueda, cargar]);

  const hijas = useMemo(() => {
    const m = new Map<string | null, CarpetaInfo[]>();
    const ids = new Set(carpetas.map((c) => c.id));
    for (const c of carpetas) {
      const clave = c.parentId && ids.has(c.parentId) ? c.parentId : null;
      m.set(clave, [...(m.get(clave) ?? []), c]);
    }
    return m;
  }, [carpetas]);
  const ruta = useMemo(() => rutaDe(carpetas, actual), [carpetas, actual]);
  const nombreRuta = useCallback((id: string) => rutaDe(carpetas, id).map((c) => c.name).join(" / "), [carpetas]);
  const recargar = () => cargar(actual, busqueda);

  function abrirCarpeta(id: string | null) {
    setActual(id);
    setQ("");
    setBusqueda("");
    setAviso("");
    if (id) setAbiertas((s) => new Set(s).add(id));
  }

  async function accion(f: () => Promise<{ ok: boolean; error?: string }>, ok?: string) {
    setAviso("");
    const r = await f();
    if (!r.ok) {
      setAviso(r.error ?? "No se pudo completar.");
      return false;
    }
    if (ok) setAviso(ok);
    await recargar();
    return true;
  }

  async function nuevaCarpeta() {
    const nombre = window.prompt(actual ? `Nombre de la carpeta nueva dentro de «${nombreRuta(actual)}»` : "Nombre de la carpeta nueva");
    if (!nombre) return;
    const r = await crearCarpeta({ parentId: actual, name: nombre });
    if (!r.ok) return setAviso(r.error);
    if (actual) setAbiertas((s) => new Set(s).add(actual));
    await recargar();
  }

  async function subir(files: File[]) {
    const lista = files.filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (!lista.length) return setAviso("Elige imágenes (JPG, PNG, WebP, AVIF o GIF).");
    setAviso("");
    setSubida({ hechos: 0, total: lista.length });
    const subidos: { url: string; name: string; bytes: number }[] = [];
    const fallos: string[] = [];
    let siguiente = 0;
    // Tres a la vez: más rápido sin saturar la conexión.
    await Promise.all(
      [0, 1, 2].map(async () => {
        while (siguiente < lista.length) {
          const f = lista[siguiente++];
          const r = await subirMedia(f).catch(() => ({ ok: false as const, error: "Se cortó la conexión." }));
          if (r.ok) subidos.push({ url: r.url, name: f.name.replace(/\.[^.]+$/, ""), bytes: f.size });
          else fallos.push(`${f.name}: ${r.error}`);
          setSubida((s) => (s ? { ...s, hechos: s.hechos + 1 } : s));
        }
      }),
    );
    setSubida(null);
    if (subidos.length) {
      const r = await registrarActivos({ carpeta: actual, archivos: subidos });
      if (!r.ok) fallos.push(r.error);
    }
    setAviso(fallos.length ? `Se subieron ${subidos.length} de ${lista.length}. ${fallos.slice(0, 3).join(" · ")}` : `Se subieron ${subidos.length} ${subidos.length === 1 ? "archivo" : "archivos"}.`);
    await recargar();
  }

  async function abrirAcceso() {
    if (!actual) return;
    const r = await accesosDeCarpeta({ carpeta: actual });
    if (!r.ok) return setAviso(r.error);
    setAcceso({ personas: r.personas, marcadas: new Set(r.asignadas), guardando: false });
  }

  async function guardarAcceso() {
    if (!acceso || !actual) return;
    setAcceso({ ...acceso, guardando: true });
    const r = await asignarCarpeta({ carpeta: actual, userIds: [...acceso.marcadas] });
    setAcceso(null);
    setAviso(r.ok ? "Acceso guardado: las personas marcadas ven esta carpeta y todo lo que hay dentro." : r.error);
  }

  const carpetaActual = actual ? carpetas.find((c) => c.id === actual) : null;
  const chosen = activos.filter((a) => seleccion.has(a.id));

  function Nodo({ c, nivel }: { c: CarpetaInfo; nivel: number }) {
    const sub = hijas.get(c.id) ?? [];
    const abierta = abiertas.has(c.id);
    const activa = actual === c.id && !busqueda;
    return (
      <li>
        <div className={`flex items-center rounded-[var(--radius)] ${activa ? "bg-[var(--accent)]/15 font-semibold" : "hover:bg-[var(--surface-2)]"}`} style={{ paddingLeft: nivel * 12 }}>
          <button
            type="button"
            aria-label={abierta ? "Cerrar carpeta" : "Abrir carpeta"}
            aria-expanded={sub.length ? abierta : undefined}
            onClick={() => setAbiertas((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })}
            className={`grid size-7 shrink-0 place-items-center text-[var(--fg-muted)] ${sub.length ? "" : "invisible"}`}
          >
            {abierta ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
          </button>
          <button type="button" onClick={() => abrirCarpeta(c.id)} className="flex min-h-8 min-w-0 flex-1 items-center gap-2 pr-2 text-left text-sm">
            {activa ? <FolderOpen size={16} aria-hidden className="shrink-0 text-[var(--accent)]" /> : <Folder size={16} aria-hidden className="shrink-0 text-[var(--fg-muted)]" />}
            <span className="truncate">{c.name}</span>
          </button>
        </div>
        {abierta && sub.length > 0 && (
          <ul>
            {sub.map((h) => (
              <Nodo key={h.id} c={h} nivel={nivel + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  const raices = hijas.get(null) ?? [];
  const sinNada = !cargando && !error && activos.length === 0;

  return (
    <div className="grid min-h-0 gap-4 md:grid-cols-[16rem_1fr]">
      {/* Carpetas */}
      <nav aria-label="Carpetas" className="min-h-0 overflow-y-auto rounded-[var(--radius)] border border-[var(--border)] p-2 md:max-h-[70vh]">
        {(gestiona || modo === "gestion") && (
          <button type="button" onClick={() => abrirCarpeta(null)} className={`flex min-h-8 w-full items-center gap-2 rounded-[var(--radius)] px-2 text-left text-sm ${actual === null && !busqueda ? "bg-[var(--accent)]/15 font-semibold" : "hover:bg-[var(--surface-2)]"}`}>
            <Home size={16} aria-hidden className="shrink-0 text-[var(--fg-muted)]" /> Todas las imágenes
          </button>
        )}
        {raices.length === 0 && !cargando ? (
          <p className="p-3 text-sm text-[var(--fg-muted)]">{gestion ? "Aún no hay carpetas. Crea la primera." : "Todavía no tienes carpetas asignadas. Pídele a la diseñadora que te dé acceso."}</p>
        ) : (
          <ul className="mt-1">
            {raices.map((c) => (
              <Nodo key={c.id} c={c} nivel={0} />
            ))}
          </ul>
        )}
      </nav>

      {/* Archivos */}
      <section
        className={`min-w-0 rounded-[var(--radius)] ${arrastrando ? "outline-2 outline-dashed outline-[var(--accent)]" : ""}`}
        onDragOver={gestion ? (e) => { e.preventDefault(); setArrastrando(true); } : undefined}
        onDragLeave={gestion ? () => setArrastrando(false) : undefined}
        onDrop={gestion ? (e) => { e.preventDefault(); setArrastrando(false); void subir([...e.dataTransfer.files]); } : undefined}
      >
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-48 flex-1">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setBusqueda(e.target.value.trim()); }}
              placeholder={modo === "selector" ? "Buscar por nombre en tus carpetas" : "Buscar por nombre"}
              aria-label="Buscar imágenes por nombre"
              className="lx-input w-full pl-9"
            />
          </label>
          {gestion && (
            <>
              <button type="button" className={boton} onClick={nuevaCarpeta}><FolderPlus size={16} aria-hidden /> Crear carpeta</button>
              <button type="button" className="lx-btn" onClick={() => entrada.current?.click()} disabled={!!subida}>
                {subida ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Upload size={16} aria-hidden />} Subir archivos
              </button>
              <input ref={entrada} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/gif" className="sr-only" tabIndex={-1} onChange={(e) => { void subir([...(e.target.files ?? [])]); e.target.value = ""; }} />
            </>
          )}
        </div>

        {/* Dónde estoy y qué puedo hacer con esta carpeta */}
        {!busqueda && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <button type="button" onClick={() => abrirCarpeta(null)} className="text-[var(--fg-muted)] hover:underline">Biblioteca</button>
            {ruta.map((c) => (
              <span key={c.id} className="flex items-center gap-2">
                <ChevronRight size={14} aria-hidden className="text-[var(--fg-muted)]" />
                <button type="button" onClick={() => abrirCarpeta(c.id)} className={c.id === actual ? "font-semibold" : "hover:underline"}>{c.name}</button>
              </span>
            ))}
            {gestion && carpetaActual && (
              <span className="ml-auto flex flex-wrap items-center gap-2">
                <button type="button" className={boton} onClick={abrirAcceso}><Users size={15} aria-hidden /> Quién la ve</button>
                <button type="button" className={boton} onClick={async () => { const n = window.prompt("Nuevo nombre de la carpeta", carpetaActual.name); if (n) await accion(() => renombrarCarpeta({ id: carpetaActual.id, name: n })); }}><Pencil size={15} aria-hidden /> Renombrar</button>
                <button type="button" className={boton} onClick={() => setMoviendo({ tipo: "carpeta", destino: carpetaActual.parentId ?? "" })}><MoveRight size={15} aria-hidden /> Mover</button>
                <button type="button" className={boton} onClick={async () => { if (window.confirm(`¿Eliminar la carpeta «${carpetaActual.name}»? Solo se puede si está vacía.`)) { const ok = await accion(() => eliminarCarpeta({ id: carpetaActual.id }), "Carpeta eliminada."); if (ok) abrirCarpeta(carpetaActual.parentId); } }}><Trash2 size={15} aria-hidden /> Eliminar</button>
              </span>
            )}
          </div>
        )}
        {busqueda && <p className="mt-3 text-sm text-[var(--fg-muted)]">Resultados para «{busqueda}»{hayMas ? " (los 60 más recientes)" : ""}</p>}

        {subida && (
          <p role="status" className="mt-3 text-sm">
            Subiendo {Math.min(subida.hechos + 1, subida.total)} de {subida.total}…
            <span aria-hidden className="mt-1 block h-1 overflow-hidden rounded-full bg-[var(--surface-2)]"><span className="block h-full bg-[var(--accent)] transition-all" style={{ width: `${(subida.hechos / subida.total) * 100}%` }} /></span>
          </p>
        )}
        {aviso && <p role="status" className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm">{aviso}</p>}
        {error && <p role="alert" className="mt-3 text-sm text-[var(--danger)]">{error}</p>}

        {/* Acciones sobre lo marcado */}
        {gestion && chosen.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-[var(--accent)] px-3 py-2 text-sm">
            <span className="font-medium">{chosen.length} {chosen.length === 1 ? "marcado" : "marcados"}</span>
            <button type="button" className={boton} onClick={() => setMoviendo({ tipo: "archivos", destino: actual ?? "" })}><MoveRight size={15} aria-hidden /> Mover</button>
            <button type="button" className={boton} onClick={async () => { await navigator.clipboard?.writeText(chosen.map((a) => a.url).join("\n")).catch(() => {}); setAviso("Enlaces copiados."); }}><Link2 size={15} aria-hidden /> Copiar enlaces</button>
            <button type="button" className={boton} onClick={async () => { if (window.confirm(`¿Quitar ${chosen.length} de la biblioteca? Las notas que ya los usan no se afectan.`)) await accion(() => eliminarActivos({ ids: chosen.map((a) => a.id) }), "Quitados de la biblioteca."); }}><Trash2 size={15} aria-hidden /> Quitar</button>
            <button type="button" className="ml-auto text-[var(--fg-muted)] hover:underline" onClick={() => setSeleccion(new Set())}>Quitar marcas</button>
          </div>
        )}

        {cargando && <p className="mt-6 flex items-center gap-2 text-sm text-[var(--fg-muted)]"><Loader2 size={16} className="animate-spin" aria-hidden /> Cargando…</p>}

        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {activos.map((a) => {
            const marcado = seleccion.has(a.id);
            const imagen = a.kind === "imagen";
            const cuerpo = (
              <>
                {imagen ? (
                  // eslint-disable-next-line @next/next/no-img-element -- miniatura remota del bucket; no necesita optimización
                  <img src={a.url} alt={a.name} loading="lazy" className="aspect-[4/3] w-full rounded-[calc(var(--radius)*0.75)] bg-[var(--surface-2)] object-cover" />
                ) : (
                  <span className="grid aspect-[4/3] w-full place-items-center rounded-[calc(var(--radius)*0.75)] bg-[var(--surface-2)] text-xs text-[var(--fg-muted)]">Video</span>
                )}
                <span className="mt-1.5 block truncate text-sm font-medium">{a.name}</span>
                <span className="block truncate text-xs text-[var(--fg-muted)]">{busqueda && a.carpeta ? `${a.carpeta} · ` : ""}{fecha(a.createdAt)}{a.bytes ? ` · ${peso(a.bytes)}` : ""}</span>
              </>
            );
            return (
              <li key={a.id} className={`group/a relative rounded-[var(--radius)] border p-2 ${marcado ? "border-[var(--accent)]" : "border-[var(--border)]"}`}>
                {modo === "selector" ? (
                  <button type="button" disabled={!imagen} onClick={() => onElegir?.(a)} className="block w-full text-left disabled:opacity-50" aria-label={`Usar ${a.name}`}>{cuerpo}</button>
                ) : (
                  <>
                    <a href={a.url} target="_blank" rel="noreferrer" className="block">{cuerpo}</a>
                    {gestion && (
                      <>
                        <input type="checkbox" checked={marcado} onChange={() => setSeleccion((s) => { const n = new Set(s); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n; })} aria-label={`Marcar ${a.name}`} className="absolute left-3.5 top-3.5 size-5 accent-[var(--accent)]" />
                        <button type="button" aria-label={`Ficha de ${a.name}`} onClick={async () => { const r = await fichaActivo({ id: a.id }); if (r.ok) setFicha(r.ficha); else setError(r.error); }} className="absolute right-12 top-3.5 grid size-8 place-items-center rounded-full bg-black/55 text-xs font-bold text-white opacity-0 transition focus:opacity-100 group-hover/a:opacity-100 [@media(pointer:coarse)]:opacity-100">i</button>
                        <button type="button" aria-label={`Renombrar ${a.name}`} onClick={async () => { const n = window.prompt("Nuevo nombre", a.name); if (n) await accion(() => renombrarActivo({ id: a.id, name: n })); }} className="absolute right-3.5 top-3.5 grid size-8 place-items-center rounded-full bg-black/55 text-white opacity-0 transition focus:opacity-100 group-hover/a:opacity-100 [@media(pointer:coarse)]:opacity-100"><Pencil size={14} aria-hidden /></button>
                      </>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
        {hayMas && !busqueda && !cargando && (
          <div className="mt-4 text-center">
            <button type="button" className={boton} onClick={() => void cargar(actual, busqueda, pagina + 1)}>Cargar más imágenes</button>
          </div>
        )}
        {sinNada && (
          <p className="mt-8 text-center text-sm text-[var(--fg-muted)]">
            {busqueda ? "Ninguna imagen se llama así en las carpetas que ves." : gestion ? "Esta carpeta está vacía. Arrastra imágenes aquí o usa «Subir archivos»." : actual ? "Esta carpeta aún no tiene imágenes." : "Elige una carpeta para ver sus imágenes."}
          </p>
        )}
      </section>

      {/* Quién ve esta carpeta */}
      {ficha && (
        <Ventana titulo={ficha.name} onCerrar={() => setFicha(null)}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-[var(--fg-muted)]">Tipo</dt><dd>{ficha.mime ?? ficha.kind}</dd>
            <dt className="text-[var(--fg-muted)]">Peso</dt><dd>{ficha.bytes ? peso(ficha.bytes) : "—"}</dd>
            <dt className="text-[var(--fg-muted)]">Fecha</dt><dd>{fecha(ficha.creada)}</dd>
            <dt className="text-[var(--fg-muted)]">Subida por</dt><dd>{ficha.subidaPor ?? "Importada de las notas"}</dd>
            <dt className="text-[var(--fg-muted)]">Dirección</dt><dd className="break-all text-xs">{ficha.url}</dd>
          </dl>
          <h3 className="mt-4 text-sm font-semibold">Usada en {ficha.usos.length} {ficha.usos.length === 1 ? "nota" : "notas"}</h3>
          <ul className="mt-2 flex max-h-64 flex-col gap-2 overflow-y-auto text-sm">
            {ficha.usos.map((u) => (
              <li key={u.slug} className="rounded-[var(--radius)] border border-[var(--border)] p-2">
                <a href={`/articulo/${u.slug}`} target="_blank" rel="noreferrer" className="font-medium hover:underline">{u.titulo}</a>
                <span className="block text-xs text-[var(--fg-muted)]">{u.periodista ?? "Sin periodista"} · {u.seccion ?? "Sin sección"} · {u.fecha ?? u.estado} · {u.comoPortada ? "portada" : "en el texto"}</span>
              </li>
            ))}
            {!ficha.usos.length && <li className="text-[var(--fg-muted)]">Ninguna nota la usa todavía.</li>}
          </ul>
        </Ventana>
      )}
      {acceso && carpetaActual && (
        <Ventana titulo={`Quién ve «${carpetaActual.name}»`} onCerrar={() => setAcceso(null)}>
          <p className="text-sm text-[var(--fg-muted)]">Las personas marcadas ven esta carpeta y todo lo que hay dentro. Los administradores y la diseñadora ven todo siempre.</p>
          <ul className="mt-3 max-h-72 divide-y divide-[var(--border)] overflow-y-auto rounded-[var(--radius)] border border-[var(--border)]">
            {acceso.personas.map((p) => (
              <li key={p.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 text-sm">
                  <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={acceso.marcadas.has(p.id)} onChange={() => { const n = new Set(acceso.marcadas); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); setAcceso({ ...acceso, marcadas: n }); }} />
                  <span className="flex-1">{p.name}</span>
                  <span className="text-xs text-[var(--fg-muted)]">{ROL[p.role] ?? p.role}</span>
                </label>
              </li>
            ))}
            {acceso.personas.length === 0 && <li className="p-3 text-sm text-[var(--fg-muted)]">No hay redactores ni editores activos.</li>}
          </ul>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className={boton} onClick={() => setAcceso(null)}>Cancelar</button>
            <button type="button" className="lx-btn" disabled={acceso.guardando} onClick={guardarAcceso}>Guardar acceso</button>
          </div>
        </Ventana>
      )}

      {/* Mover archivos o la carpeta */}
      {moviendo && (
        <Ventana titulo={moviendo.tipo === "carpeta" ? "Mover la carpeta a…" : `Mover ${chosen.length} ${chosen.length === 1 ? "archivo" : "archivos"} a…`} onCerrar={() => setMoviendo(null)}>
          <label className="block text-sm">
            Carpeta de destino
            <select value={moviendo.destino} onChange={(e) => setMoviendo({ ...moviendo, destino: e.target.value })} className="lx-input mt-1 w-full">
              <option value="">Raíz (sin carpeta)</option>
              {carpetas.filter((c) => moviendo.tipo !== "carpeta" || !rutaDe(carpetas, c.id).some((x) => x.id === actual)).map((c) => <option key={c.id} value={c.id}>{nombreRuta(c.id)}</option>)}
            </select>
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className={boton} onClick={() => setMoviendo(null)}>Cancelar</button>
            <button
              type="button"
              className="lx-btn"
              onClick={async () => {
                const destino = moviendo.destino || null;
                const ok = await accion(() => (moviendo.tipo === "carpeta" && actual ? moverCarpeta({ id: actual, parentId: destino }) : moverActivos({ ids: chosen.map((a) => a.id), carpeta: destino })), "Listo, se movió.");
                if (ok) setMoviendo(null);
              }}
            >
              Mover aquí
            </button>
          </div>
        </Ventana>
      )}
    </div>
  );
}

/** Ventana sencilla encima de la biblioteca. */
function Ventana({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const cerrar = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [onCerrar]);
  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="w-full max-w-md rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold">{titulo}</h2>
          <button type="button" aria-label="Cerrar" onClick={onCerrar} className="grid size-8 place-items-center rounded-full hover:bg-[var(--surface-2)]"><X size={16} aria-hidden /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
