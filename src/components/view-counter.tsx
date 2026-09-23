"use client";

import { useEffect } from "react";

/**
 * Avisa una sola vez de que el artículo se ha leído. Espera cinco segundos:
 * un rebote inmediato no es una lectura, y así «Más leídas» mide interés real.
 * Usa sessionStorage para no contar recargas de la misma sesión.
 */
export function ViewCounter({ slug }: { slug: string }) {
  useEffect(() => {
    const clave = `visto:${slug}`;
    try {
      if (sessionStorage.getItem(clave)) return;
    } catch {
      // Modo privado o almacenamiento bloqueado: se cuenta igualmente.
    }

    const id = setTimeout(() => {
      try {
        sessionStorage.setItem(clave, "1");
      } catch {
        /* sin almacenamiento, seguimos */
      }
      void fetch("/api/vista", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug }),
        keepalive: true,
      }).catch(() => {});
    }, 5000);

    return () => clearTimeout(id);
  }, [slug]);

  return null;
}
