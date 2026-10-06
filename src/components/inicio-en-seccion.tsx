"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { localePath, type Locale } from "@/lib/i18n";

/** Enlace «Inicio» al principio del menú, solo en las páginas de sección (donde ya no se muestra la miga «Inicio / Sección»). */
export function InicioEnSeccion({ locale, className }: { locale: Locale; className?: string }) {
  const pathname = usePathname() ?? "";
  if (!/(^|\/)categoria\//.test(pathname)) return null;
  return (
    <Link href={localePath(locale, "/")} className={className}>
      {locale === "es" ? "Inicio" : "Home"}
    </Link>
  );
}
