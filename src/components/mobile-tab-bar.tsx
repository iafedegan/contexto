"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Mail, Search } from "lucide-react";
import { ToroBot } from "@/components/toro-bot";
import { localePath, t } from "@/lib/i18n";
import { EVENTO_ABRIR_MENU, idiomaDeRuta, pestanaActiva, type Pestana } from "@/lib/pestanas";
import { cn } from "@/lib/utils";

/**
 * Barra de pestañas del celular (solo debajo de 768 px): Inicio, Secciones, el asistente (el toro, al centro),
 * Buscar y Boletín. Pone lo que más se usa al alcance del pulgar, en vez de esconderlo todo tras el menú de arriba.
 *
 * Se esconde al bajar por la página y reaparece al subir, para no quitarle pantalla a quien lee. El resto de avisos
 * fijos (ubicación, notificaciones) se acomodan encima de ella con `--cg-barra` (globals.css), y el toro flotante se
 * retira en el celular porque ahora vive aquí.
 */
export function MobileTabBar() {
  const pathname = usePathname() ?? "/";
  const locale = idiomaDeRuta(pathname);
  const activa = pestanaActiva(pathname);
  const [visible, setVisible] = useState(true);
  const ultimoY = useRef(0);

  // Mientras la barra está escondida, los avisos fijos (ubicación, notificaciones) bajan al borde (`--cg-barra` en globals.css).
  useEffect(() => {
    document.documentElement.toggleAttribute("data-cg-barra-oculta", !visible);
    return () => document.documentElement.removeAttribute("data-cg-barra-oculta");
  }, [visible]);

  useEffect(() => {
    // Bajar esconde la barra; subir (o estar arriba del todo) la muestra. Un umbral evita que el temblor del dedo la parpadee.
    const alDesplazar = () => {
      const y = window.scrollY;
      const delta = y - ultimoY.current;
      if (Math.abs(delta) < 8) return;
      setVisible(delta < 0 || y < 120);
      ultimoY.current = y;
    };
    window.addEventListener("scroll", alDesplazar, { passive: true });
    return () => window.removeEventListener("scroll", alDesplazar);
  }, []);

  const base = "relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[0.625rem] font-semibold tracking-wide transition-colors active:opacity-70";
  const clase = (p: Pestana) =>
    cn(
      base,
      activa === p ? "text-[var(--accent)] before:absolute before:top-0 before:h-0.5 before:w-8 before:rounded-b-full before:bg-[var(--accent)]" : "text-[var(--fg-muted)]",
    );
  const etiquetaAsistente = t(locale, "nav.assistant");

  return (
    <nav
      aria-label={t(locale, "tab.label")}
      className={cn(
        "cg-tabbar fixed inset-x-0 bottom-0 z-[60] border-t border-[var(--border-strong)] bg-[var(--nav-bg)]/95 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-10px_30px_-18px_rgba(0,0,0,0.7)] backdrop-blur-md transition-transform duration-300 motion-reduce:transition-none md:hidden print:hidden",
        // Escondida, baja también lo que el círculo del asistente asoma por encima de la barra; con el foco del teclado dentro, vuelve.
        !visible && "translate-y-[calc(100%+2rem)] focus-within:translate-y-0",
      )}
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-end">
        <Link href={localePath(locale, "/")} className={clase("inicio")} aria-current={activa === "inicio" ? "page" : undefined}>
          <Home size={20} aria-hidden />
          {t(locale, "tab.home")}
        </Link>
        <button type="button" className={clase("secciones")} onClick={() => window.dispatchEvent(new Event(EVENTO_ABRIR_MENU))}>
          <LayoutGrid size={20} aria-hidden />
          {t(locale, "nav.sections")}
        </button>
        {/* El asistente, al centro y por encima de la barra: el toro de la marca. */}
        <Link href={localePath(locale, "/asistente")} aria-label={etiquetaAsistente} aria-current={activa === "asistente" ? "page" : undefined} className="relative -mt-5 flex flex-col items-center gap-0.5 px-1 pb-[0.6rem] text-[0.625rem] font-semibold tracking-wide active:opacity-70">
          <span className={cn("toro-float grid size-[3.25rem] place-items-center rounded-full border-2 bg-[var(--bg-2)] shadow-[0_10px_22px_-10px_rgba(0,0,0,0.8)]", activa === "asistente" ? "border-[var(--accent)]" : "border-[var(--border-strong)]")}>
            <span className="block w-11">
              <ToroBot bubble={false} label={etiquetaAsistente} />
            </span>
          </span>
          <span className={activa === "asistente" ? "text-[var(--accent)]" : "text-[var(--fg-muted)]"}>{etiquetaAsistente}</span>
        </Link>
        <Link href={localePath(locale, "/buscar")} className={clase("buscar")} aria-current={activa === "buscar" ? "page" : undefined}>
          <Search size={20} aria-hidden />
          {t(locale, "nav.search")}
        </Link>
        <Link href={localePath(locale, "/boletin")} className={clase("boletin")} aria-current={activa === "boletin" ? "page" : undefined}>
          <Mail size={20} aria-hidden />
          {t(locale, "tab.newsletter")}
        </Link>
      </div>
    </nav>
  );
}
