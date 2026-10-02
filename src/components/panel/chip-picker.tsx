"use client";

import { useId, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";

type Opcion = { id: string; name: string };

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Selector de una opción con búsqueda y fichas (en vez de una lista desplegable):
 * se ve todo de un vistazo, se filtra al escribir y se maneja con teclado (flechas, Enter, Espacio).
 * `sugeridas`: ids que se destacan primero con la etiqueta «Sugerida».
 */
export function ChipPicker({
  label,
  options,
  value,
  onChange,
  vacio,
  buscar = true,
  avatar = false,
  sugeridas = [],
}: {
  label: string;
  options: Opcion[];
  value: string;
  onChange: (id: string) => void;
  /** Texto de la ficha «ninguna» (p. ej. «Sin sección»). */
  vacio: string;
  buscar?: boolean;
  /** Muestra la inicial de cada persona en un círculo. */
  avatar?: boolean;
  sugeridas?: string[];
}) {
  const [q, setQ] = useState("");
  const id = useId();
  const lista = useMemo(() => {
    const t = norm(q.trim());
    const f = t ? options.filter((o) => norm(o.name).includes(t)) : options;
    const peso = (o: Opcion) => (o.id === value ? 2 : 0) + (sugeridas.includes(o.id) ? 1 : 0);
    return [...f].sort((a, b) => peso(b) - peso(a));
  }, [q, options, sugeridas, value]);
  const actual = options.find((o) => o.id === value);

  return (
    <div role="radiogroup" aria-labelledby={`${id}-l`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span id={`${id}-l`} className="lx-kicker text-[var(--fg-muted)]">{label}</span>
        <span className="text-xs text-[var(--fg-muted)]">
          {actual ? <>Elegida: <strong className="text-[var(--fg)]">{actual.name}</strong></> : vacio}
        </span>
      </div>
      {buscar && options.length > 5 && (
        <div className="relative">
          <Search size={15} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // dentro del formulario del asistente: no enviar
                if (lista.length === 1) onChange(lista[0].id);
              }
            }}
            placeholder={`Buscar ${label.toLowerCase()}…`}
            aria-label={`Buscar ${label.toLowerCase()}`}
            className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[var(--accent)]"
          />
        </div>
      )}
      <div className="flex max-h-72 flex-wrap gap-2 overflow-y-auto p-0.5">
        <Ficha activa={value === ""} onClick={() => onChange("")} texto={vacio} tenue />
        {lista.map((o) => (
          <Ficha
            key={o.id}
            activa={value === o.id}
            onClick={() => onChange(o.id)}
            texto={o.name}
            inicial={avatar ? o.name.charAt(0).toUpperCase() : undefined}
            sugerida={sugeridas.includes(o.id)}
          />
        ))}
        {lista.length === 0 && <p className="px-1 py-2 text-sm text-[var(--fg-muted)]">Nada coincide con «{q}».</p>}
      </div>
    </div>
  );
}

function Ficha({ activa, onClick, texto, inicial, sugerida, tenue }: { activa: boolean; onClick: () => void; texto: string; inicial?: string; sugerida?: boolean; tenue?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activa}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
        activa
          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm"
          : `border-[var(--border)] bg-[var(--bg-2)] hover:border-[var(--accent)] ${tenue ? "text-[var(--fg-muted)]" : ""}`
      }`}
    >
      {inicial && (
        <span className={`grid size-6 place-items-center rounded-full text-xs font-bold ${activa ? "bg-white/25" : "bg-[var(--accent)]/12 text-[var(--accent)]"}`}>{inicial}</span>
      )}
      {activa && !inicial && <Check size={14} aria-hidden />}
      {texto}
      {sugerida && !activa && <span className="rounded-full bg-[var(--accent-2)]/18 px-2 py-0.5 text-[0.6875rem] font-semibold text-[var(--accent-2)]">Sugerida</span>}
    </button>
  );
}
