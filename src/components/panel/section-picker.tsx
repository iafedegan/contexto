"use client";

import { useId, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, FolderOpen, Search } from "lucide-react";

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

/** Círculo de selección: relleno con ✓ si está elegida; en las filas de sección también marca que una subsección suya lo está. */
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

/**
 * Selector de sección en DOS COLUMNAS, como está armado el sitio (secciones y, dentro, subsecciones): a la izquierda
 * las secciones; al elegir una con ramas, a la derecha salen sus subsecciones (arriba «Toda la sección»). Sin
 * desplegar nada ni perderse en un árbol largo. Arriba: dónde se publicará (y quién firma), buscador y las sugeridas
 * para esta nota. En pantallas angostas las subsecciones se despliegan debajo de su sección.
 *
 * Sin desplazamiento: cada lista va en un carrusel de `filas` filas por página (el asistente calcula cuántas caben
 * en la ventana), y en un ancho amplio los datos de la nota quedan a la izquierda y el selector a la derecha.
 */
export function SectionTree({
  options,
  value,
  onChange,
  sugeridas = [],
  extra,
  sufijoRuta = "",
  firma,
  children,
}: {
  options: Nodo[];
  value: string;
  onChange: (id: string) => void;
  sugeridas?: string[];
  /** Subsecciones que no son secciones del sitio (p. ej. las regiones y departamentos de «Regiones»): se muestran bajo la sección `categoriaId` y, al elegirlas, quien llama decide qué guarda. */
  extra?: { categoriaId: string; items: { id: string; nombre: string; nivel: number }[]; value: string; onPick: (id: string) => void };
  /** Texto que se añade a la ruta de la sección elegida (p. ej. « › Caribe › Atlántico»). */
  sufijoRuta?: string;
  /** Quién firma la nota: se muestra junto a «Se publicará en». */
  firma?: string;
  /** Contenido propio del asistente que va justo debajo de «Se publicará en» (p. ej. el lugar en la portada). */
  children?: React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const id = useId();
  const ids = useMemo(() => new Set(options.map((o) => o.id)), [options]);
  const porId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const hijos = useMemo(() => {
    const m = new Map<string, Nodo[]>();
    for (const o of options) {
      if (o.parentId && ids.has(o.parentId)) m.set(o.parentId, [...(m.get(o.parentId) ?? []), o]);
    }
    return m;
  }, [options, ids]);
  const raices = useMemo(() => options.filter((o) => !o.parentId || !ids.has(o.parentId)), [options, ids]);
  // Sección principal (la raíz del árbol) a la que pertenece una opción, suba cuantos niveles suba.
  const raizDe = (o: Nodo | undefined) => {
    let r = o;
    const vistos = new Set<string>();
    while (r?.parentId && ids.has(r.parentId) && !vistos.has(r.id)) {
      vistos.add(r.id);
      r = porId.get(r.parentId);
    }
    return r;
  };
  // Todas las subsecciones de una sección, hasta la más profunda, en orden de árbol y con su nivel (1 = hija directa).
  const descendientes = (r: Nodo): { n: Nodo; d: number }[] => {
    const salida: { n: Nodo; d: number }[] = [];
    const vistos = new Set<string>([r.id]);
    const bajar = (x: Nodo, d: number) => {
      for (const h of hijos.get(x.id) ?? []) {
        if (vistos.has(h.id)) continue;
        vistos.add(h.id);
        salida.push({ n: h, d });
        bajar(h, d + 1);
      }
    };
    bajar(r, 1);
    return salida;
  };
  const actual = porId.get(value);
  // La rama abierta empieza en la de la sección elegida; si no hay, en la primera sugerida y, si no, en la primera con subsecciones.
  const [rama, setRama] = useState<string | null>(
    () => raizDe(actual)?.id ?? raizDe(porId.get(sugeridas[0]))?.id ?? raices.find((r) => (hijos.get(r.id)?.length ?? 0) > 0)?.id ?? null,
  );
  const ramaNodo = rama ? porId.get(rama) : undefined;
  const subs = ramaNodo ? descendientes(ramaNodo) : [];
  const t = norm(q.trim());
  // Indica si una sección o alguna de sus subsecciones está elegida.
  const contiene = (r: Nodo) => value === r.id || descendientes(r).some((h) => h.n.id === value);
  // Ruta completa de una opción: de la sección principal hasta ella («Colombia › Regiones › Llanos»).
  const ruta = (o: Nodo) => {
    const partes = [o.name];
    const vistos = new Set<string>([o.id]);
    for (let p = o.parentId ? porId.get(o.parentId) : undefined; p && !vistos.has(p.id); p = p.parentId ? porId.get(p.parentId) : undefined) {
      vistos.add(p.id);
      partes.unshift(p.name);
    }
    return partes.join(" › ");
  };

  /** Opción elegible (sección completa o subsección). */
  const opcion = (o: Nodo, texto: string, tenue?: boolean, nivel = 0) => {
    const activa = value === o.id;
    return (
      <button
        type="button"
        aria-pressed={activa}
        onClick={() => onChange(activa ? "" : o.id)}
        style={nivel > 1 ? { paddingLeft: `${0.75 + (nivel - 1) * 1.1}rem` } : undefined}
        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
          activa ? "bg-[var(--accent)] font-semibold text-[var(--accent-fg)] shadow-sm" : `hover:bg-[var(--surface-2)] ${tenue ? "text-[var(--fg-muted)]" : ""}`
        }`}
      >
        <Marca on={activa} fuerte />
        <span className="min-w-0 flex-1 truncate">{texto}</span>
        {sugeridas.includes(o.id) && !activa && <Sugerida />}
      </button>
    );
  };
  // Subsecciones de una sección, con «Toda la sección» al principio.
  type ItemSub = { n: Nodo; d: number; v?: undefined } | { v: { id: string; nombre: string }; d: number; n?: undefined };
  const itemsSubs = (r: Nodo): ItemSub[] => {
    const base: ItemSub[] = [{ n: r, d: 0 }, ...descendientes(r)];
    if (!extra) return base;
    const i = base.findIndex((x) => x.n?.id === extra.categoriaId);
    if (i < 0) return base;
    return [...base.slice(0, i + 1), ...extra.items.map((it) => ({ v: it, d: base[i].d + it.nivel })), ...base.slice(i + 1)];
  };
  // Una subsección que no es una sección del sitio (región o departamento).
  const opcionExtra = (v: { id: string; nombre: string }, nivel: number) => {
    const activa = extra?.value === v.id;
    return (
      <button
        type="button"
        aria-pressed={activa}
        onClick={() => extra?.onPick(v.id)}
        style={nivel > 1 ? { paddingLeft: `${0.75 + (nivel - 1) * 1.1}rem` } : undefined}
        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${activa ? "bg-[var(--accent)] font-semibold text-[var(--accent-fg)] shadow-sm" : "hover:bg-[var(--surface-2)]"}`}
      >
        <Marca on={activa} fuerte />
        <span className="min-w-0 flex-1 truncate">{v.nombre}</span>
      </button>
    );
  };
  const filaSub = (h: ItemSub, r: Nodo) => (h.v ? opcionExtra(h.v, h.d) : opcion(h.n, h.d === 0 ? `Toda la sección «${r.name}»` : h.n.name, h.d === 0, h.d));
  // Lista (sin carrusel) de subsecciones, para el despliegue en pantallas angostas.
  const listaSubs = (r: Nodo) => (
    <ul role="radiogroup" aria-label={`Subsecciones de ${r.name}`} className="flex flex-col gap-0.5">
      {itemsSubs(r).map((h) => <li key={h.n?.id ?? h.v!.id}>{filaSub(h, r)}</li>)}
    </ul>
  );
  // Fila de una sección con sus subsecciones.
  const filaSeccion = (r: Nodo) => {
    const n = itemsSubs(r).length - 1;
    const abierta = rama === r.id;
    const elegida = contiene(r);
    return (
      <div key={r.id}>
        <button
          type="button"
          aria-current={abierta ? "true" : undefined}
          aria-expanded={n ? abierta : undefined}
          onClick={() => {
            setRama(r.id);
            if (!n) onChange(value === r.id ? "" : r.id); // sin ramas: elegirla; con ramas: se abren sus subsecciones
          }}
          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
            abierta ? "bg-[var(--accent)]/10 font-semibold" : "hover:bg-[var(--surface-2)]"
          }`}
        >
          <Marca on={elegida} />
          <span className="min-w-0 flex-1 truncate">{r.name}</span>
          {sugeridas.includes(r.id) && !elegida && <Sugerida />}
          {n > 0 && (
            <span className="flex shrink-0 items-center gap-0.5 text-xs text-[var(--fg-muted)]">
              {n}
              <ChevronRight size={14} className={`transition-transform ${abierta ? "rotate-90 @sm:rotate-0" : ""}`} />
            </span>
          )}
        </button>
        {abierta && n > 0 && <div className="ml-4 mt-1 border-l-2 border-[var(--border)] pl-2 @sm:hidden">{listaSubs(r)}</div>}
      </div>
    );
  };

  const coincidencias = t ? options.filter((o) => norm(o.name).includes(t)).sort((a, b) => Number(sugeridas.includes(b.id)) - Number(sugeridas.includes(a.id))) : [];
  const sugs = sugeridas.map((x) => porId.get(x)).filter((x): x is Nodo => !!x).slice(0, 4);

  const hayRama = !!ramaNodo && subs.length > 0;
  return (
    <div className="flex flex-col gap-5">
      {/* Tarjeta 1: qué sección eligió, las sugeridas y las listas para cambiarla */}
      <section className="flex min-w-0 flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
      <div className="flex items-center gap-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-full ${actual ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "bg-[var(--surface-2)] text-[var(--fg-muted)]"}`}>
          <FolderOpen size={17} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p id={`${id}-l`} className="lx-kicker text-[var(--fg-muted)]">1 · Sección elegida</p>
          <p className={`truncate text-sm ${actual ? "font-semibold" : "text-[var(--fg-muted)]"}`} aria-live="polite">
            {actual ? `${ruta(actual)}${sufijoRuta}` : "Sin sección · puedes dejarlo para después"}
          </p>
          {firma && <p className="truncate text-xs text-[var(--fg-muted)]" title="La nota la firma quien la escribe: tu usuario. No se puede cambiar.">Firma: <strong className="text-[var(--fg)]">{firma}</strong></p>}
        </div>
        {actual && (
          <button type="button" onClick={() => onChange("")} className="lx-link shrink-0 text-xs font-semibold">
            Quitar
          </button>
        )}
      </div>

      {sugs.length > 0 && !t && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Secciones sugeridas">
          <span className="text-xs font-medium text-[var(--fg-muted)]">Sugeridas:</span>
          {sugs.map((o) => {
            const activa = value === o.id;
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={activa}
                onClick={() => { onChange(activa ? "" : o.id); setRama(raizDe(o)?.id ?? null); }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                  activa ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm" : "border-[var(--accent-2)]/40 bg-[var(--accent-2)]/10 hover:border-[var(--accent-2)]"
                }`}
              >
                {activa && <Check size={13} aria-hidden />}
                {ruta(o)}
              </button>
            );
          })}
        </div>
      )}

      {/* Buscador y, debajo, dos listas alineadas (secciones | su contenido), cada una con el mismo alto y su propio desplazamiento. */}
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
              if (coincidencias.length === 1) onChange(coincidencias[0].id);
            }}
            placeholder={`Buscar entre ${options.length} secciones y subsecciones…`}
            aria-label="Buscar sección o subsección"
            className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-4 text-sm outline-none transition focus:border-[var(--accent)]"
          />
        </div>
        {t ? (
          <ul className="max-h-[22rem] overflow-y-auto p-2" aria-label="Resultados de la búsqueda">
            {coincidencias.length === 0 && <li className="px-3 py-6 text-center text-sm text-[var(--fg-muted)]">Nada coincide con «{q}».</li>}
            {coincidencias.map((o) => <li key={o.id}>{opcion(o, ruta(o))}</li>)}
          </ul>
        ) : (
          <div className="grid @sm:grid-cols-2">
            <div className="flex min-w-0 flex-col @sm:border-r @sm:border-[var(--border)]">
              <p className="lx-kicker border-b border-[var(--border)] px-4 py-2.5 text-[var(--fg-muted)]">Secciones · {raices.length}</p>
              <div className="max-h-[22rem] overflow-y-auto p-2">{raices.map(filaSeccion)}</div>
            </div>
            <div className="hidden min-w-0 flex-col @sm:flex" aria-live="polite">
              <p className="lx-kicker truncate border-b border-[var(--border)] px-4 py-2.5 text-[var(--fg-muted)]">
                {hayRama ? `Dentro de ${ramaNodo!.name} · ${itemsSubs(ramaNodo!).length - 1}` : "Subsecciones"}
              </p>
              {hayRama ? (
                // Todas las subsecciones a la vez, de todos los niveles y con sangría.
                <ul key={ramaNodo!.id} role="radiogroup" aria-label={`Subsecciones de ${ramaNodo!.name}`} className="flex max-h-[22rem] flex-col gap-0.5 overflow-y-auto p-2">
                  {itemsSubs(ramaNodo!).map((h) => (
                    <li key={h.n?.id ?? h.v!.id}>{filaSub(h, ramaNodo!)}</li>
                  ))}
                </ul>
              ) : (
                <p className="flex items-center gap-2 px-4 py-6 text-sm text-[var(--fg-muted)]">
                  <ChevronLeft size={16} aria-hidden className="shrink-0" />
                  {ramaNodo ? `«${ramaNodo.name}» no tiene subsecciones.` : "Elige una sección para ver lo que contiene."}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      </section>
      {/* Decisiones 2 y 3 del asistente (región, portada), una tarjeta cada una */}
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </div>
  );
}
