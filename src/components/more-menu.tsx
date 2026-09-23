"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { MENU_SECUNDARIO } from "@/content/institucional";
import { localePath, t, type Locale } from "@/lib/i18n";

/**
 * Menú «Más» (§5 N-04): la barra principal se queda en 6-8 secciones y el resto
 * de enlaces —institucionales, legales y comerciales— vive aquí. Es el mismo
 * conjunto que el pie, para que el lector encuentre lo mismo en ambos sitios.
 */
export function MoreMenu({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Se cierra al pulsar fuera o con Escape: comportamiento esperado de un menú.
  useEffect(() => {
    if (!open) return;
    const fuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
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
        onClick={() => setOpen((v) => !v)}
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
          className="absolute right-0 top-full z-50 mt-1 w-[16rem] overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] py-2 text-left shadow-[var(--shadow)]"
        >
          {/* El acceso al panel va aquí además de en el pie: desde el menú
              «Más» está a un clic en cualquier plantilla y también en móvil,
              donde el enlace de la cabecera se oculta por falta de espacio. */}
          {MENU_SECUNDARIO.map((m) => (
            <Link
              key={m.slug}
              role="menuitem"
              href={localePath(locale, `/${m.slug}`)}
              onClick={() => setOpen(false)}
              className="lx-ui block px-4 py-2.5 text-[0.8rem] normal-case tracking-normal text-[var(--fg)] transition hover:bg-[var(--surface-2)] hover:text-[var(--accent)]"
            >
              {m.label[locale]}
            </Link>
          ))}

          <span aria-hidden className="my-1.5 block h-px bg-[var(--border)]" />
          <Link
            role="menuitem"
            href="/panel"
            onClick={() => setOpen(false)}
            className="lx-ui block px-4 py-2.5 text-[0.8rem] font-semibold normal-case tracking-normal text-[var(--accent)] transition hover:bg-[var(--surface-2)]"
          >
            {t(locale, "footer.panel")}
          </Link>
        </div>
      )}
    </div>
  );
}
