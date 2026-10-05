"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

// Grupo de enlaces del menú del celular.
export type MenuGroup = {
  id: string;
  label: string;
  items: { href: string; label: string; hint: string }[];
};

/**
 * Menú del panel en pantallas estrechas (debajo de `lg`): un botón de 44 px en
 * la barra y, al abrirlo, una hoja a todo el ancho con TODAS las secciones y la
 * cuenta (`children`: nombre, «Ver sitio», «Salir»).
 *
 * Los tres desplegables de escritorio no caben en un teléfono: se envolvían en
 * tres filas y la cabecera fija se comía el 20–36 % de la pantalla. La hoja se
 * posiciona contra la `<header>` (que es `sticky`), así que el botón y la hoja
 * no ocupan alto cuando el menú está cerrado.
 */
export function PanelMobileMenu({ groups, children }: { groups: MenuGroup[]; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const sheet = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  // Al navegar se cierra: el menú no debe quedarse tapando la pantalla nueva.
  useEffect(() => {
    const id = setTimeout(() => setOpen(false), 0);
    return () => clearTimeout(id);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    // Cierra el menú con la tecla Escape.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    // Cierra el menú al tocar fuera.
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!sheet.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="panel-menu-movil"
        aria-label={open ? "Cerrar el menú del panel" : "Abrir el menú del panel"}
        className="ml-auto grid size-11 shrink-0 place-items-center rounded-full border border-[var(--border-strong)] text-[var(--fg)] transition active:scale-95 hover:border-[var(--accent)] lg:hidden"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open && (
        <div
          id="panel-menu-movil"
          ref={sheet}
          className="absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-var(--panel-header-h,4rem))] overflow-y-auto overscroll-contain border-b border-[var(--border)] bg-[var(--bg)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 text-[var(--fg)] shadow-[var(--shadow-hover)] lg:hidden"
        >
          <nav aria-label="Secciones del panel" className="flex flex-col">
            {groups.map((g) => (
              <div key={g.id} className="border-b border-[var(--border)] py-2 last:border-b-0">
                <p className="lx-kicker px-1 pb-1 pt-2 text-[var(--accent)]">{g.label}</p>
                <ul>
                  {g.items.map((item) => {
                    const base = item.href.split(/[#?]/)[0];
                    const current = pathname === base || (base !== "/panel" && pathname.startsWith(`${base}/`));
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={current ? "page" : undefined}
                          className={`flex min-h-12 flex-col justify-center rounded-[var(--radius)] px-3 py-1.5 transition ${
                            current ? "bg-[var(--surface-2)] text-[var(--accent)]" : "active:bg-[var(--surface-2)]"
                          }`}
                        >
                          <span className="text-[0.95rem] font-medium">{item.label}</span>
                          <span className="text-xs text-[var(--fg-muted)]">{item.hint}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
          <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4 text-sm">{children}</div>
        </div>
      )}
    </>
  );
}
