"use client";

import { useEffect } from "react";

/**
 * Publica la altura real de la cabecera del panel en `--panel-header-h` para
 * que los bloques fijos (`sticky`) se coloquen justo debajo, aunque la barra
 * cambie de alto al envolverse en pantallas estrechas.
 */
export function HeaderHeightVar() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("[data-panel-header]");
    if (!header) return;
    // Mide el alto de la cabecera y lo guarda como variable CSS.
    const set = () =>
      document.documentElement.style.setProperty("--panel-header-h", `${header.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);
  return null;
}
