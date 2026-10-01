"use client";

import { useEffect } from "react";

/**
 * Lleva a Configuración → Seguridad con una navegación COMPLETA del navegador.
 *
 * No puede ser un `redirect()` del layout: el layout del panel no se vuelve a
 * renderizar en las navegaciones del cliente, y un `redirect()` lanzado desde
 * ahí durante el paso de login a /panel deja al router de Next sin árbol
 * válido: pide la misma ruta sin parar y la pantalla queda en negro.
 */
export function IrASeguridad({ href }: { href: string }) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);

  return (
    <p className="py-10 text-center text-sm text-[var(--fg-muted)]" role="status">
      Llevándote a Configuración para activar la verificación en dos pasos…
    </p>
  );
}
