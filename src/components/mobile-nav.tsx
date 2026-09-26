"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Menu, Search, X } from "lucide-react";
import { LocaleSwitch } from "@/components/locale-switch";
import { ThemeToggle } from "@/components/theme-toggle";
import { RadioPlayer } from "@/components/radio-player";
import { localePath, t, type Locale } from "@/lib/i18n";

/**
 * Navbar de móvil y tablet (debajo de 1024 px): barra compacta arriba y menú a
 * pantalla completa. Sustituye a la cabecera de escritorio, que en pantallas
 * estrechas se apretaba o se cortaba.
 *
 * Cada plantilla conserva su carácter con el mismo componente: `look` cambia la
 * disposición de la barra (centrada como un diario, con filete como una
 * revista, contundente, píldora flotante o con sello) y los colores y
 * tipografías salen de los tokens de la plantilla activa.
 */
export type MobileLook = "masthead" | "couture" | "bold" | "glass" | "crest";

type Item = { href: string; label: string };

const LABELS = {
  es: { open: "Abrir menú", close: "Cerrar menú" },
  en: { open: "Open menu", close: "Close menu" },
} as const;

export function MobileNav({
  look,
  name,
  nav,
  extra,
  locale,
  radioStreamUrl,
}: {
  look: MobileLook;
  name: string;
  nav: Item[];
  extra: Item[];
  locale: Locale;
  radioStreamUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const label = LABELS[locale === "en" ? "en" : "es"];
  const all = [...nav, ...extra];

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const btn =
    "grid size-11 shrink-0 place-items-center rounded-full text-[var(--fg)] transition active:scale-95 hover:text-[var(--accent)]";

  const menuButton = (
    <button type="button" onClick={() => setOpen(true)} aria-label={label.open} aria-expanded={open} aria-controls="mobile-menu" className={btn}>
      <Menu size={22} />
    </button>
  );
  const searchLink = (
    <Link href={localePath(locale, "/buscar")} aria-label={t(locale, "nav.search")} className={btn}>
      <Search size={20} />
    </Link>
  );
  const logo = (cls: string) => (
    <Link href={localePath(locale, "/")} className={`min-w-0 truncate ${cls}`}>
      {name}
    </Link>
  );

  // Cada plantilla, su barra.
  let bar: React.ReactNode;
  switch (look) {
    case "masthead":
      // Diario: menú a la izquierda, cabecera centrada, buscar a la derecha.
      bar = (
        <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center border-b border-[var(--border)] px-2 py-1">
          {menuButton}
          {logo("lx-display text-center text-[1.35rem] font-semibold leading-none tracking-tight")}
          {searchLink}
        </div>
      );
      break;
    case "couture":
      // Revista: nombre espaciado y un filete de acento bajo la barra.
      bar = (
        <div className="border-b border-[var(--border-strong)]/50">
          <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center px-2 py-1">
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
            className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-[var(--accent-fg)]"
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
          <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--nav-bg)] py-1 pl-5 pr-1 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]">
            {logo("lx-display mr-auto text-sm font-semibold tracking-tight")}
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
          <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center px-2 py-2">
            {menuButton}
            <Link href={localePath(locale, "/")} className="flex min-w-0 items-center justify-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-[var(--accent)] text-[0.6rem] tracking-[0.1em] text-[var(--accent)]">
                CG
              </span>
              <span className="lx-display truncate text-sm uppercase tracking-[0.22em]">{name}</span>
            </Link>
            {searchLink}
          </div>
        </div>
      );
      break;
  }

  return (
    <header data-region="navbar" className="sticky top-0 z-40 bg-[var(--nav-bg)] text-[var(--fg)] lg:hidden">
      {bar}

      {open && (
        <div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label={t(locale, "nav.sections")}
          className="fixed inset-0 z-[100] flex flex-col bg-[var(--bg)] text-[var(--fg)]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2">
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

          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] px-4 py-3">
            <LocaleSwitch locale={locale} />
            <ThemeToggle locale={locale} />
            {radioStreamUrl && <RadioPlayer src={radioStreamUrl} locale={locale} />}
          </div>
        </div>
      )}
    </header>
  );
}
