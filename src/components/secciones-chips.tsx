"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { localePath, t, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Fila deslizable de secciones bajo la cabecera del celular (solo debajo de 1024 px): «Todo» y las secciones
 * principales a un toque, sin abrir el menú. Va una sola línea, con la sección actual resaltada, y se desplaza con la
 * página (no es fija, para no gastar pantalla).
 */
export function SeccionesChips({ items, locale }: { items: { href: string; label: string }[]; locale: Locale }) {
  const pathname = usePathname() ?? "/";
  const inicio = localePath(locale, "/");
  const chip = "inline-flex min-h-10 items-center whitespace-nowrap rounded-full border px-4 text-[0.8125rem] font-semibold transition active:scale-95";
  const activo = "border-transparent bg-[var(--accent)] text-[var(--accent-fg,#0b0b0b)]";
  const inactivo = "border-[var(--border-strong)] bg-[var(--surface)]/60 text-[var(--fg)]";

  return (
    <nav aria-label={t(locale, "nav.sections")} className="border-b border-[var(--border)] lg:hidden">
      <ul className="lx-navrail scroll-px-4 gap-2 px-4 py-2.5">
        <li>
          <Link href={inicio} aria-current={pathname === inicio ? "page" : undefined} className={cn(chip, pathname === inicio ? activo : inactivo)}>
            {t(locale, "tab.all")}
          </Link>
        </li>
        {items.map((n) => {
          const href = localePath(locale, n.href);
          const actual = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={n.href}>
              <Link href={href} aria-current={actual ? "page" : undefined} className={cn(chip, actual ? activo : inactivo)}>
                {n.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
