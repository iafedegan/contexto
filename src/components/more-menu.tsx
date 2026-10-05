"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { MENU_SECUNDARIO } from "@/content/institucional";
import { localePath, t, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Menú «Más» (§5 N-04): la barra principal se queda en 6-8 secciones y el resto
 * de enlaces —institucionales, legales y comerciales— vive aquí. Es el mismo
 * conjunto que el pie, para que el lector encuentre lo mismo en ambos sitios.
 */
export function MoreMenu({
  locale,
  extra = [],
}: {
  locale: Locale;
  /** Secciones que no caben en la barra principal (N-04). `cls` permite ocultar una a partir de cierto ancho
   *  (p. ej. `xl:hidden`: a ese ancho ya cabe en la propia barra y no hace falta repetirla aquí). */
  extra?: { href: string; label: string; cls?: string }[];
}) {
  const [open, setOpen] = useState(false);
  // Alto disponible bajo el botón: con la cabecera sin desplazar, el menú no debe salirse por abajo de la pantalla.
  const [alto, setAlto] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Se cierra al pulsar fuera o con Escape: comportamiento esperado de un menú.
  useEffect(() => {
    if (!open) return;
    // Cierra el menú al hacer clic fuera.
    const fuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    // Cierra el menú con la tecla Escape.
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          if (ref.current) setAlto(Math.max(192, Math.floor(window.innerHeight - ref.current.getBoundingClientRect().bottom - 16)));
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        // 44 px de alto mínimo: área táctil del §11 (D-02 / DM-01).
        className="lx-ui inline-flex min-h-11 items-center gap-1.5 px-2 text-inherit transition hover:text-[var(--accent)]"
      >
        {t(locale, "nav.more")}
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          style={alto ? { maxHeight: alto } : undefined}
          // Fondo SÓLIDO (`--nav-bg` nunca es translúcido): con `--surface`, que en
          // las plantillas oscuras es un blanco al 4 %, el contenido de detrás se
          // transparentaba y el menú no se podía leer.
          className="absolute right-0 top-full z-[60] mt-1 max-h-[70dvh] w-[min(16rem,calc(100vw-2rem))] overflow-y-auto overflow-x-hidden rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--nav-bg)] py-2 text-left text-[var(--fg)] opacity-100 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]"
        >
          {extra.length > 0 && (
            <>
              {extra.map((e) => (
                <Link
                  key={e.href}
                  role="menuitem"
                  href={localePath(locale, e.href)}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "lx-ui block px-4 py-2.5 text-[0.8rem] normal-case tracking-normal text-[var(--fg)] transition hover:bg-[var(--surface-2)] hover:text-[var(--accent)] pointer-coarse:py-3",
                    e.cls,
                  )}
                >
                  {e.label}
                </Link>
              ))}
              <span aria-hidden className="my-1.5 block h-px bg-[var(--border)]" />
            </>
          )}

          {/* El acceso al panel va aquí además de en el pie: desde el menú
              «Más» está a un clic en cualquier plantilla y también en móvil,
              donde el enlace de la cabecera se oculta por falta de espacio. */}
          {MENU_SECUNDARIO.map((m) => (
            <Link
              key={m.slug}
              role="menuitem"
              href={localePath(locale, `/${m.slug}`)}
              onClick={() => setOpen(false)}
              className="lx-ui block px-4 py-2.5 text-[0.8rem] normal-case tracking-normal text-[var(--fg)] transition hover:bg-[var(--surface-2)] hover:text-[var(--accent)] pointer-coarse:py-3"
            >
              {m.label[locale]}
            </Link>
          ))}

          <span aria-hidden className="my-1.5 block h-px bg-[var(--border)]" />
          <Link
            role="menuitem"
            href="/panel"
            onClick={() => setOpen(false)}
            className="lx-ui block px-4 py-2.5 text-[0.8rem] font-semibold normal-case tracking-normal text-[var(--accent)] transition hover:bg-[var(--surface-2)] pointer-coarse:py-3"
          >
            {t(locale, "footer.panel")}
          </Link>
        </div>
      )}
    </div>
  );
}
