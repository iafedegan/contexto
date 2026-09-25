"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

/**
 * Interruptor de modo oscuro (§12.4).
 *
 * La preferencia es del lector y vive en su navegador; no toca la plantilla
 * que eligió la redacción. El valor se aplica en `<html data-dark>` desde un
 * script en línea (ver `layout.tsx`) para que no haya destello de fondo claro
 * antes de que hidrate React.
 */
/**
 * El modo vive en `<html data-dark>`, fuera de React (lo fija un script antes
 * de pintar). Se lee con `useSyncExternalStore` en vez de copiarlo a un estado:
 * así no hay dos fuentes de verdad ni parpadeo al hidratar.
 */
function suscribir(alCambiar: () => void) {
  const obs = new MutationObserver(alCambiar);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-dark"] });
  return () => obs.disconnect();
}

/** Plantillas oscuras de fábrica: sin preferencia del lector, se ven oscuras. */
const OSCURAS = new Set(["home", "esmeralda", "revista", "vanguardia"]);

/**
 * Modo efectivo: "1" oscuro, "0" claro (elegidos por el lector); sin
 * preferencia, el propio de la plantilla que envuelve al botón.
 */
function esOscuro(boton: HTMLElement | null): boolean {
  const d = document.documentElement.dataset.dark;
  if (d === "1") return true;
  if (d === "0") return false;
  const tema = boton?.closest("[data-theme]")?.getAttribute("data-theme")
    ?? document.querySelector("[data-site-root]")?.getAttribute("data-theme");
  return OSCURAS.has(tema ?? "");
}

export function ThemeToggle({ locale, className = "" }: { locale: Locale; className?: string }) {
  const oscuro = useSyncExternalStore(
    suscribir,
    () => esOscuro(document.querySelector("[data-site-root]")),
    () => false, // en el servidor aún no se conoce la preferencia
  );

  function alternar() {
    const nuevo = !esOscuro(document.querySelector("[data-site-root]"));
    document.documentElement.dataset.dark = nuevo ? "1" : "0";
    try {
      localStorage.setItem("cg-modo", nuevo ? "oscuro" : "claro");
    } catch {
      /* almacenamiento bloqueado: la preferencia dura lo que la pestaña */
    }
  }

  const etiqueta = oscuro ? t(locale, "theme.light") : t(locale, "theme.dark");

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={etiqueta}
      title={etiqueta}
      aria-pressed={oscuro}
      className={`grid size-11 place-items-center rounded-full text-inherit transition hover:text-[var(--accent)] ${className}`}
    >
      {oscuro ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
