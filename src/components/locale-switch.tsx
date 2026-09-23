"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALE_SHORT, LOCALES, localePath, stripLocale, t, type Locale } from "@/lib/i18n";

/**
 * Conmutador de idioma. Enlaza a la MISMA ruta en el otro idioma (no a la
 * portada): cambiar de idioma leyendo una nota debe dejarte en esa nota.
 */
export function LocaleSwitch({ locale, className = "" }: { locale: Locale; className?: string }) {
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
            className={`px-3 py-2 text-[0.68rem] font-semibold leading-none tracking-[0.12em] transition sm:px-2 sm:py-0.5 sm:text-[0.62rem] ${
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
