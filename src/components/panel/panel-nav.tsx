"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { grupoDe, useGruposMenu } from "@/components/panel/grupos-menu";
import { CalendarRange, ChevronDown, ClipboardList, Inbox, KeyRound, LayoutDashboard, LayoutTemplate, Mail, Newspaper, Settings, Users, Circle } from "lucide-react";
import type { PermisoId } from "@/lib/permisos";
import { PanelMobileMenu } from "@/components/panel/panel-mobile-menu";

// Elemento del menú del panel: dirección, etiqueta, ícono y permiso necesario.
type Item = {
  href: string;
  label: string;
  hint: string;
  /** Permiso que hace falta para verla (ver src/lib/permisos.ts). */
  permiso?: PermisoId;
  /** Solo lo ve y lo usa un administrador (el servidor además lo exige). */
  soloAdmin?: boolean;
  /** Cómo la ve quien no es administrador (si sigue viéndola, con otro texto). */
  paraOtros?: { label: string; hint: string };
  /** Número que se muestra en una insignia junto al nombre (p. ej. las piezas que te asignaron). */
  badge?: number;
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
      { href: "/panel", label: "Resumen", hint: "Estado editorial, audiencia y suscriptores" },
      { href: "/panel/articulos", label: "Artículos", hint: "Crear, editar y programar", permiso: "articulos" },
      { href: "/panel/pendientes", label: "Mis pendientes", hint: "Piezas del consejo que te asignaron" },
      { href: "/panel/consejo", label: "Consejo de redacción", hint: "Planear la semana con IA", permiso: "articulos", soloAdmin: true },
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
function gruposVisibles(role: string, permisos: string[], pendientes = 0) {
  const esAdmin = role === "administrador";
  // Lo que el rol no puede usar ni se muestra (el servidor además lo exige).
  return GROUPS.map((g) => ({
    ...g,
    items: g.items
      .filter((i) => (!i.soloAdmin || esAdmin) && (!i.permiso || permisos.includes(i.permiso)))
      .map((i) => (esAdmin || !i.paraOtros ? i : { ...i, ...i.paraOtros }))
      .map((i) => (i.href === "/panel/pendientes" && pendientes > 0 ? { ...i, badge: pendientes } : i)),
  })).filter((g) => g.items.length > 0);
}

// Ícono de cada elemento por su id.
const ICONOS: Record<string, typeof Circle> = {
  "/panel": LayoutDashboard,
  "/panel/portada": LayoutTemplate,
  "/panel/articulos": Newspaper,
  "/panel/consejo": CalendarRange,
  "/panel/pendientes": ClipboardList,
  "/panel/newsletter": Mail,
  "/panel/configuracion": Settings,
  "/panel/newsletter?tab=suscriptores": Users,
  "/panel/mensajes": Inbox,
  "/panel/api": KeyRound,
};

/** Barra lateral de escritorio (≥ lg): navegación vertical agrupada, con la sección activa resaltada. */
export function PanelSidebarNav({ role, permisos, pendientes = 0 }: { role: string; permisos: string[]; pendientes?: number }) {
  const groups = gruposVisibles(role, permisos, pendientes);
  const pathname = usePathname();
  const { abierto, alternar } = useGruposMenu(grupoDe(groups, pathname));
  return (
    <nav aria-label="Secciones del panel" className="flex flex-col gap-3">
      {groups.map((g) => {
        const abiertoG = abierto(g.id);
        return (
          <div key={g.id}>
            {/* Cada grupo es un desplegable (como «Uso de IA»): el encabezado lo abre y lo cierra. Con el menú recogido no se ve el texto, solo los íconos de los abiertos. */}
            <button
              type="button"
              aria-expanded={abiertoG}
              aria-controls={`menu-grupo-${g.id}`}
              onClick={() => alternar(g.id)}
              className="flex w-full items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-[var(--ink-faint)] opacity-0 transition hover:bg-white/8 hover:text-white group-hover/sb:opacity-100 group-focus-within/sb:opacity-100"
            >
              <span>{g.label}</span>
              <ChevronDown size={14} aria-hidden className={`shrink-0 transition-transform ${abiertoG ? "rotate-180" : ""}`} />
            </button>
            <ul id={`menu-grupo-${g.id}`} hidden={!abiertoG} className="mt-1 flex flex-col gap-1">
              {g.items.map((i) => {
                const base = i.href.split(/[#?]/)[0];
                const current = i.href.includes("?") ? false : pathname === base || (base !== "/panel" && pathname.startsWith(`${base}/`)) || (base === "/panel" && pathname.startsWith("/panel/analitica"));
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
                      {i.badge ? <span aria-hidden className="absolute left-7 top-1 grid min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[0.625rem] font-bold leading-4 text-white group-hover/sb:hidden group-focus-within/sb:hidden">{i.badge > 9 ? "9+" : i.badge}</span> : null}
                      <span className="whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/sb:opacity-100 group-focus-within/sb:opacity-100">{i.label}</span>
                      {i.badge ? <span aria-label={`${i.badge} pendientes`} className="ml-auto hidden rounded-full bg-red-600 px-2 text-xs font-bold leading-5 text-white group-hover/sb:inline group-focus-within/sb:inline">{i.badge}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

// Menú lateral del panel, filtrado por rol y permisos.
export function PanelNav({ role, permisos, pendientes = 0, children }: { role: string; permisos: string[]; pendientes?: number; children?: React.ReactNode }) {
  const groups = gruposVisibles(role, permisos, pendientes);

  return (
    <>
    {/* Debajo de `lg` los tres desplegables no caben: menú móvil con todas las secciones y la cuenta. */}
    <PanelMobileMenu groups={groups} alerta={pendientes > 0}>{children}</PanelMobileMenu>
    </>
  );
}
