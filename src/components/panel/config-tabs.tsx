"use client";

import { Children, isValidElement, useEffect, useState, type ReactElement, type ReactNode } from "react";

// Pestaña de la configuración: id, etiqueta e ícono.
type TabDef = { id: string; label: string; icon: ReactNode };

/**
 * Cada opción de Configuración en su propia pestaña, en vez de una página
 * larga de scroll infinito. Los hijos son las mismas `<Section id="…">` de
 * siempre — esto solo decide cuál se ve, con `hidden` en vez de desmontar,
 * para no perder el estado de un formulario a medio llenar al cambiar de
 * pestaña.
 *
 * Respeta el hash de la URL (p. ej. `#seguridad`, que usa el layout del
 * panel para mandar aquí cuando el 2FA todavía no está activo) como pestaña
 * inicial, en vez de siempre abrir en la primera.
 */
export function ConfigTabs({ tabs, children }: { tabs: TabDef[]; children: ReactNode }) {
  const [active, setActive] = useState(tabs[0]?.id);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el hash de la URL solo existe en el navegador
    if (hash && tabs.some((t) => t.id === hash)) setActive(hash);
    // Solo al montar: el hash es la intención de navegación inicial, no algo
    // a re-sincronizar si el usuario cambia de pestaña manualmente después.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = Children.toArray(children).filter(isValidElement) as ReactElement<{ id?: string }>[];

  return (
    <div>
      <div
        role="tablist"
        className="lx-navrail mb-6 gap-1.5 border-b border-[var(--border)] pb-3 sm:flex-wrap"
      >
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setActive(t.id);
                history.replaceState(null, "", `#${t.id}`);
              }}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition sm:min-h-0 ${
                isActive
                  ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                  : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>

      {items.map((el) => (
        <div key={el.props.id ?? el.key} hidden={el.props.id !== active}>
          {el}
        </div>
      ))}
    </div>
  );
}
