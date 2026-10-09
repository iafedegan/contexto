"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALE_SHORT, LOCALES, localePath, stripLocale, t, type Locale } from "@/lib/i18n";

/**
 * Conmutador de idioma. Enlaza a la MISMA ruta en el otro idioma (no a la
 * portada): cambiar de idioma leyendo una nota debe dejarte en esa nota.
 */
export function LocaleSwitch({ locale, className = "", compacto = false }: { locale: Locale; className?: string; /** Versión pequeña y discreta para la barra de secciones. */ compacto?: boolean }) {
  const pathname = usePathname();
  const bare = stripLocale(pathname ?? "/");

  return (
    <span
      className={`inline-flex items-center overflow-hidden rounded-full border border-[var(--border)] ${className}`}
      role="group"
      aria-label={t(locale, "locale.switch")}
    >
      {LOCALES.map((l) => {
        const active = l === locale;
        return (
          <Link
            key={l}
            href={localePath(l, bare)}
            hrefLang={l}
            aria-current={active ? "true" : undefined}
            // 44 px de alto con el dedo; con ratón, la píldora compacta de siempre.
            className={`inline-flex min-h-11 min-w-11 items-center justify-center ${compacto ? "px-2 !text-[0.6rem] pointer-fine:!px-2" : "px-3"} text-[0.72rem] font-semibold leading-none tracking-[0.12em] transition pointer-fine:min-h-0 pointer-fine:min-w-0 pointer-fine:px-2.5 pointer-fine:py-1 ${
              active
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "text-[var(--fg-muted)] hover:text-[var(--accent)]"
            }`}
          >
            {LOCALE_SHORT[l]}
          </Link>
        );
      })}
    </span>
  );
}
