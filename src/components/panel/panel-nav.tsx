"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, KeyRound, LayoutDashboard, LayoutTemplate, Mail, Newspaper, Settings, Users, Circle } from "lucide-react";
import type { PermisoId } from "@/lib/permisos";
import { PanelMobileMenu } from "@/components/panel/panel-mobile-menu";

// Elemento del menú del panel: dirección, etiqueta, ícono y permiso necesario.
type Item = {
  href: string;
  label: string;
  hint: string;
  /** Permiso que hace falta para verla (ver src/lib/permisos.ts). */
  permiso?: PermisoId;
  /** Cómo la ve quien no es administrador (si sigue viéndola, con otro texto). */
  paraOtros?: { label: string; hint: string };
};
// Grupo de elementos del menú.
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
        permiso: "portada",
      },
    ],
  },
  {
    id: "redactor",
    label: "Redactor",
    items: [
      { href: "/panel", label: "Resumen", hint: "Estado editorial de un vistazo" },
      { href: "/panel/articulos", label: "Artículos", hint: "Crear, editar y programar", permiso: "articulos" },
      { href: "/panel/newsletter", label: "Newsletter", hint: "Configurar y enviar el boletín", permiso: "newsletter" },
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
        permiso: "newsletter",
      },
      {
        href: "/panel/mensajes",
        label: "Mensajes recibidos",
        hint: "Contacto y solicitudes de pauta",
        permiso: "mensajes",
      },
      {
        href: "/panel/api",
        label: "API pública",
        hint: "Claves para terceros y documentación",
        permiso: "api",
      },
    ],
  },
];

// Grupos y elementos que la persona puede ver según su rol y permisos.
function gruposVisibles(role: string, permisos: string[]) {
  const esAdmin = role === "administrador";
  // Lo que el rol no puede usar ni se muestra (el servidor además lo exige).
  return GROUPS.map((g) => ({
    ...g,
    items: g.items
      .filter((i) => !i.permiso || permisos.includes(i.permiso))
      .map((i) => (esAdmin || !i.paraOtros ? i : { ...i, ...i.paraOtros })),
  })).filter((g) => g.items.length > 0);
}

// Ícono de cada elemento por su id.
const ICONOS: Record<string, typeof Circle> = {
  "/panel": LayoutDashboard,
  "/panel/portada": LayoutTemplate,
  "/panel/articulos": Newspaper,
  "/panel/newsletter": Mail,
  "/panel/configuracion": Settings,
  "/panel/newsletter?tab=suscriptores": Users,
  "/panel/mensajes": Inbox,
  "/panel/api": KeyRound,
};

/** Barra lateral de escritorio (≥ lg): navegación vertical agrupada, con la sección activa resaltada. */
export function PanelSidebarNav({ role, permisos }: { role: string; permisos: string[] }) {
  const groups = gruposVisibles(role, permisos);
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones del panel" className="flex flex-col gap-6">
      {groups.map((g) => (
        <div key={g.id}>
          <p className="whitespace-nowrap px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-[var(--ink-faint)] opacity-0 transition-opacity duration-150 group-hover/sb:opacity-100 group-focus-within/sb:opacity-100">{g.label}</p>
          <ul className="mt-2 flex flex-col gap-1">
            {g.items.map((i) => {
              const base = i.href.split(/[#?]/)[0];
              const current = i.href.includes("?") ? false : pathname === base || (base !== "/panel" && pathname.startsWith(`${base}/`));
              const Icon = ICONOS[i.href] ?? Circle;
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    title={i.hint}
                    aria-current={current ? "page" : undefined}
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      current ? "bg-white/12 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]" : "text-[var(--fg-muted)] hover:bg-white/8 hover:text-white"
                    }`}
                  >
                    {current && <span aria-hidden className="absolute -left-1.5 top-2 bottom-2 w-1 rounded-full bg-[var(--accent)]" />}
                    <Icon size={20} className={`shrink-0 ${current ? "text-[var(--accent)]" : "opacity-80 group-hover:text-[var(--accent)]"}`} aria-hidden />
                    <span className="whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/sb:opacity-100 group-focus-within/sb:opacity-100">{i.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

// Menú lateral del panel, filtrado por rol y permisos.
export function PanelNav({ role, permisos, children }: { role: string; permisos: string[]; children?: React.ReactNode }) {
  const groups = gruposVisibles(role, permisos);

  return (
    <>
    {/* Debajo de `lg` los tres desplegables no caben: menú móvil con todas las secciones y la cuenta. */}
    <PanelMobileMenu groups={groups}>{children}</PanelMobileMenu>
    </>
  );
}
