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
 */
export function SectionTree({
  options,
  value,
  onChange,
  sugeridas = [],
  firma,
  children,
}: {
  options: Nodo[];
  value: string;
  onChange: (id: string) => void;
  sugeridas?: string[];
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
  // Sección principal a la que pertenece una opción.
  const raizDe = (o: Nodo | undefined) => (o?.parentId && ids.has(o.parentId) ? porId.get(o.parentId) : o);
  const actual = porId.get(value);
  const padre = actual?.parentId ? porId.get(actual.parentId) : undefined;
  // La rama abierta empieza en la de la sección elegida; si no hay, en la primera sugerida y, si no, en la primera con subsecciones.
  const [rama, setRama] = useState<string | null>(
    () => raizDe(actual)?.id ?? raizDe(porId.get(sugeridas[0]))?.id ?? raices.find((r) => (hijos.get(r.id)?.length ?? 0) > 0)?.id ?? null,
  );
  const ramaNodo = rama ? porId.get(rama) : undefined;
  const subs = ramaNodo ? (hijos.get(ramaNodo.id) ?? []) : [];
  const t = norm(q.trim());
  // Indica si una sección o alguna de sus subsecciones está elegida.
  const contiene = (r: Nodo) => value === r.id || (hijos.get(r.id) ?? []).some((h) => h.id === value);
  // Ruta de una opción: sección principal y subsección.
  const ruta = (o: Nodo) => {
    const p = o.parentId ? porId.get(o.parentId) : undefined;
    return p ? `${p.name} › ${o.name}` : o.name;
  };

  /** Opción elegible (sección completa o subsección). */
  const opcion = (o: Nodo, texto: string, tenue?: boolean) => {
    const activa = value === o.id;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={activa}
        onClick={() => onChange(activa ? "" : o.id)}
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
  // Lista de subsecciones de una sección.
  const listaSubs = (r: Nodo) => (
    <ul role="radiogroup" aria-label={`Subsecciones de ${r.name}`} className="flex flex-col gap-0.5">
      <li>{opcion(r, `Toda la sección «${r.name}»`, true)}</li>
      {(hijos.get(r.id) ?? []).map((h) => <li key={h.id}>{opcion(h, h.name)}</li>)}
    </ul>
  );
  // Fila de una sección con sus subsecciones.
  const filaSeccion = (r: Nodo) => {
    const n = hijos.get(r.id)?.length ?? 0;
    const abierta = rama === r.id;
    const elegida = contiene(r);
    return (
      <li key={r.id}>
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
              <ChevronRight size={14} className={`transition-transform ${abierta ? "rotate-90 md:rotate-0" : ""}`} />
            </span>
          )}
        </button>
        {abierta && n > 0 && <div className="ml-4 mt-1 border-l-2 border-[var(--border)] pl-2 md:hidden">{listaSubs(r)}</div>}
      </li>
    );
  };

  const coincidencias = t ? options.filter((o) => norm(o.name).includes(t)).sort((a, b) => Number(sugeridas.includes(b.id)) - Number(sugeridas.includes(a.id))) : [];
  const sugs = sugeridas.map((x) => porId.get(x)).filter((x): x is Nodo => !!x).slice(0, 6);

  return (
    <div className="flex flex-col gap-2.5">
      {/* Dónde se publicará y quién firma */}
      <div className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3.5 py-2.5">
        <span className={`grid size-9 shrink-0 place-items-center rounded-full ${actual ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "bg-[var(--surface-2)] text-[var(--fg-muted)]"}`}>
          <FolderOpen size={17} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p id={`${id}-l`} className="lx-kicker text-[var(--fg-muted)]">Se publicará en</p>
          <p className={`truncate text-sm ${actual ? "font-semibold" : "text-[var(--fg-muted)]"}`} aria-live="polite">
            {actual ? `${padre ? `${padre.name} › ` : ""}${actual.name}` : "Sin sección · puedes dejarlo para después"}
          </p>
          {firma && <p className="truncate text-xs text-[var(--fg-muted)] sm:hidden">Firma: <strong className="text-[var(--fg)]">{firma}</strong></p>}
        </div>
        {actual && (
          <button type="button" onClick={() => onChange("")} className="lx-link shrink-0 text-xs font-semibold">
            Quitar
          </button>
        )}
        {firma && (
          <div className="hidden min-w-0 max-w-[40%] shrink-0 items-center gap-2 border-l border-[var(--border)] pl-3 sm:flex" title="La nota la firma quien la escribe: tu usuario. No se puede cambiar.">
            <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-xs font-bold">{firma.charAt(0).toUpperCase()}</span>
            <span className="min-w-0 leading-tight">
              <span className="lx-kicker block text-[var(--fg-muted)]">Firma</span>
              <span className="block truncate text-sm font-semibold">{firma}</span>
            </span>
          </div>
        )}
      </div>

      {children}

      {sugs.length > 0 && !t && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Secciones sugeridas">
          <span className="text-xs font-medium text-[var(--fg-muted)]">Sugeridas para esta nota:</span>
          {sugs.map((o) => {
            const activa = value === o.id;
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={activa}
                onClick={() => { onChange(activa ? "" : o.id); setRama(raizDe(o)?.id ?? null); }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
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

      {/* Sin scroll propio: se desplaza con la hoja del asistente. El buscador va en la cabecera de la columna izquierda. */}
      <div className={`grid rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] ${t ? "" : "md:grid-cols-2"}`}>
        <div className={`flex min-w-0 flex-col ${t ? "" : "md:border-r md:border-[var(--border)]"}`}>
          <div className="relative p-2 pb-1">
            <Search size={15} aria-hidden className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault(); // dentro del formulario del asistente: no enviar
                if (coincidencias.length === 1) onChange(coincidencias[0].id);
              }}
              placeholder={`Buscar entre ${options.length} secciones…`}
              aria-label="Buscar sección o subsección"
              className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-4 text-sm outline-none transition focus:border-[var(--accent)]"
            />
          </div>
          {t ? (
            <ul role="radiogroup" aria-labelledby={`${id}-l`} className="flex flex-col gap-0.5 p-2 pt-1">
              {coincidencias.map((o) => <li key={o.id}>{opcion(o, ruta(o))}</li>)}
              {coincidencias.length === 0 && <li className="px-3 py-4 text-center text-sm text-[var(--fg-muted)]">Nada coincide con «{q}».</li>}
            </ul>
          ) : (
            <>
              <p className="lx-kicker px-4 pb-1 pt-2 text-[var(--fg-muted)]">Secciones · {raices.length}</p>
              <ul className="flex flex-col gap-0.5 p-2 pt-0">{raices.map(filaSeccion)}</ul>
            </>
          )}
        </div>
        {!t && (
          <div className="hidden md:block" aria-live="polite">
            <div className="md:sticky md:-top-[3.3rem]">
              <p className="lx-kicker truncate px-4 pb-1 pt-[3.5rem] text-[var(--fg-muted)]">
                {ramaNodo && subs.length > 0 ? `Dentro de ${ramaNodo.name} · ${subs.length}` : "Subsecciones"}
              </p>
              <div className="p-2 pt-0">
                {ramaNodo && subs.length > 0 ? (
                  listaSubs(ramaNodo)
                ) : (
                  <p className="flex items-center gap-2 px-3 py-6 text-sm text-[var(--fg-muted)]">
                    <ChevronLeft size={16} aria-hidden className="shrink-0" />
                    {ramaNodo ? `«${ramaNodo.name}» no tiene subsecciones.` : "Elige una sección para ver lo que contiene."}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
