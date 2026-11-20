"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { SearchBox } from "@/components/search-box";
import { t, type Locale } from "@/lib/i18n";

/**
 * La lupa de la cabecera: abre un cuadro de búsqueda con sugerencias sin salir de la página. Se abre también con la tecla «/» (como en la mayoría de
 * los sitios de noticias) y se cierra con Escape o al tocar fuera; sin JavaScript, el formulario de «/buscar» sigue funcionando.
 */
export function LupaBuscar({ locale, className = "", variante = "dorada" }: { locale: Locale; className?: string; variante?: "dorada" | "barra" }) {
  const [abierta, setAbierta] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierta(false);
      const en = e.target instanceof HTMLElement ? e.target : null;
      const escribiendo = !!en && (en.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(en.tagName));
      if (e.key === "/" && !escribiendo && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setAbierta(true);
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  useEffect(() => {
    if (!abierta) return;
    const fuera = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierta(false); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierta]);

  const estilo = variante === "dorada"
    ? "size-11 rounded-full border border-[#d9a41a]/55 !text-[#d9a41a] hover:bg-[#d9a41a]/15"
    : "size-9 rounded-full text-[var(--fg)] hover:bg-black/10";
  return (
    <div ref={caja} className={`relative ${className}`}>
      <button type="button" onClick={() => setAbierta((v) => !v)} aria-expanded={abierta} aria-label={t(locale, "nav.search")} title={`${t(locale, "nav.search")} ( / )`}
        className={`grid shrink-0 place-items-center transition ${estilo}`}>
        {abierta ? <X size={18} aria-hidden /> : <Search size={18} aria-hidden />}
      </button>
      {abierta && (
        <div className="fixed inset-x-3 top-24 z-[60] mx-auto max-w-2xl text-[var(--fg)] md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-3 md:w-[min(42rem,90vw)]">
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg-2)] p-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]">
            <SearchBox locale={locale} autoFocus />
          </div>
        </div>
      )}
    </div>
  );
}
