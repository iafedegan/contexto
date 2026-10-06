"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { localePath, t, type Locale } from "@/lib/i18n";

// Sugerencia de búsqueda: titular y dirección.
type Sugerencia = { title: string; slug: string };

/**
 * Campo de búsqueda con sugerencias (B-01, B-04).
 *
 * Sigue siendo un `<form method="get">`: sin JavaScript busca igual, y cada
 * consulta tiene su URL. Las sugerencias son una ayuda encima, con 200 ms de
 * espera para no lanzar una petición por tecla.
 */
export function SearchBox({
  locale,
  defaultValue = "",
  autoFocus = false,
}: {
  locale: Locale;
  defaultValue?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(defaultValue);
  const [items, setItems] = useState<Sugerencia[]>([]);
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peticion = useRef<AbortController | null>(null);

  /**
   * La consulta se lanza desde el evento de escritura, no desde un efecto:
   * pedir sugerencias es una reacción a lo que el lector teclea, y así se
   * cancela limpiamente la petición anterior en cada pulsación.
   */
  function alEscribir(texto: string) {
    setValor(texto);
    if (temporizador.current) clearTimeout(temporizador.current);
    peticion.current?.abort();

    const q = texto.trim();
    if (q.length < 3) {
      setItems([]);
      setAbierto(false);
      return;
    }

    const ctrl = new AbortController();
    peticion.current = ctrl;
    temporizador.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sugerencias?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const data = (await res.json()) as { items: Sugerencia[] };
        setItems(data.items ?? []);
        setAbierto((data.items ?? []).length > 0);
      } catch {
        /* petición cancelada o red caída: no hay sugerencias, se busca igual */
      }
    }, 200);
  }

  useEffect(() => {
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
      peticion.current?.abort();
    };
  }, []);

  useEffect(() => {
    // Cierra las sugerencias al hacer clic fuera.
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  return (
    <div ref={caja} className="relative">
      <form
        action={localePath(locale, "/buscar")}
        method="get"
        className="lx-card lx-glass flex flex-wrap items-center gap-3 p-3"
        role="search"
      >
        <Search size={18} aria-hidden className="ml-2 text-[var(--accent)]" />
        <input
          name="q"
          value={valor}
          onChange={(e) => alEscribir(e.target.value)}
          onFocus={() => items.length > 0 && setAbierto(true)}
          onKeyDown={(e) => e.key === "Escape" && setAbierto(false)}
          autoFocus={autoFocus}
          autoComplete="off"
          placeholder={t(locale, "search.placeholder")}
          aria-label={t(locale, "search.label")}
          className="min-w-[12rem] flex-1 border-0 bg-transparent py-2 text-[1rem] outline-none placeholder:text-[var(--fg-muted)]/60"
        />
        <button type="submit" className="lx-btn min-h-11 max-sm:w-full">
          {t(locale, "search.button")}
        </button>
      </form>

      {abierto && items.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]"
        >
          {items.map((s) => (
            <li key={s.slug}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  setAbierto(false);
                  router.push(localePath(locale, `/articulo/${s.slug}`));
                }}
                className="block w-full px-4 py-2.5 text-left text-sm leading-snug transition hover:bg-[var(--surface-2)] hover:text-[var(--accent)]"
              >
                {s.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
