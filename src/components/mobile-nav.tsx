"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Menu, Search, X } from "lucide-react";
import { LocaleSwitch } from "@/components/locale-switch";
import { LogoMark } from "@/components/logo-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { RadioPlayer } from "@/components/radio-player";
import { localePath, t, type Locale } from "@/lib/i18n";
import { EVENTO_ABRIR_MENU } from "@/lib/pestanas";

/**
 * Navbar de móvil y tablet (debajo de 1024 px): barra compacta arriba y menú a
 * pantalla completa. Sustituye a la cabecera de escritorio, que en pantallas
 * estrechas se apretaba o se cortaba.
 *
 * Cada plantilla conserva su carácter con el mismo componente: `look` cambia la
 * disposición de la barra (centrada como un diario, con filete como una
 * revista, contundente, píldora flotante o con sello) y los colores y
 * tipografías salen de los tokens de la plantilla activa.
 *
 * En el celular (< 768 px) el menú y la búsqueda ya están en la barra de pestañas de abajo
 * (src/components/mobile-tab-bar.tsx): arriba solo queda el nombre del sitio —que se va con la página, como la
 * franja alta de la web: lo único fijo es la barra de abajo— y «Secciones» abre este mismo menú de pantalla
 * completa. Desde 768 px, sin esa barra, la cabecera conserva ambos botones y se queda pegada arriba.
 */
export type MobileLook = "masthead" | "couture" | "bold" | "glass" | "crest";

// Elemento del menú: dirección y etiqueta.
type Item = { href: string; label: string };

// Textos del menú en cada idioma.
const LABELS = {
  es: { open: "Abrir menú", close: "Cerrar menú" },
  en: { open: "Open menu", close: "Close menu" },
} as const;

// Menú lateral del celular con las secciones y las herramientas.
export function MobileNav({
  look,
  name,
  nav,
  extra,
  locale,
  radioStreamUrl,
  tagline,
}: {
  look: MobileLook;
  name: string;
  nav: Item[];
  extra: Item[];
  locale: Locale;
  radioStreamUrl?: string | null;
  /** Lema bajo el nombre. Si viene (cabecera «masthead»), el nombre se pinta como en la web: dorado con brillo, con filetes y lema. */
  tagline?: string;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const label = LABELS[locale === "en" ? "en" : "es"];
  const all = [...nav, ...extra];

  // La pestaña «Secciones» de la barra inferior pide abrir este mismo menú (src/components/mobile-tab-bar.tsx).
  useEffect(() => {
    const abrir = () => setOpen(true);
    window.addEventListener(EVENTO_ABRIR_MENU, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_MENU, abrir);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // El aviso de ubicación (z-90, fuera de la cabecera) quedaba por encima del menú: se oculta mientras está abierto.
    document.documentElement.setAttribute("data-cg-overlay", "1");
    closeRef.current?.focus();
    // Cierra el menú con la tecla Escape.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.documentElement.removeAttribute("data-cg-overlay");
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const btn =
    "grid size-11 shrink-0 place-items-center rounded-full text-[var(--fg)] transition active:scale-95 hover:text-[var(--accent)]";

  const menuButton = (
    <button type="button" onClick={() => setOpen(true)} aria-label={label.open} aria-expanded={open} aria-controls="mobile-menu" className={`${btn} max-md:hidden`}>
      <Menu size={22} />
    </button>
  );
  const searchLink = (
    <Link href={localePath(locale, "/buscar")} aria-label={t(locale, "nav.search")} className={`${btn} max-md:hidden`}>
      <Search size={20} />
    </Link>
  );
  // El enlace mide 44 px de alto (el texto solo mide ~22); el nombre se recorta dentro con «…».
  const logo = (cls: string) => (
    <Link href={localePath(locale, "/")} className={`flex min-h-11 min-w-0 items-center ${cls.includes("text-center") ? "justify-center" : ""} ${cls}`}>
      <span className="truncate">{name}</span>
    </Link>
  );

  // El nombre como en la web (MastheadHeader de site-header.tsx): dorado con el brillo que lo recorre, filetes que se
  // desvanecen a los lados y el lema debajo. `lx-kicker` no sirve aquí: su tamaño sin capa le gana a las utilidades.
  const escaparate = tagline ? (
    <div className="flex min-w-0 items-center justify-center gap-4 px-2 py-2.5">
      <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-transparent to-[var(--border-strong)]" />
      <Link href={localePath(locale, "/")} className="block min-w-0 text-center">
        <span className="lx-display lx-foil block whitespace-nowrap text-[clamp(1.4rem,7.2vw,1.9rem)] font-semibold leading-tight tracking-tight">{name}</span>
        <span className="lx-ui mt-1.5 block whitespace-nowrap text-[clamp(0.55rem,2.6vw,0.7rem)] font-semibold uppercase leading-none tracking-[0.16em] text-[var(--fg-muted)]">{tagline}</span>
      </Link>
      <span aria-hidden className="h-px flex-1 bg-gradient-to-l from-transparent to-[var(--border-strong)]" />
    </div>
  ) : null;

  // Cada plantilla, su barra.
  let bar: React.ReactNode;
  switch (look) {
    case "masthead":
      // Diario: menú a la izquierda, cabecera centrada, buscar a la derecha.
      bar = (
        <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center border-b border-[var(--border)] px-2 py-1 max-md:grid-cols-1">
          {menuButton}
          {escaparate ?? logo("lx-display text-center text-[1.35rem] font-semibold leading-none tracking-tight")}
          {searchLink}
        </div>
      );
      break;
    case "couture":
      // Revista: nombre espaciado y un filete de acento bajo la barra.
      bar = (
        <div className="border-b border-[var(--border-strong)]/50">
          <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center px-2 py-1 max-md:grid-cols-1">
            {menuButton}
            {logo("lx-display text-center text-[0.95rem] font-light uppercase tracking-[0.32em]")}
            {searchLink}
          </div>
        </div>
      );
      break;
    case "bold":
      // Compacto: logo a la izquierda, buscar destacado y menú a la derecha.
      bar = (
        <div className="flex items-center gap-1 border-b-2 border-[var(--fg)] px-3 py-1.5">
          {logo("lx-display mr-auto text-xl font-extrabold tracking-tight")}
          <Link
            href={localePath(locale, "/buscar")}
            aria-label={t(locale, "nav.search")}
            className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-[var(--accent-fg)] max-md:hidden"
          >
            <Search size={18} />
          </Link>
          {menuButton}
        </div>
      );
      break;
    case "glass":
      // Vanguardia: píldora flotante con el fondo difuminado.
      bar = (
        <div className="px-3 py-2">
          <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--nav-bg)] py-1 pl-5 pr-1 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)] max-md:justify-center max-md:pr-5">
            {logo("lx-display mr-auto text-sm font-semibold tracking-tight max-md:mr-0")}
            {searchLink}
            {menuButton}
          </div>
        </div>
      );
      break;
    case "crest":
      // Institucional: sello y nombre centrados, con filete de acento.
      bar = (
        <div className="border-b-2 border-[var(--accent)]">
          <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center px-2 py-2 max-md:grid-cols-1">
            {menuButton}
            <Link href={localePath(locale, "/")} className="flex min-w-0 items-center justify-center gap-2">
              <LogoMark size={32} />
              <span className="lx-display truncate text-sm uppercase tracking-[0.22em]">{name}</span>
            </Link>
            {searchLink}
          </div>
        </div>
      );
      break;
  }

  return (
    <header data-region="navbar" className="relative z-40 bg-[var(--nav-bg)] pt-[env(safe-area-inset-top)] text-[var(--fg)] md:sticky md:top-0 lg:hidden">
      {bar}

      {open && (
        <div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label={t(locale, "nav.sections")}
          className="fixed inset-0 z-[100] flex flex-col bg-[var(--bg)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] text-[var(--fg)]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <Link href={localePath(locale, "/")} onClick={() => setOpen(false)} className="lx-display min-w-0 truncate text-lg font-semibold">
              {name}
            </Link>
            <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label={label.close} className={btn}>
              <X size={22} />
            </button>
          </div>

          <nav aria-label={t(locale, "nav.sections")} className="flex-1 overflow-y-auto px-4 py-2">
            <p className="lx-kicker px-1 pb-1 pt-3 text-[var(--accent)]">{t(locale, "nav.sections")}</p>
            <ul>
              {all.map((n) => (
                <li key={n.href} className="border-b border-[var(--border)]">
                  <Link
                    href={localePath(locale, n.href)}
                    onClick={() => setOpen(false)}
                    className="lx-display flex min-h-14 items-center justify-between gap-3 px-1 text-[1.35rem] leading-tight active:text-[var(--accent)]"
                  >
                    {n.label}
                    <ChevronRight size={18} className="shrink-0 text-[var(--accent)]" />
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href={localePath(locale, "/buscar")}
              onClick={() => setOpen(false)}
              className="mt-5 flex min-h-12 items-center gap-3 rounded-full border border-[var(--border-strong)] px-5 text-sm font-semibold text-[var(--accent)]"
            >
              <Search size={17} /> {t(locale, "nav.search")}
            </Link>
          </nav>

          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            <LocaleSwitch locale={locale} />
            <ThemeToggle locale={locale} />
            {radioStreamUrl && <RadioPlayer src={radioStreamUrl} locale={locale} />}
          </div>
        </div>
      )}
    </header>
  );
}
