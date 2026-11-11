"use client";

import { useId, useMemo, useState } from "react";
import { Check, ChevronRight, FolderOpen, Search } from "lucide-react";

// Opción de un selector: id y nombre.
type Opcion = { id: string; name: string };

// Normaliza un texto para comparar: sin tildes y en minúsculas.
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Opción con su sección padre.
type Nodo = Opcion & { parentId?: string | null };

// Marca que indica una opción sugerida.
const Sugerida = () => (
  <span className="shrink-0 rounded-full bg-[var(--accent-2)]/18 px-2 py-0.5 text-[0.6875rem] font-semibold text-[var(--accent-2)]">Sugerida</span>
);

/** Círculo de selección: relleno con ✓ si está elegida; en las filas con subsecciones también marca que una subsección suya lo está. */
const Marca = ({ on, fuerte }: { on: boolean; fuerte?: boolean }) => (
  <span
    aria-hidden
    className={`grid size-[1.1rem] shrink-0 place-items-center rounded-full border transition ${
      on ? (fuerte ? "border-white/60 bg-white/25 text-[var(--accent-fg)]" : "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]") : "border-[var(--border-strong,var(--border))]"
    }`}
  >
    {on && <Check size={11} strokeWidth={3} />}
  </span>
);

/** Una subsección que no es una sección del sitio (p. ej. una región o un departamento): `nivel` 1 cuelga de la sección, 2 de la subsección anterior de nivel 1. */
export type ItemExtra = { id: string; nombre: string; nivel: number };

/**
 * Selector de sección en COLUMNAS POR NIVELES (como las carpetas del Finder): a la izquierda las secciones; al abrir una, la columna
 * siguiente muestra SOLO lo que hay dentro de ella, y así hasta el último nivel. Cada columna con contenido empieza con «Toda la sección …»
 * (para elegirla entera). Arriba: la sección elegida con su ruta completa, las sugeridas y un buscador que mira en todos los niveles.
 * En pantallas angostas las columnas se apilan.
 */
export function SectionTree({
  options,
  value,
  onChange,
  sugeridas = [],
  extra,
  children,
}: {
  options: Nodo[];
  /** Sección elegida (id de una sección del sitio). */
  value: string;
  onChange: (id: string) => void;
  sugeridas?: string[];
  /** Subsecciones que no son secciones del sitio (las regiones y departamentos de «Regiones»): se muestran dentro de la sección `categoriaId`; al elegirlas, quien llama decide qué guarda. */
  extra?: { categoriaId: string; items: ItemExtra[]; value: string; onPick: (id: string) => void };
  /** Contenido propio del asistente que va antes de la tarjeta de la sección (p. ej. si la nota va destacada en la portada). */
  children?: React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const idUnico = useId();

  // Árbol unificado: las secciones del sitio y, dentro de la que corresponda, las subsecciones extra.
  const todos = useMemo<(Nodo & { virtual?: boolean })[]>(() => {
    const ids = new Set(options.map((o) => o.id));
    const base = options.map((o) => ({ id: o.id, name: o.name, parentId: o.parentId && ids.has(o.parentId) ? o.parentId : null }));
    if (!extra || !ids.has(extra.categoriaId)) return base;
    let ultimoNivel1 = extra.categoriaId;
    const v = extra.items.map((it) => {
      if (it.nivel === 1) ultimoNivel1 = it.id;
      return { id: it.id, name: it.nombre, parentId: it.nivel === 1 ? extra.categoriaId : ultimoNivel1, virtual: true };
    });
    return [...base, ...v];
  }, [options, extra]);
  const porId = useMemo(() => new Map(todos.map((o) => [o.id, o])), [todos]);
  const hijos = useMemo(() => {
    const m = new Map<string | null, typeof todos>();
    for (const o of todos) m.set(o.parentId ?? null, [...(m.get(o.parentId ?? null) ?? []), o]);
    return m;
  }, [todos]);
  const raices = hijos.get(null) ?? [];

  // Lo elegido: la subsección extra si hay una, y si no, la sección del sitio.
  const elegido = extra?.value || value;
  const actual = porId.get(elegido);
  const cadena = (idNodo: string | undefined): string[] => {
    const salida: string[] = [];
    const vistos = new Set<string>();
    for (let n = idNodo ? porId.get(idNodo) : undefined; n && !vistos.has(n.id); n = n.parentId ? porId.get(n.parentId) : undefined) {
      vistos.add(n.id);
      salida.unshift(n.id);
    }
    return salida;
  };
  const ruta = (idNodo: string) => cadena(idNodo).map((i) => porId.get(i)!.name).join(" › ");
  // Qué nodos tienen contenido y por tanto se abren como columna.
  const abrible = (idNodo: string) => (hijos.get(idNodo)?.length ?? 0) > 0;
  // Camino de columnas abiertas para mostrar un nodo: sus ancestros y, si tiene contenido, él mismo.
  const caminoPara = (idNodo: string | undefined) => cadena(idNodo).filter((i, pos, arr) => abrible(i) && (pos < arr.length - 1 || i === idNodo));
  const [camino, setCamino] = useState<string[]>(() => {
    const inicial = caminoPara(elegido);
    if (inicial.length) return inicial;
    const primera = sugeridas.map((s) => porId.get(s)).find(Boolean);
    const alt = caminoPara(primera?.id);
    return alt.length ? alt : raices.find((r) => abrible(r.id)) ? [raices.find((r) => abrible(r.id))!.id] : [];
  });
  const seleccionados = new Set(cadena(elegido)); // el elegido y todos sus ancestros

  const t = norm(q.trim());
  const coincidencias = t ? todos.filter((o) => norm(o.name).includes(t)).sort((a, b) => Number(sugeridas.includes(b.id)) - Number(sugeridas.includes(a.id))).slice(0, 60) : [];
  const sugs = sugeridas.map((x) => porId.get(x)).filter((x): x is NonNullable<typeof x> => !!x).slice(0, 4);

  const elegir = (n: { id: string; virtual?: boolean }) => {
    if (n.virtual) extra?.onPick(n.id);
    else onChange(elegido === n.id ? "" : n.id);
  };

  /** Una fila elegible (sección completa o subsección sin contenido). */
  const filaElegible = (n: { id: string; name: string; virtual?: boolean }, texto: string, tenue = false) => {
    const activa = elegido === n.id;
    return (
      <button
        type="button"
        aria-pressed={activa}
        onClick={() => elegir(n)}
        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
          activa ? "bg-[var(--accent)] font-semibold text-[var(--accent-fg)] shadow-sm" : `hover:bg-[var(--surface-2)] ${tenue ? "text-[var(--fg-muted)]" : ""}`
        }`}
      >
        <Marca on={activa} fuerte />
        <span className="min-w-0 flex-1 truncate">{texto}</span>
        {sugeridas.includes(n.id) && !activa && <Sugerida />}
      </button>
    );
  };

  /** Una fila con contenido: al pulsarla se abre su columna (no se elige; para elegirla entera está «Toda la sección …»). */
  const filaCarpeta = (n: { id: string; name: string }, nivel: number) => {
    const abierta = camino[nivel] === n.id;
    const conSeleccion = seleccionados.has(n.id);
    return (
      <button
        type="button"
        aria-expanded={abierta}
        onClick={() => setCamino((c) => [...c.slice(0, nivel), n.id])}
        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
          abierta ? "bg-[var(--accent)]/10 font-semibold" : "hover:bg-[var(--surface-2)]"
        }`}
      >
        <Marca on={conSeleccion} />
        <span className="min-w-0 flex-1 truncate">{n.name}</span>
        {sugeridas.includes(n.id) && !conSeleccion && <Sugerida />}
        <span className="flex shrink-0 items-center gap-0.5 text-xs text-[var(--fg-muted)]">
          {hijos.get(n.id)?.length}
          <ChevronRight size={14} aria-hidden />
        </span>
      </button>
    );
  };

  // Columnas: la de las secciones y una por cada nivel abierto.
  const columnas = [null as string | null, ...camino];
  const hayColumnaVacia = camino.length === 0;
  const colsGrid = Math.min(4, columnas.length + (hayColumnaVacia ? 1 : 0));

  return (
    <div className="flex flex-col gap-5">
      {/* Decisión que va antes de la sección (en el asistente, si la nota va destacada en la portada) */}
      {children && <div className="flex min-w-0 flex-col gap-4">{children}</div>}
      {/* Tarjeta de la sección: qué sección eligió, las sugeridas y las columnas para cambiarla */}
      <section className="flex min-w-0 flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
        <div className="flex items-center gap-3">
          <span className={`grid size-9 shrink-0 place-items-center rounded-full ${actual ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "bg-[var(--surface-2)] text-[var(--fg-muted)]"}`}>
            <FolderOpen size={17} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p id={`${idUnico}-l`} className="lx-kicker text-[var(--fg-muted)]">2 · Sección elegida</p>
            <p className={`truncate text-sm ${actual ? "font-semibold" : "text-[var(--fg-muted)]"}`} aria-live="polite" title={actual ? ruta(actual.id) : undefined}>
              {actual ? ruta(actual.id) : "Sin sección · puedes dejarlo para después"}
            </p>
          </div>
          {actual && (
            <button type="button" onClick={() => { if (extra?.value) extra.onPick(extra.value); else onChange(""); }} className="lx-link shrink-0 text-xs font-semibold">
              Quitar
            </button>
          )}
        </div>

        {sugs.length > 0 && !t && (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Secciones sugeridas">
            <span className="text-xs font-medium text-[var(--fg-muted)]">Sugeridas:</span>
            {sugs.map((o) => {
              const activa = elegido === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={activa}
                  onClick={() => { elegir(o); setCamino(caminoPara(o.id)); }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                    activa ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm" : "border-[var(--accent-2)]/40 bg-[var(--accent-2)]/10 hover:border-[var(--accent-2)]"
                  }`}
                >
                  {activa && <Check size={13} aria-hidden />}
                  {ruta(o.id)}
                </button>
              );
            })}
          </div>
        )}

        {/* Buscador a todo el ancho y, debajo, las columnas por niveles */}
        <div className="@container min-w-0 overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="relative border-b border-[var(--border)] bg-[var(--bg-2)] p-2.5">
            <Search size={15} aria-hidden className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault(); // dentro del formulario del asistente: no enviar
                if (coincidencias.length === 1) { elegir(coincidencias[0]); setCamino(caminoPara(coincidencias[0].id)); setQ(""); }
              }}
              placeholder={`Buscar entre ${todos.length} secciones y subsecciones…`}
              aria-label="Buscar sección o subsección"
              className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-4 text-sm outline-none transition focus:border-[var(--accent)]"
            />
          </div>

          {t ? (
            <ul className="max-h-[22rem] overflow-y-auto p-2" aria-label="Resultados de la búsqueda">
              {coincidencias.length === 0 && <li className="px-3 py-6 text-center text-sm text-[var(--fg-muted)]">Nada coincide con «{q}».</li>}
              {coincidencias.map((o) => <li key={o.id}>{filaElegible(o, ruta(o.id))}</li>)}
            </ul>
          ) : (
            <div className="grid @sm:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]" style={{ ["--cols" as string]: colsGrid }}>
              {columnas.map((padre, nivel) => {
                const nodoPadre = padre ? porId.get(padre) : undefined;
                const lista = hijos.get(padre) ?? [];
                return (
                  <div key={padre ?? "raiz"} className="flex min-w-0 flex-col border-[var(--border)] @sm:border-r @sm:last:border-r-0">
                    <p className="lx-kicker truncate border-b border-[var(--border)] px-4 py-2.5 text-[var(--fg-muted)]">
                      {nodoPadre ? `Dentro de ${nodoPadre.name} · ${lista.length}` : `Secciones · ${lista.length}`}
                    </p>
                    <ul className="flex max-h-[22rem] flex-col gap-0.5 overflow-y-auto p-2" role={nodoPadre ? "radiogroup" : undefined} aria-label={nodoPadre ? `Subsecciones de ${nodoPadre.name}` : "Secciones"}>
                      {nodoPadre && <li>{filaElegible(nodoPadre, `Toda la sección «${nodoPadre.name}»`, true)}</li>}
                      {lista.map((n) => <li key={n.id}>{abrible(n.id) ? filaCarpeta(n, nivel) : filaElegible(n, n.name)}</li>)}
                    </ul>
                  </div>
                );
              })}
              {hayColumnaVacia && (
                <div className="hidden min-w-0 flex-col @sm:flex">
                  <p className="lx-kicker border-b border-[var(--border)] px-4 py-2.5 text-[var(--fg-muted)]">Subsecciones</p>
                  <p className="px-4 py-6 text-sm text-[var(--fg-muted)]">Abre una sección para ver lo que contiene.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
