"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { localePath, t, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ItemMenu = { href: string; label: string; children?: ItemMenu[] };

/**
 * Una sección de la barra de navegación. Si tiene subsecciones, se despliegan debajo al pasar el puntero, al enfocarla con el teclado o al
 * pulsar la flecha (en pantallas táctiles); el propio título sigue llevando a la sección. Sin subsecciones es un enlace normal.
 * `className` es el de cada cabecera: el título conserva exactamente el estilo que ya tenía.
 */
export function NavMenuItem({ item, locale, className }: { item: ItemMenu; locale: Locale; className?: string }) {
  const hijas = item.children ?? [];
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const cierre = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abiertoEn = useRef(0);

  // El menú nace centrado bajo su título; en los extremos de la barra se desplaza lo justo para no salirse de la pantalla.
  useLayoutEffect(() => {
    const el = menu.current;
    if (!abierto || !el) return;
    const { left, right } = el.getBoundingClientRect();
    const margen = 8;
    const ancho = document.documentElement.clientWidth;
    const dx = left < margen ? margen - left : right > ancho - margen ? ancho - margen - right : 0;
    if (dx) el.style.marginLeft = `${Math.round(dx)}px`;
  }, [abierto]);

  // Se cierra con Escape o al pulsar fuera.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  if (hijas.length === 0) {
    return (
      <Link href={localePath(locale, item.href)} className={className}>
        {item.label}
      </Link>
    );
  }

  const abrir = () => {
    if (cierre.current) clearTimeout(cierre.current);
    if (!abierto) abiertoEn.current = Date.now();
    setAbierto(true);
  };
  // Al llegar con el ratón (o al tocar en una pantalla táctil) el menú ya se abrió por `mouseenter`: el clic que sigue no debe cerrarlo.
  const alternar = () => {
    if (abierto && Date.now() - abiertoEn.current < 600) return;
    if (abierto) setAbierto(false);
    else abrir();
  };
  // Un pequeño retraso al salir: el puntero cruza el hueco entre el título y el menú sin que se cierre.
  const cerrarPronto = () => {
    if (cierre.current) clearTimeout(cierre.current);
    cierre.current = setTimeout(() => setAbierto(false), 160);
  };

  return (
    <div
      ref={caja}
      className="relative inline-flex items-center"
      onMouseEnter={abrir}
      onMouseLeave={cerrarPronto}
      // Con el teclado el menú se abre al enfocar; con el ratón o el dedo el foco llega junto con el clic y abrir aquí lo dejaría cerrado de nuevo.
      onFocus={(e) => e.target instanceof HTMLElement && e.target.matches(":focus-visible") && abrir()}
      onBlur={(e) => {
        if (!caja.current?.contains(e.relatedTarget as Node | null)) setAbierto(false);
      }}
    >
      <Link href={localePath(locale, item.href)} className={className}>
        {item.label}
      </Link>
      <button
        type="button"
        aria-label={`${item.label}: ${t(locale, "nav.subsections")}`}
        aria-expanded={abierto}
        aria-haspopup="menu"
        onClick={alternar}
        className="ml-0.5 inline-flex size-5 items-center justify-center text-inherit opacity-70 transition hover:text-[var(--accent)] hover:opacity-100 pointer-coarse:size-8"
      >
        <ChevronDown size={12} aria-hidden className={cn("transition-transform", abierto && "rotate-180")} />
      </button>
      {abierto && (
        // `pt-2` hace de puente: el menú queda pegado al título aunque se vea separado.
        <div
          ref={menu}
          role="menu"
          className="absolute left-1/2 top-full z-[60] -translate-x-1/2 pt-2"
        >
          <div className="min-w-[13rem] max-w-[min(18rem,calc(100vw-2rem))] rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--nav-bg)] py-2 text-left normal-case tracking-normal text-[var(--fg)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]">
            <Link
              role="menuitem"
              href={localePath(locale, item.href)}
              onClick={() => setAbierto(false)}
              className="lx-ui block px-4 py-2 text-[0.8rem] font-semibold text-[var(--accent)] transition hover:bg-[var(--surface-2)]"
            >
              {t(locale, "nav.seeAll")} {item.label}
            </Link>
            {hijas.map((h) => (
              <Link
                key={h.href}
                role="menuitem"
                href={localePath(locale, h.href)}
                onClick={() => setAbierto(false)}
                className="lx-ui block px-4 py-2 text-[0.8rem] transition hover:bg-[var(--surface-2)] hover:text-[var(--accent)]"
              >
                {h.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
