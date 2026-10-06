"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Franja alta de la cabecera (el nombre del sitio en grande): en las páginas de sección se pliega sola un segundo
 * después de abrirlas, para dejar la pantalla al contenido y solo el menú a la vista. En el resto de páginas queda
 * siempre visible. Al volver a la portada reaparece. Con «reducir movimiento» el cambio es inmediato.
 */
export function AutoHideBand({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const enSeccion = /(^|\/)categoria\//.test(pathname);
  // Ruta para la que ya pasó el segundo: al cambiar de página se vuelve a mostrar y se espera otra vez.
  const [plegada, setPlegada] = useState<string | null>(null);
  useEffect(() => {
    if (!enSeccion) return;
    const t = setTimeout(() => setPlegada(pathname), 1000);
    return () => clearTimeout(t);
  }, [enSeccion, pathname]);
  const oculta = enSeccion && plegada === pathname;

  return (
    <div
      aria-hidden={oculta || undefined}
      inert={oculta || undefined}
      className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out motion-reduce:transition-none ${oculta ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
