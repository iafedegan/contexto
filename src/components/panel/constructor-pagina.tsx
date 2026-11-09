"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, BadgeDollarSign, ChevronDown, Columns3, Contact, Copy, ExternalLink, Eye, EyeOff, FileDown,
  GalleryHorizontal, GripVertical, Hash, Headphones, Heading, Image as ImageIcon, Images, LayoutGrid, LayoutTemplate, List, ListCollapse, Loader2,
  MailPlus, Map as MapIcon, Megaphone, Milestone, Minus, MousePointerClick, MoveVertical, Newspaper, PanelTop, Pencil, Pilcrow, Plus, Quote, Redo2,
  Rows3, Save, Search, Share2, Sparkles, SquareSplitHorizontal, Table2, Timer, Trash2, Type, Undo2, Users, Video, X, Award, Footprints,
} from "lucide-react";
import { borrarPagina, guardarPagina, publicarPagina } from "@/app/panel/(app)/paginas/actions";
import { ElementoVista, claseColumna, claseFila, estiloFila } from "@/components/pagina-vista";
import { SelectorBiblioteca } from "@/components/panel/selector-biblioteca";
import {
  DIVISIONES, ESQUEMAS, PALETA, PLANTILLAS, duplicarElemento, duplicarFila, elementoNuevo, esBloque, filaNueva, nuevoId, rutaPagina,
  type Alinear, type Campo, type ContenidoPagina, type Elemento, type ElementoBloque, type Fila, type TipoElemento, type Valores,
} from "@/lib/paginas-bloques";

type Pagina = { id: string; titulo: string; slug: string; descripcion: string; publicada: boolean; contenido: ContenidoPagina };
type Sel = { fila: number; celda: number; el: string } | null;
// Lo que se arrastra: un elemento nuevo de la paleta o uno que ya está en el lienzo.
type Arrastre = { nuevo: TipoElemento } | { mover: string };

const ICONOS: Record<TipoElemento, ReactNode> = {
  titulo: <Heading size={18} />, parrafo: <Pilcrow size={18} />, lista: <List size={18} />, cita: <Quote size={18} />, aviso: <Megaphone size={18} />,
  imagen: <ImageIcon size={18} />, video: <Video size={18} />, boton: <MousePointerClick size={18} />, notas: <Newspaper size={18} />,
  separador: <Minus size={18} />, espacio: <MoveVertical size={18} />,
  heroe: <PanelTop size={18} />, carrusel: <GalleryHorizontal size={18} />, tarjetas: <LayoutGrid size={18} />, galeria: <Images size={18} />,
  acordeon: <ListCollapse size={18} />, pestanas: <Columns3 size={18} />, cifras: <Hash size={18} />, caracteristicas: <Sparkles size={18} />,
  testimonios: <Quote size={18} />, linea: <Milestone size={18} />, pasos: <Footprints size={18} />, equipo: <Users size={18} />, logos: <Award size={18} />,
  tabla: <Table2 size={18} />, llamado: <Megaphone size={18} />, destacado: <Type size={18} />, audio: <Headphones size={18} />, mapa: <MapIcon size={18} />,
  contacto: <Contact size={18} />, cuenta: <Timer size={18} />, redes: <Share2 size={18} />, descarga: <FileDown size={18} />, boletin: <MailPlus size={18} />,
  comparacion: <SquareSplitHorizontal size={18} />, precios: <BadgeDollarSign size={18} />,
};
const NOMBRE = Object.fromEntries(PALETA.flatMap((g) => g.items.map((i) => [i.tipo, i.etiqueta]))) as Record<TipoElemento, string>;

/** Busca un elemento por id en todo el contenido. */
function ubicar(c: ContenidoPagina, id: string): { fila: number; celda: number; i: number } | null {
  for (let f = 0; f < c.filas.length; f++)
    for (let k = 0; k < c.filas[f].celdas.length; k++) {
      const i = c.filas[f].celdas[k].findIndex((e) => e.id === id);
      if (i >= 0) return { fila: f, celda: k, i };
    }
  return null;
}
const copia = (c: ContenidoPagina): ContenidoPagina => JSON.parse(JSON.stringify(c));

/**
 * Constructor de páginas: a la izquierda los elementos y las filas prediseñadas, en el centro la página como filas de una
 * cuadrícula de 12 columnas y a la derecha lo que se puede cambiar del elemento elegido. Se arrastra de la paleta a una columna
 * (o se pulsa para añadirlo a la columna elegida) y los elementos del lienzo se pueden arrastrar entre columnas y filas.
 */
export function ConstructorPagina({ pagina, secciones }: { pagina: Pagina; secciones: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(pagina.titulo);
  const [slug, setSlug] = useState(pagina.slug);
  const [slugGuardado, setSlugGuardado] = useState(pagina.slug);
  const [descripcion, setDescripcion] = useState(pagina.descripcion);
  const [publicada, setPublicada] = useState(pagina.publicada);
  const [hist, setHist] = useState<{ pasado: ContenidoPagina[]; actual: ContenidoPagina; futuro: ContenidoPagina[] }>({ pasado: [], actual: pagina.contenido, futuro: [] });
  const c = hist.actual;
  const [sel, setSel] = useState<Sel>(null);
  const [celdaActiva, setCeldaActiva] = useState<{ fila: number; celda: number } | null>(pagina.contenido.filas.length ? { fila: 0, celda: 0 } : null);
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const [destino, setDestino] = useState<string | null>(null);
  const [vista, setVista] = useState(false);
  const [sucio, setSucio] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [ocupado, start] = useTransition();
  const [elegirImagen, setElegirImagen] = useState<((url: string, nombre: string) => void) | null>(null);
  const [divisionNueva, setDivisionNueva] = useState(false);
  const [pestanaPaleta, setPestanaPaleta] = useState<"elementos" | "plantillas">("elementos");
  const [buscar, setBuscar] = useState("");

  /** Aplica un cambio al contenido guardando el estado anterior para deshacer. */
  const cambiar = useCallback((fn: (c: ContenidoPagina) => void) => {
    setHist((h) => {
      const n = copia(h.actual);
      fn(n);
      return { pasado: [...h.pasado.slice(-80), h.actual], actual: n, futuro: [] };
    });
    setSucio(true);
  }, []);
  const deshacer = () => setHist((h) => (h.pasado.length ? { pasado: h.pasado.slice(0, -1), actual: h.pasado[h.pasado.length - 1], futuro: [h.actual, ...h.futuro] } : h));
  const rehacer = () => setHist((h) => (h.futuro.length ? { pasado: [...h.pasado, h.actual], actual: h.futuro[0], futuro: h.futuro.slice(1) } : h));

  // Aviso al salir con cambios sin guardar.
  useEffect(() => {
    if (!sucio) return;
    const f = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [sucio]);

  const elegido = useMemo(() => {
    if (!sel) return null;
    const u = ubicar(c, sel.el);
    return u ? c.filas[u.fila].celdas[u.celda][u.i] : null;
  }, [c, sel]);

  // --- Filas ---
  function anadirFila(columnas: number[]) {
    const pos = c.filas.length;
    cambiar((n) => void n.filas.push(filaNueva(columnas)));
    setCeldaActiva({ fila: pos, celda: 0 });
    setDivisionNueva(false);
  }
  function anadirPlantilla(crear: () => Fila) {
    // Si hay una fila elegida, la plantilla entra justo debajo; si no, al final.
    const pos = celdaActiva && c.filas[celdaActiva.fila] ? celdaActiva.fila + 1 : c.filas.length;
    cambiar((n) => void n.filas.splice(pos, 0, crear()));
    setCeldaActiva({ fila: pos, celda: 0 });
    setSel(null);
    setDivisionNueva(false);
  }
  function cambiarDivision(f: number, columnas: number[]) {
    cambiar((n) => {
      const fila = n.filas[f];
      const viejas = fila.celdas;
      // Si quedan menos columnas, lo de las que sobran pasa a la última.
      const celdas: Elemento[][] = columnas.map((_, i) => [...(viejas[i] ?? [])]);
      for (let i = columnas.length; i < viejas.length; i++) celdas[columnas.length - 1].push(...viejas[i]);
      fila.columnas = [...columnas];
      fila.celdas = celdas;
    });
  }
  function editarFila(f: number, p: Partial<Fila>) {
    cambiar((n) => void Object.assign(n.filas[f], p));
  }
  function moverFila(f: number, d: -1 | 1) {
    if (f + d < 0 || f + d >= c.filas.length) return;
    cambiar((n) => {
      const [x] = n.filas.splice(f, 1);
      n.filas.splice(f + d, 0, x);
    });
  }
  function copiarFila(f: number) {
    cambiar((n) => void n.filas.splice(f + 1, 0, duplicarFila(n.filas[f])));
  }
  function borrarFila(f: number) {
    cambiar((n) => void n.filas.splice(f, 1));
    setSel(null);
    setCeldaActiva(null);
  }

  // --- Elementos ---
  function insertar(e: Elemento, fila: number, celda: number, antesDe?: string) {
    cambiar((n) => {
      const lista = n.filas[fila]?.celdas[celda];
      if (!lista) return;
      const i = antesDe ? lista.findIndex((x) => x.id === antesDe) : -1;
      lista.splice(i >= 0 ? i : lista.length, 0, e);
    });
    setSel({ fila, celda, el: e.id });
    setCeldaActiva({ fila, celda });
  }
  /** Pulsar un elemento de la paleta lo añade a la columna elegida (o a una fila nueva si no hay ninguna). */
  function anadirDesdePaleta(tipo: TipoElemento) {
    const e = elementoNuevo(tipo);
    if (!c.filas.length || !celdaActiva || !c.filas[celdaActiva.fila]) {
      const pos = c.filas.length;
      cambiar((n) => {
        const f = filaNueva([12]);
        f.celdas[0].push(e);
        n.filas.push(f);
      });
      setSel({ fila: pos, celda: 0, el: e.id });
      setCeldaActiva({ fila: pos, celda: 0 });
      return;
    }
    insertar(e, celdaActiva.fila, Math.min(celdaActiva.celda, c.filas[celdaActiva.fila].celdas.length - 1));
  }
  function soltar(fila: number, celda: number, antesDe?: string) {
    const a = arrastre;
    setArrastre(null);
    setDestino(null);
    if (!a) return;
    if ("nuevo" in a) return insertar(elementoNuevo(a.nuevo), fila, celda, antesDe);
    if (a.mover === antesDe) return;
    cambiar((n) => {
      const u = ubicar(n, a.mover);
      if (!u) return;
      const [e] = n.filas[u.fila].celdas[u.celda].splice(u.i, 1);
      const lista = n.filas[fila].celdas[celda];
      const i = antesDe ? lista.findIndex((x) => x.id === antesDe) : -1;
      lista.splice(i >= 0 ? i : lista.length, 0, e);
    });
    setSel({ fila, celda, el: a.mover });
  }
  /** Cambia el elemento elegido: `fn` recibe la copia de trabajo y la modifica. */
  function editarCon(fn: (e: Elemento) => void) {
    if (!sel) return;
    cambiar((n) => {
      const u = ubicar(n, sel.el);
      if (u) fn(n.filas[u.fila].celdas[u.celda][u.i]);
    });
  }
  const editar = (p: Partial<Elemento> | Record<string, unknown>) => editarCon((e) => void Object.assign(e, p));
  function moverElemento(d: -1 | 1) {
    if (!sel) return;
    cambiar((n) => {
      const u = ubicar(n, sel.el);
      if (!u) return;
      const lista = n.filas[u.fila].celdas[u.celda];
      if (u.i + d < 0 || u.i + d >= lista.length) return;
      const [x] = lista.splice(u.i, 1);
      lista.splice(u.i + d, 0, x);
    });
  }
  function copiarElemento() {
    if (!sel) return;
    const u = ubicar(c, sel.el);
    if (!u) return;
    const nuevo = duplicarElemento(c.filas[u.fila].celdas[u.celda][u.i]);
    cambiar((n) => void n.filas[u.fila].celdas[u.celda].splice(u.i + 1, 0, nuevo));
    setSel({ fila: u.fila, celda: u.celda, el: nuevo.id });
  }
  function borrarElemento() {
    if (!sel) return;
    cambiar((n) => {
      const u = ubicar(n, sel.el);
      if (u) n.filas[u.fila].celdas[u.celda].splice(u.i, 1);
    });
    setSel(null);
  }

  // Teclado: Supr borra el elemento elegido; Cmd/Ctrl+Z deshace; Cmd/Ctrl+D duplica.
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input,textarea,select,[contenteditable]")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) rehacer();
        else deshacer();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d" && sel) {
        e.preventDefault();
        copiarElemento();
      } else if ((e.key === "Delete" || e.key === "Backspace") && sel) {
        e.preventDefault();
        borrarElemento();
      } else if (e.key === "Escape") setSel(null);
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  });

  // --- Guardar y publicar ---
  function guardar(despues?: () => Promise<unknown>) {
    setMsg(null);
    start(async () => {
      const limpio = rutaPagina(slug);
      const r = await guardarPagina(pagina.id, { titulo, slug: limpio, descripcion, contenido: c });
      if (!r.ok) return setMsg({ ok: false, t: r.error });
      setSlug(limpio);
      setSlugGuardado(limpio);
      setSucio(false);
      if (despues) await despues();
      setMsg({ ok: true, t: "Cambios guardados." });
      router.refresh();
    });
  }
  function alternarPublicada() {
    guardar(async () => {
      const r = await publicarPagina(pagina.id, !publicada);
      if (r.ok) setPublicada(!publicada);
    });
  }
  function borrar() {
    if (!window.confirm(`¿Borrar la página «${titulo}»? No se puede deshacer.`)) return;
    start(async () => {
      await borrarPagina(pagina.id);
      setSucio(false);
      router.push("/panel/paginas");
    });
  }

  const zonaSoltar = (fila: number, celda: number, antesDe?: string) => ({
    onDragOver: (e: DragEvent) => {
      if (!arrastre) return;
      e.preventDefault();
      e.stopPropagation();
      setDestino(`${fila}:${celda}:${antesDe ?? "fin"}`);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      soltar(fila, celda, antesDe);
    },
  });

  const q = buscar.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const paleta = q
    ? PALETA.map((g) => ({ ...g, items: g.items.filter((i) => i.etiqueta.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q)) })).filter((g) => g.items.length)
    : PALETA;

  const boton = "inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-semibold transition hover:border-[var(--accent)] disabled:opacity-40";

  return (
    <div className="flex flex-col gap-4">
      {/* Migas y datos de la página */}
      <nav className="text-sm text-[var(--fg-muted)]">
        <Link href="/panel/paginas" className="hover:text-[var(--accent)]">Páginas</Link> › <span className="text-[var(--fg)]">{titulo || "Sin título"}</span>
      </nav>
      <div className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-[1fr_1fr_auto]">
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Título de la página
          <input value={titulo} onChange={(e) => { setTitulo(e.target.value); setSucio(true); }} className="lx-input !py-2 !text-base !font-semibold" maxLength={160} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Dirección (sección/página)
          <span className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg)] pl-3 font-mono text-sm">
            /<input value={slug} onChange={(e) => { setSlug(e.target.value.toLowerCase()); setSucio(true); }} onBlur={() => setSlug(rutaPagina(slug))} className="min-w-0 flex-1 bg-transparent py-2 pr-3 outline-none" maxLength={161} />
          </span>
        </label>
        <div className="flex items-end gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${publicada ? "bg-[#16a34a]/15 text-[#15803d]" : "bg-[#f2a900]/20 text-[#8a6200]"}`}>{publicada ? "Publicada" : "Borrador"}</span>
          {publicada && (
            <a href={`/${slugGuardado}`} target="_blank" rel="noreferrer" className={boton}>
              <ExternalLink size={14} /> Ver
            </a>
          )}
        </div>
        <label className="flex flex-col gap-1 text-xs font-semibold md:col-span-3">
          Descripción (sale bajo el título y en buscadores)
          <input value={descripcion} onChange={(e) => { setDescripcion(e.target.value); setSucio(true); }} className="lx-input !py-2 !text-sm" maxLength={400} placeholder="Opcional" />
        </label>
      </div>

      {/* Barra de acciones */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 p-2 backdrop-blur">
        <button type="button" onClick={deshacer} disabled={!hist.pasado.length} className={boton}><Undo2 size={14} /> Deshacer</button>
        <button type="button" onClick={rehacer} disabled={!hist.futuro.length} className={boton}><Redo2 size={14} /> Rehacer</button>
        <div className="mx-1 flex overflow-hidden rounded-lg border border-[var(--border)]">
          <button type="button" onClick={() => setVista(false)} aria-pressed={!vista} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${!vista ? "bg-[var(--accent)] text-[var(--accent-fg)]" : ""}`}><Pencil size={14} /> Armar</button>
          <button type="button" onClick={() => { setVista(true); setSel(null); }} aria-pressed={vista} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${vista ? "bg-[var(--accent)] text-[var(--accent-fg)]" : ""}`}><Eye size={14} /> Vista previa</button>
        </div>
        <span className="flex-1" />
        {msg && <span className={`text-sm ${msg.ok ? "text-[#15803d]" : "text-[#b91c1c]"}`}>{msg.t}</span>}
        {sucio && !msg && <span className="text-xs text-[var(--fg-muted)]">Cambios sin guardar</span>}
        <button type="button" onClick={() => guardar()} disabled={ocupado} className={boton}>
          {ocupado ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
        </button>
        <button type="button" onClick={alternarPublicada} disabled={ocupado} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm font-bold text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-50">
          {publicada ? <><EyeOff size={14} /> Ocultar del sitio</> : <><Eye size={14} /> Publicar</>}
        </button>
        <button type="button" onClick={borrar} disabled={ocupado} aria-label="Borrar página" title="Borrar página" className="grid size-8 place-items-center rounded-lg text-[#b91c1c] hover:bg-[#b91c1c]/10"><Trash2 size={16} /></button>
      </div>

      <div className={`grid gap-4 ${vista ? "" : elegido ? "lg:grid-cols-[14rem_minmax(0,1fr)_20rem]" : "lg:grid-cols-[14rem_minmax(0,1fr)]"}`}>
        {/* Paleta */}
        {!vista && (
          <aside className="flex max-h-[calc(100dvh-6rem)] flex-col gap-3 self-start overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 lg:sticky lg:top-16">
            <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-[var(--border)] text-xs font-bold">
              <button type="button" onClick={() => setPestanaPaleta("elementos")} aria-pressed={pestanaPaleta === "elementos"} className={`py-1.5 ${pestanaPaleta === "elementos" ? "bg-[var(--accent)] text-[var(--accent-fg)]" : ""}`}>Elementos</button>
              <button type="button" onClick={() => setPestanaPaleta("plantillas")} aria-pressed={pestanaPaleta === "plantillas"} className={`inline-flex items-center justify-center gap-1 py-1.5 ${pestanaPaleta === "plantillas" ? "bg-[var(--accent)] text-[var(--accent-fg)]" : ""}`}><LayoutTemplate size={13} /> Plantillas</button>
            </div>
            {pestanaPaleta === "elementos" ? (
              <>
                <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5">
                  <Search size={14} className="shrink-0 text-[var(--fg-muted)]" />
                  <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar elemento…" className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none" aria-label="Buscar elemento" />
                </label>
                <p className="text-[11px] leading-snug text-[var(--fg-muted)]">Arrástrelos a una columna o púlselos para añadirlos a la columna elegida.</p>
                {paleta.map((g) => (
                  <div key={g.grupo}>
                    <p className="mb-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--fg-muted)]">{g.grupo}</p>
                    <div className="grid grid-cols-3 gap-1">
                      {g.items.map((it) => (
                        <button
                          key={it.tipo}
                          type="button"
                          draggable
                          title={it.etiqueta}
                          onDragStart={(e) => { e.dataTransfer.setData("text/plain", it.tipo); e.dataTransfer.effectAllowed = "copy"; setArrastre({ nuevo: it.tipo }); }}
                          onDragEnd={() => { setArrastre(null); setDestino(null); }}
                          onClick={() => anadirDesdePaleta(it.tipo)}
                          className="flex cursor-grab flex-col items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-0.5 py-1.5 text-center text-[0.64rem] font-semibold leading-tight transition hover:border-[var(--accent)] hover:text-[var(--accent)] active:cursor-grabbing"
                        >
                          {ICONOS[it.tipo]}
                          {it.etiqueta}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {!paleta.length && <p className="text-xs text-[var(--fg-muted)]">Nada con «{buscar}».</p>}
              </>
            ) : (
              <>
                <p className="text-[11px] leading-snug text-[var(--fg-muted)]">Filas ya armadas: se añaden debajo de la fila elegida y luego se cambian como cualquier otra.</p>
                <div className="flex flex-col gap-1.5">
                  {PLANTILLAS.map((t) => (
                    <button key={t.id} type="button" onClick={() => anadirPlantilla(t.crear)} className="flex flex-col items-start rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-left transition hover:border-[var(--accent)]">
                      <span className="text-[0.78rem] font-bold">{t.etiqueta}</span>
                      <span className="text-[0.68rem] leading-snug text-[var(--fg-muted)]">{t.descripcion}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </aside>
        )}

        {/* Lienzo */}
        <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 sm:p-6" onClick={() => !vista && setSel(null)}>
          <h1 className="lx-display mb-2 text-4xl leading-tight tracking-tight">{titulo || "Sin título"}</h1>
          {descripcion && <p className="mb-6 text-lg text-[var(--fg-muted)]">{descripcion}</p>}
          <div className="flex flex-col gap-6">
            {c.filas.map((f, fi) => (
              <FilaLienzo
                key={f.id}
                fila={f}
                indice={fi}
                total={c.filas.length}
                vista={vista}
                onDivision={(cols) => cambiarDivision(fi, cols)}
                onEditar={(p) => editarFila(fi, p)}
                onElegirFondo={() => setElegirImagen(() => (url: string) => editarFila(fi, { fondo: "imagen", fondoImagen: url }))}
                onMover={(d) => moverFila(fi, d)}
                onCopiar={() => copiarFila(fi)}
                onBorrar={() => borrarFila(fi)}
              >
                {f.columnas.map((n, ci) => {
                  const activa = !vista && celdaActiva?.fila === fi && celdaActiva.celda === ci;
                  return (
                    <div
                      key={ci}
                      {...(vista ? {} : zonaSoltar(fi, ci))}
                      onClick={(e) => { if (vista) return; e.stopPropagation(); setCeldaActiva({ fila: fi, celda: ci }); setSel(null); }}
                      className={`${claseColumna(n)} @container flex min-h-24 min-w-0 flex-col gap-4 ${vista ? "" : `rounded-lg border-2 border-dashed p-3 transition ${destino === `${fi}:${ci}:fin` ? "border-[var(--accent)] bg-[var(--accent)]/5" : activa ? "border-[var(--accent)]/60" : "border-[var(--border)]"}`}`}
                    >
                      {f.celdas[ci].map((e) =>
                        vista ? (
                          <ElementoVista key={e.id} e={e} enEditor />
                        ) : (
                          <div key={e.id} {...zonaSoltar(fi, ci, e.id)} className="relative">
                            {destino === `${fi}:${ci}:${e.id}` && <div className="absolute -top-2.5 left-0 right-0 h-1 rounded bg-[var(--accent)]" />}
                            <div
                              draggable
                              onDragStart={(ev) => { ev.stopPropagation(); ev.dataTransfer.setData("text/plain", e.id); ev.dataTransfer.effectAllowed = "move"; setArrastre({ mover: e.id }); }}
                              onDragEnd={() => { setArrastre(null); setDestino(null); }}
                              onClickCapture={(ev) => {
                                // En el lienzo, un clic elige el elemento (no navega ni abre nada dentro de él).
                                const dentro = (ev.target as HTMLElement).closest("a");
                                if (dentro) ev.preventDefault();
                              }}
                              onClick={(ev) => { ev.stopPropagation(); setSel({ fila: fi, celda: ci, el: e.id }); setCeldaActiva({ fila: fi, celda: ci }); }}
                              className={`group relative cursor-pointer rounded-md p-1 outline-2 outline-offset-2 transition ${sel?.el === e.id ? "outline outline-[var(--accent)]" : "hover:outline hover:outline-[var(--border-strong)]"}`}
                            >
                              <span className={`absolute -left-1 -top-3 z-10 items-center gap-1 rounded bg-[var(--accent)] px-1.5 py-0.5 text-[0.65rem] font-bold text-[var(--accent-fg)] ${sel?.el === e.id ? "flex" : "hidden group-hover:flex"}`}>
                                <GripVertical size={11} /> {NOMBRE[e.tipo]}
                              </span>
                              <ElementoVista e={e} enEditor />
                            </div>
                          </div>
                        ),
                      )}
                      {!vista && !f.celdas[ci].length && (
                        <p className="m-auto text-center text-xs text-[var(--fg-muted)]">Arrastre aquí un elemento</p>
                      )}
                    </div>
                  );
                })}
              </FilaLienzo>
            ))}
          </div>

          {/* Añadir fila */}
          {!vista && (
            <div className="mt-6" onClick={(e) => e.stopPropagation()}>
              {divisionNueva || !c.filas.length ? (
                <div className="rounded-xl border-2 border-dashed border-[var(--border-strong)] p-4">
                  <p className="mb-3 text-center text-sm font-semibold">{c.filas.length ? "¿Cómo se divide la nueva fila?" : "La página está en blanco: elija cómo se divide la primera fila o empiece con una plantilla"}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
                    {DIVISIONES.map((d) => (
                      <button key={d.id} type="button" onClick={() => anadirFila(d.columnas)} className="flex flex-col gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-[0.7rem] font-semibold transition hover:border-[var(--accent)]">
                        <MiniDivision columnas={d.columnas} />
                        {d.etiqueta}
                      </button>
                    ))}
                  </div>
                  <p className="mb-2 mt-4 text-center text-xs font-bold uppercase tracking-[0.12em] text-[var(--fg-muted)]">O una fila ya armada</p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {PLANTILLAS.map((t) => (
                      <button key={t.id} type="button" onClick={() => anadirPlantilla(t.crear)} className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]">
                        {t.etiqueta}
                      </button>
                    ))}
                  </div>
                  {c.filas.length > 0 && (
                    <button type="button" onClick={() => setDivisionNueva(false)} className="mx-auto mt-3 block text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]">Cancelar</button>
                  )}
                </div>
              ) : (
                <button type="button" onClick={() => setDivisionNueva(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--border-strong)] py-4 text-sm font-semibold text-[var(--fg-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]">
                  <Rows3 size={16} /> Añadir fila
                </button>
              )}
            </div>
          )}
        </div>

        {/* Propiedades: solo aparece con un elemento elegido. */}
        {!vista && elegido && (
          <aside className="flex max-h-[calc(100dvh-6rem)] flex-col self-start overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:sticky lg:top-16">
            <Propiedades
              key={elegido.id}
              e={elegido}
              secciones={secciones}
              onCambiar={editar}
              onCambiarCon={editarCon}
              onMover={moverElemento}
              onCopiar={copiarElemento}
              onBorrar={borrarElemento}
              onCerrar={() => setSel(null)}
              onElegirImagen={(cb) => setElegirImagen(() => cb)}
            />
          </aside>
        )}
      </div>

      {elegirImagen && (
        <SelectorBiblioteca
          onCerrar={() => setElegirImagen(null)}
          onElegir={(a) => {
            elegirImagen(a.url, a.name.replace(/\.[a-z0-9]+$/i, ""));
            setElegirImagen(null);
          }}
        />
      )}
    </div>
  );
}

/** Dibujo pequeño de cómo queda dividida una fila. */
function MiniDivision({ columnas }: { columnas: number[] }) {
  return (
    <span className="grid h-6 grid-cols-12 gap-0.5">
      {columnas.map((n, i) => (
        <span key={i} className="rounded-sm bg-[var(--accent)]/70" style={{ gridColumn: `span ${n} / span ${n}` }} />
      ))}
    </span>
  );
}

/** Una fila del lienzo con su barra de controles. */
function FilaLienzo({
  fila, indice, total, vista, children, onDivision, onEditar, onElegirFondo, onMover, onCopiar, onBorrar,
}: {
  fila: Fila; indice: number; total: number; vista: boolean; children: ReactNode;
  onDivision: (c: number[]) => void; onEditar: (p: Partial<Fila>) => void; onElegirFondo: () => void; onMover: (d: -1 | 1) => void; onCopiar: () => void; onBorrar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const actual = DIVISIONES.find((d) => d.columnas.join() === fila.columnas.join());
  if (vista) return <section className={claseFila(fila)} style={estiloFila(fila)}>{children}</section>;
  const btn = "grid size-7 place-items-center rounded-md hover:bg-[var(--surface-2)] disabled:opacity-30";
  const sel = "rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 font-semibold";
  return (
    <div className="group/fila rounded-xl border border-transparent p-1 transition hover:border-[var(--border)]" onClick={(e) => e.stopPropagation()}>
      <div className="mb-1 flex flex-wrap items-center gap-1 text-xs">
        <span className="mr-1 font-bold text-[var(--fg-muted)]">Fila {indice + 1}</span>
        <div className="relative">
          <button type="button" onClick={() => setAbierto((v) => !v)} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 font-semibold hover:border-[var(--accent)]">
            <span className="w-10"><MiniDivision columnas={fila.columnas} /></span>
            {actual?.etiqueta ?? "Columnas"} <ChevronDown size={12} />
          </button>
          {abierto && (
            <div className="absolute left-0 top-full z-20 mt-1 grid w-80 grid-cols-2 gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 shadow-lg">
              {DIVISIONES.map((d) => (
                <button key={d.id} type="button" onClick={() => { onDivision(d.columnas); setAbierto(false); }} className={`flex flex-col gap-1 rounded-md border p-1.5 text-[0.68rem] font-semibold ${d.id === actual?.id ? "border-[var(--accent)]" : "border-[var(--border)] hover:border-[var(--accent)]"}`}>
                  <MiniDivision columnas={d.columnas} />
                  {d.etiqueta}
                </button>
              ))}
            </div>
          )}
        </div>
        <select value={fila.fondo ?? "ninguno"} onChange={(e) => (e.target.value === "imagen" && !fila.fondoImagen ? onElegirFondo() : onEditar({ fondo: e.target.value as Fila["fondo"] }))} aria-label="Fondo de la fila" className={sel}>
          <option value="ninguno">Sin fondo</option>
          <option value="suave">Fondo suave</option>
          <option value="acento">Fondo de color</option>
          <option value="oscuro">Fondo oscuro</option>
          <option value="degradado">Degradado verde</option>
          <option value="imagen">Imagen de fondo…</option>
        </select>
        {fila.fondo === "imagen" && (
          <button type="button" onClick={onElegirFondo} className={`${sel} inline-flex items-center gap-1`}><ImageIcon size={12} /> Cambiar imagen</button>
        )}
        <select value={fila.espaciado ?? "normal"} onChange={(e) => onEditar({ espaciado: e.target.value as Fila["espaciado"] })} aria-label="Espacio de la fila" className={sel}>
          <option value="compacto">Compacta</option>
          <option value="normal">Espacio normal</option>
          <option value="amplio">Amplia</option>
        </select>
        <select value={fila.vertical ?? "arriba"} onChange={(e) => onEditar({ vertical: e.target.value as Fila["vertical"] })} aria-label="Alineación vertical" className={sel}>
          <option value="arriba">Arriba</option>
          <option value="centro">Centrado</option>
        </select>
        <span className="flex-1" />
        <button type="button" onClick={() => onMover(-1)} disabled={indice === 0} aria-label="Subir fila" title="Subir fila" className={btn}><ArrowUp size={14} /></button>
        <button type="button" onClick={() => onMover(1)} disabled={indice === total - 1} aria-label="Bajar fila" title="Bajar fila" className={btn}><ArrowDown size={14} /></button>
        <button type="button" onClick={onCopiar} aria-label="Duplicar fila" title="Duplicar fila" className={btn}><Copy size={14} /></button>
        <button type="button" onClick={() => window.confirm("¿Quitar esta fila y lo que tiene?") && onBorrar()} aria-label="Quitar fila" title="Quitar fila" className={`${btn} text-[#b91c1c]`}><Trash2 size={14} /></button>
      </div>
      <section className={claseFila(fila)} style={estiloFila(fila)}>{children}</section>
    </div>
  );
}

const CAMPO = "lx-input !py-1.5 !text-sm";
const ETIQUETA = "flex flex-col gap-1 text-xs font-semibold";

/** Un campo de un bloque, según su tipo en el esquema. */
function CampoBloque({ c, valor, onCambiar, onElegirImagen }: { c: Campo; valor: string; onCambiar: (v: string) => void; onElegirImagen: (cb: (url: string, nombre: string) => void) => void }) {
  const ayuda = c.ayuda ? <span className="text-[10px] font-normal text-[var(--fg-muted)]">{c.ayuda}</span> : null;
  switch (c.tipo) {
    case "area":
      return <label className={ETIQUETA}>{c.etiqueta}<textarea value={valor} onChange={(v) => onCambiar(v.target.value)} rows={c.k === "datos" ? 7 : 3} className={`${CAMPO} resize-y ${c.k === "datos" ? "font-mono !text-xs" : ""}`} />{ayuda}</label>;
    case "imagen":
      return (
        <div className={ETIQUETA}>
          {c.etiqueta}
          <div className="flex items-center gap-2">
            {valor ? (
              // eslint-disable-next-line @next/next/no-img-element -- miniatura en el panel
              <img src={valor} alt="" className="size-12 shrink-0 rounded-md border border-[var(--border)] object-cover" />
            ) : (
              <span className="grid size-12 shrink-0 place-items-center rounded-md border border-dashed border-[var(--border-strong)] text-[var(--fg-muted)]"><ImageIcon size={16} /></span>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <button type="button" onClick={() => onElegirImagen((url) => onCambiar(url))} className="rounded-md bg-[var(--accent)] px-2 py-1 text-xs font-semibold text-[var(--accent-fg)]">{valor ? "Cambiar" : "Biblioteca"}</button>
              <input value={valor} onChange={(v) => onCambiar(v.target.value)} placeholder="o pegue https://…" className={`${CAMPO} !py-1 !text-xs`} />
            </div>
            {valor && <button type="button" onClick={() => onCambiar("")} aria-label="Quitar imagen" className="grid size-6 place-items-center rounded text-[#b91c1c] hover:bg-[#b91c1c]/10"><X size={13} /></button>}
          </div>
        </div>
      );
    case "numero":
      return <label className={ETIQUETA}>{c.etiqueta}: {valor}<input type="range" min={c.min} max={c.max} step={c.paso ?? 1} value={Number(valor) || c.min} onChange={(v) => onCambiar(v.target.value)} className="accent-[var(--accent)]" />{ayuda}</label>;
    case "opcion":
      if (c.opciones.length <= 3 && c.opciones.every(([, l]) => l.length <= 12))
        return (
          <div className={ETIQUETA}>
            {c.etiqueta}
            <div className="flex gap-1">
              {c.opciones.map(([k, l]) => (
                <button key={k} type="button" aria-pressed={valor === k} onClick={() => onCambiar(k)} className={`flex-1 rounded-md border py-1.5 text-xs font-semibold ${valor === k ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--border)]"}`}>{l}</button>
              ))}
            </div>
          </div>
        );
      return (
        <label className={ETIQUETA}>
          {c.etiqueta}
          <select value={valor} onChange={(v) => onCambiar(v.target.value)} className={CAMPO}>
            {c.opciones.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      );
    case "fecha":
      return <label className={ETIQUETA}>{c.etiqueta}<input type="datetime-local" value={valor} onChange={(v) => onCambiar(v.target.value)} className={CAMPO} /><span className="text-[10px] font-normal text-[var(--fg-muted)]">Hora de Colombia</span></label>;
    case "url":
      return <label className={ETIQUETA}>{c.etiqueta}<input value={valor} onChange={(v) => onCambiar(v.target.value)} placeholder="/seccion o https://…" className={CAMPO} />{ayuda}</label>;
    default:
      return <label className={ETIQUETA}>{c.etiqueta}<input value={valor} onChange={(v) => onCambiar(v.target.value)} className={CAMPO} />{ayuda}</label>;
  }
}

/** Propiedades de un bloque: sus campos y su lista de elementos (tarjetas, diapositivas, preguntas…). */
function PropiedadesBloque({ e, onCambiarCon, onElegirImagen }: { e: ElementoBloque; onCambiarCon: (fn: (e: Elemento) => void) => void; onElegirImagen: (cb: (url: string, nombre: string) => void) => void }) {
  const s = ESQUEMAS[e.tipo];
  const [abierto, setAbierto] = useState<string | null>(e.items[0]?._id ?? null);
  const conBloque = (fn: (b: ElementoBloque) => void) => onCambiarCon((x) => { if (esBloque(x)) fn(x); });
  const moverItem = (i: number, d: -1 | 1) => conBloque((b) => { if (i + d < 0 || i + d >= b.items.length) return; const [x] = b.items.splice(i, 1); b.items.splice(i + d, 0, x); });
  const resumen = (it: Valores, i: number) => it.titulo || it.nombre || it.etiqueta || it.texto?.slice(0, 40) || it.red || it.valor || `${s.items?.nombre} ${i + 1}`;
  return (
    <>
      {s.campos.map((c) => (
        <CampoBloque key={c.k} c={c} valor={e.p[c.k] ?? ""} onCambiar={(v) => conBloque((b) => void (b.p[c.k] = v))} onElegirImagen={onElegirImagen} />
      ))}
      {s.items && (
        <div className="flex flex-col gap-1.5 border-t border-[var(--border)] pt-3">
          <p className="text-xs font-bold">{s.items.nombre}s ({e.items.length})</p>
          {e.items.map((it, i) => {
            const abiertoEste = abierto === it._id;
            return (
              <div key={it._id} className={`rounded-lg border ${abiertoEste ? "border-[var(--accent)]" : "border-[var(--border)]"}`}>
                <div className="flex items-center gap-1 px-2 py-1.5">
                  <button type="button" onClick={() => setAbierto(abiertoEste ? null : it._id)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs font-semibold">
                    <ChevronDown size={13} className={`shrink-0 transition ${abiertoEste ? "" : "-rotate-90"}`} />
                    <span className="truncate">{resumen(it, i)}</span>
                  </button>
                  <button type="button" onClick={() => moverItem(i, -1)} disabled={i === 0} aria-label="Subir" className="grid size-6 place-items-center rounded hover:bg-[var(--surface-2)] disabled:opacity-30"><ArrowUp size={12} /></button>
                  <button type="button" onClick={() => moverItem(i, 1)} disabled={i === e.items.length - 1} aria-label="Bajar" className="grid size-6 place-items-center rounded hover:bg-[var(--surface-2)] disabled:opacity-30"><ArrowDown size={12} /></button>
                  <button type="button" onClick={() => conBloque((b) => void b.items.splice(i + 1, 0, { ...b.items[i], _id: nuevoId() }))} disabled={e.items.length >= s.items!.max} aria-label="Duplicar" className="grid size-6 place-items-center rounded hover:bg-[var(--surface-2)] disabled:opacity-30"><Copy size={12} /></button>
                  <button type="button" onClick={() => conBloque((b) => void b.items.splice(i, 1))} aria-label="Quitar" className="grid size-6 place-items-center rounded text-[#b91c1c] hover:bg-[#b91c1c]/10"><Trash2 size={12} /></button>
                </div>
                {abiertoEste && (
                  <div className="flex flex-col gap-2.5 border-t border-[var(--border)] p-2.5">
                    {s.items!.campos.map((c) => (
                      <CampoBloque key={c.k} c={c} valor={it[c.k] ?? ""} onCambiar={(v) => conBloque((b) => { const x = b.items.find((y) => y._id === it._id); if (x) x[c.k] = v; })} onElegirImagen={onElegirImagen} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <button
            type="button"
            disabled={e.items.length >= s.items.max}
            onClick={() => {
              const nuevo = { ...s.items!.nuevo, _id: nuevoId() };
              conBloque((b) => void b.items.push(nuevo));
              setAbierto(nuevo._id);
            }}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border-strong)] py-1.5 text-xs font-semibold hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40"
          >
            <Plus size={13} /> Añadir {s.items.nombre.toLowerCase()}
          </button>
        </div>
      )}
    </>
  );
}

/** Lo que se puede cambiar del elemento elegido. */
function Propiedades({
  e, secciones, onCambiar, onCambiarCon, onMover, onCopiar, onBorrar, onCerrar, onElegirImagen,
}: {
  e: Elemento; secciones: { slug: string; name: string }[];
  onCambiar: (p: Record<string, unknown>) => void; onCambiarCon: (fn: (e: Elemento) => void) => void;
  onMover: (d: -1 | 1) => void; onCopiar: () => void; onBorrar: () => void; onCerrar: () => void;
  onElegirImagen: (cb: (url: string, nombre: string) => void) => void;
}) {
  const set = onCambiar;
  const campo = CAMPO;
  const etiqueta = ETIQUETA;
  const opciones = (k: string, valor: string, ops: [string, string][]) => (
    <div className="flex gap-1">
      {ops.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={valor === v} onClick={() => set({ [k]: v })} className={`flex-1 rounded-md border py-1.5 text-xs font-semibold ${valor === v ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--border)]"}`}>{l}</button>
      ))}
    </div>
  );
  const alinearCtl = (valor: Alinear | undefined) => (
    <div className={etiqueta}>
      Alineación
      <div className="flex gap-1">
        {(
          [
            ["izquierda", <AlignLeft key="i" size={15} />],
            ["centro", <AlignCenter key="c" size={15} />],
            ["derecha", <AlignRight key="d" size={15} />],
          ] as const
        ).map(([a, icono]) => (
          <button key={a} type="button" aria-label={a} aria-pressed={(valor ?? "izquierda") === a} onClick={() => set({ alinear: a })} className={`grid h-8 flex-1 place-items-center rounded-md border ${(valor ?? "izquierda") === a ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--border)]"}`}>
            {icono}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-bold">{ICONOS[e.tipo]} {NOMBRE[e.tipo]}</p>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid size-7 place-items-center rounded-md hover:bg-[var(--surface-2)]"><X size={15} /></button>
      </div>

      {esBloque(e) && <PropiedadesBloque e={e} onCambiarCon={onCambiarCon} onElegirImagen={onElegirImagen} />}

      {e.tipo === "titulo" && (
        <>
          <label className={etiqueta}>Antetítulo (opcional)<input value={e.antetitulo ?? ""} onChange={(v) => set({ antetitulo: v.target.value })} className={campo} /></label>
          <label className={etiqueta}>Texto<input value={e.texto} onChange={(v) => set({ texto: v.target.value })} className={campo} /></label>
          <div className={etiqueta}>
            Tamaño
            <div className="flex gap-1">
              {([2, 3] as const).map((n) => (
                <button key={n} type="button" onClick={() => set({ nivel: n })} className={`flex-1 rounded-md border py-1.5 text-sm font-semibold ${e.nivel === n ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--border)]"}`}>{n === 2 ? "Grande" : "Mediano"}</button>
              ))}
            </div>
          </div>
          {alinearCtl(e.alinear)}
        </>
      )}
      {e.tipo === "parrafo" && (
        <>
          <label className={etiqueta}>Texto<textarea value={e.texto} onChange={(v) => set({ texto: v.target.value })} rows={8} className={`${campo} resize-y`} /></label>
          {alinearCtl(e.alinear)}
        </>
      )}
      {e.tipo === "lista" && (
        <>
          <label className={etiqueta}>Puntos (uno por línea)<textarea value={e.items.join("\n")} onChange={(v) => set({ items: v.target.value.split("\n") })} rows={6} className={`${campo} resize-y`} /></label>
          <div className={etiqueta}>Tipo{opciones("numerada", e.numerada ? "si" : "no", [["no", "Viñetas"], ["si", "Numerada"]])}</div>
        </>
      )}
      {e.tipo === "cita" && (
        <>
          <label className={etiqueta}>Frase<textarea value={e.texto} onChange={(v) => set({ texto: v.target.value })} rows={4} className={`${campo} resize-y`} /></label>
          <label className={etiqueta}>Autor<input value={e.autor ?? ""} onChange={(v) => set({ autor: v.target.value })} className={campo} /></label>
        </>
      )}
      {e.tipo === "aviso" && (
        <>
          <label className={etiqueta}>Texto<textarea value={e.texto} onChange={(v) => set({ texto: v.target.value })} rows={4} className={`${campo} resize-y`} /></label>
          <div className={etiqueta}>Tono{opciones("tono", e.tono ?? "info", [["info", "Información"], ["exito", "Éxito"], ["alerta", "Alerta"]])}</div>
        </>
      )}
      {e.tipo === "imagen" && (
        <>
          <button type="button" onClick={() => onElegirImagen((url, nombre) => set({ url, alt: e.alt || nombre }))} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-fg)]"><ImageIcon size={15} /> {e.url ? "Cambiar imagen" : "Elegir de la biblioteca"}</button>
          <label className={etiqueta}>O pegue la dirección de la imagen<input value={e.url} onChange={(v) => set({ url: v.target.value })} className={campo} placeholder="https://…" /></label>
          <label className={etiqueta}>Texto alternativo (para lectores de pantalla)<input value={e.alt} onChange={(v) => set({ alt: v.target.value })} className={campo} /></label>
          <label className={etiqueta}>Pie de foto<input value={e.pie ?? ""} onChange={(v) => set({ pie: v.target.value })} className={campo} /></label>
          <label className={etiqueta}>Al pulsarla, ir a (opcional)<input value={e.url_enlace ?? ""} onChange={(v) => set({ url_enlace: v.target.value })} className={campo} placeholder="/seccion o https://…" /></label>
          <div className={etiqueta}>Esquinas{opciones("redondeo", e.redondeo ?? "si", [["no", "Rectas"], ["si", "Redondeadas"], ["circulo", "Círculo"]])}</div>
        </>
      )}
      {e.tipo === "video" && <label className={etiqueta}>Enlace de YouTube o Vimeo<input value={e.url} onChange={(v) => set({ url: v.target.value })} className={campo} placeholder="https://www.youtube.com/watch?v=…" /></label>}
      {e.tipo === "boton" && (
        <>
          <label className={etiqueta}>Texto<input value={e.texto} onChange={(v) => set({ texto: v.target.value })} className={campo} /></label>
          <label className={etiqueta}>Enlace<input value={e.url} onChange={(v) => set({ url: v.target.value })} className={campo} placeholder="/contacto o https://…" /></label>
          <div className={etiqueta}>Estilo{opciones("estilo", e.estilo ?? "lleno", [["lleno", "Relleno"], ["borde", "Borde"], ["texto", "Solo texto"]])}</div>
          <div className={etiqueta}>Tamaño{opciones("tamano", e.tamano ?? "normal", [["normal", "Normal"], ["grande", "Grande"]])}</div>
          {alinearCtl(e.alinear)}
        </>
      )}
      {e.tipo === "espacio" && (
        <label className={etiqueta}>Alto: {e.alto} px<input type="range" min={8} max={240} step={4} value={e.alto} onChange={(v) => set({ alto: Number(v.target.value) })} className="accent-[var(--accent)]" /></label>
      )}
      {e.tipo === "separador" && <div className={etiqueta}>Estilo{opciones("estilo", e.estilo ?? "linea", [["linea", "Línea"], ["puntos", "Puntos"], ["ornamento", "Rombo"]])}</div>}
      {e.tipo === "notas" && (
        <>
          <label className={etiqueta}>
            Sección
            <select value={e.seccion} onChange={(v) => set({ seccion: v.target.value })} className={campo}>
              <option value="">Elija una sección…</option>
              {secciones.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
            </select>
          </label>
          <label className={etiqueta}>
            Cómo se ven
            <select value={e.estilo ?? "lista"} onChange={(v) => set({ estilo: v.target.value })} className={campo}>
              <option value="lista">Lista con miniatura</option>
              <option value="tarjetas">Tarjetas</option>
              <option value="carrusel">Carrusel</option>
              <option value="portada">Una grande y el resto en lista</option>
            </select>
          </label>
          <label className={etiqueta}>Columnas: {e.columnas ?? 2}<input type="range" min={1} max={4} value={e.columnas ?? 2} onChange={(v) => set({ columnas: Number(v.target.value) })} className="accent-[var(--accent)]" /></label>
          <label className={etiqueta}>Cuántas notas: {e.cantidad}<input type="range" min={1} max={24} value={e.cantidad} onChange={(v) => set({ cantidad: Number(v.target.value) })} className="accent-[var(--accent)]" /></label>
          <p className="text-[11px] text-[var(--fg-muted)]">Salen las más recientes de esa sección y se actualizan solas.</p>
        </>
      )}

      <div className="grid grid-cols-4 gap-1 border-t border-[var(--border)] pt-3">
        <button type="button" onClick={() => onMover(-1)} className="inline-flex items-center justify-center gap-1 rounded-md border border-[var(--border)] py-1.5 text-xs font-semibold hover:border-[var(--accent)]" title="Subir"><ArrowUp size={13} /></button>
        <button type="button" onClick={() => onMover(1)} className="inline-flex items-center justify-center gap-1 rounded-md border border-[var(--border)] py-1.5 text-xs font-semibold hover:border-[var(--accent)]" title="Bajar"><ArrowDown size={13} /></button>
        <button type="button" onClick={onCopiar} className="inline-flex items-center justify-center gap-1 rounded-md border border-[var(--border)] py-1.5 text-xs font-semibold hover:border-[var(--accent)]" title="Duplicar (Ctrl/Cmd + D)"><Copy size={13} /></button>
        <button type="button" onClick={onBorrar} className="inline-flex items-center justify-center gap-1 rounded-md border border-[#b91c1c]/30 py-1.5 text-xs font-semibold text-[#b91c1c] hover:bg-[#b91c1c]/10" title="Quitar (Supr)"><Trash2 size={13} /></button>
      </div>
      <p className="text-[11px] text-[var(--fg-muted)]">También puede arrastrarlo a otra columna o fila.</p>
    </div>
  );
}
