"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

type Item = {
  href: string;
  label: string;
  hint: string;
  /** Solo el administrador la ve. */
  adminOnly?: boolean;
  /** Cómo la ve quien no es administrador (si sigue viéndola, con otro texto). */
  paraOtros?: { label: string; hint: string };
};
type Group = { id: string; label: string; items: Item[] };

/**
 * Navegación del panel en dos frentes de trabajo: quien diseña el sitio y
 * quien escribe en él. Antes era una lista plana de cinco enlaces donde
 * "Portada" (diseño) se confundía con "Artículos" (contenido).
 */
const GROUPS: Group[] = [
  {
    id: "diseno",
    label: "Diseño",
    items: [
      {
        href: "/panel/portada",
        label: "Portada y plantillas",
        hint: "Plantilla, fondo, orden y estilo de las tarjetas",
      },
    ],
  },
  {
    id: "redactor",
    label: "Redactor",
    items: [
      { href: "/panel", label: "Resumen", hint: "Estado editorial de un vistazo" },
      { href: "/panel/articulos", label: "Artículos", hint: "Crear, editar y programar" },
      { href: "/panel/newsletter", label: "Newsletter", hint: "Configurar y enviar el boletín" },
    ],
  },
  {
    id: "configuracion",
    label: "Configuración",
    // Identidad, personas, seguridad, analítica y asistente ya no son enlaces
    // aparte: son pestañas dentro de /panel/configuracion (ver ConfigTabs).
    // Repetirlos aquí como anclas duplicaba la navegación y, peor, quedaba
    // desactualizado en cuanto una pestaña cambiaba de nombre o desaparecía.
    items: [
      {
        href: "/panel/configuracion",
        label: "Configuración",
        hint: "Identidad, personas, seguridad, analítica y asistente",
      },
      {
        href: "/panel/newsletter?tab=suscriptores",
        label: "Suscriptores",
        hint: "Boletín: altas, bajas y confirmados",
      },
      {
        href: "/panel/mensajes",
        label: "Mensajes recibidos",
        hint: "Contacto y solicitudes de pauta",
      },
      {
        href: "/panel/api",
        label: "API pública",
        hint: "Claves para terceros y documentación",
        adminOnly: true,
      },
    ],
  },
];

export function PanelNav({ role }: { role: string }) {
  const esAdmin = role === "administrador";
  // Lo que el rol no puede usar ni se muestra (el servidor además lo exige).
  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items
      .filter((i) => esAdmin || !i.adminOnly)
      .map((i) => (esAdmin || !i.paraOtros ? i : { ...i, ...i.paraOtros })),
  }));
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // Cerrar al hacer clic fuera o con Escape: un menú que se queda abierto
  // tapando el contenido es peor que no tenerlo.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <nav ref={navRef} aria-label="Secciones del panel" className="relative flex flex-wrap gap-1.5">
      {groups.map((group) => {
        const isOpen = open === group.id;
        // "/panel" es prefijo de todo, así que el grupo activo se decide por
        // coincidencia exacta o por ruta hija, nunca por startsWith a secas.
        const active = group.items.some((i) => {
          const base = i.href.split("#")[0];
          return pathname === base || (base !== "/panel" && pathname.startsWith(`${base}/`));
        });

        return (
          <div key={group.id} className="relative">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : group.id)}
              aria-expanded={isOpen}
              aria-haspopup="menu"
              className={`inline-flex items-center gap-1.5 rounded-[var(--radius)] px-3 py-1.5 text-xs font-medium transition ${
                active || isOpen
                  ? "bg-[var(--surface-2)] text-[var(--fg)]"
                  : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
              }`}
            >
              {group.label}
              <ChevronDown
                size={13}
                className={`transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>

            {isOpen && (
              <div
                role="menu"
                className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-72 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--nav-bg)] p-1.5 shadow-[var(--shadow-hover)]"
              >
                {group.items.map((item) => {
                  const base = item.href.split("#")[0];
                  const current =
                    pathname === base || (base !== "/panel" && pathname.startsWith(`${base}/`));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      onClick={() => setOpen(null)}
                      aria-current={current ? "page" : undefined}
                      className={`block rounded-[var(--radius)] px-3 py-2.5 transition ${
                        current
                          ? "bg-[var(--surface-2)] text-[var(--accent)]"
                          : "hover:bg-[var(--surface-2)]"
                      }`}
                    >
                      <span className="block text-sm font-medium">{item.label}</span>
                      <span className="mt-0.5 block text-xs text-[var(--fg-muted)]">
                        {item.hint}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
